/**
 * PicPDF Web — PDF 转图片版 PDF（多文件支持）
 * 纯浏览器端处理，使用 pdf.js 渲染 + jsPDF 组装
 */

// ============ DOM Elements ============

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
const btnConvert = document.getElementById('btn-convert');
const dpiSelect = document.getElementById('dpi-select');
const qualityRange = document.getElementById('quality-range');
const qualityValue = document.getElementById('quality-value');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const emptyState = document.getElementById('empty-state');
const resultSection = document.getElementById('result-section');
const resultListEl = document.getElementById('result-list');
const btnDownloadAll = document.getElementById('btn-download-all');
const btnRestart = document.getElementById('btn-restart');

// ============ State ============

let selectedFiles = []; // { file, id }
let results = [];       // { blob, name, pages, originalSize, outputSize, elapsed }
let fileIdCounter = 0;

// ============ Event Listeners ============

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
});

qualityRange.addEventListener('input', () => {
    qualityValue.textContent = qualityRange.value;
});

btnConvert.addEventListener('click', startConversion);
btnDownloadAll.addEventListener('click', downloadAll);
btnRestart.addEventListener('click', resetAll);

// ============ File Handling ============

function handleFiles(fileList) {
    for (const file of fileList) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            showError(`"${file.name}" 不是 PDF 文件，已跳过`);
            continue;
        }
        if (file.size > 200 * 1024 * 1024) {
            showError(`"${file.name}" 超过 200MB 限制，已跳过`);
            continue;
        }
        // 去重
        const exists = selectedFiles.some(f => f.file.name === file.name && f.file.size === file.size);
        if (exists) continue;

        const id = ++fileIdCounter;
        selectedFiles.push({ file, id });
    }

    renderFileList();
    btnConvert.disabled = selectedFiles.length === 0;
}

function removeFile(id) {
    selectedFiles = selectedFiles.filter(f => f.id !== id);
    renderFileList();
    btnConvert.disabled = selectedFiles.length === 0;
}

function renderFileList() {
    fileListEl.innerHTML = '';
    for (const { file, id } of selectedFiles) {
        const el = document.createElement('div');
        el.className = 'file-item';
        el.innerHTML = `
            <span class="file-item-icon">📄</span>
            <div class="file-item-details">
                <span class="file-item-name">${escapeHtml(file.name)}</span>
                <span class="file-item-size">${formatSize(file.size)}</span>
            </div>
            <button class="btn-remove" title="移除" data-id="${id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        el.querySelector('.btn-remove').addEventListener('click', () => removeFile(id));
        fileListEl.appendChild(el);
    }
}

// ============ Conversion ============

async function startConversion() {
    if (selectedFiles.length === 0) return;

    const dpi = parseInt(dpiSelect.value);
    const quality = parseInt(qualityRange.value) / 100;
    const totalFiles = selectedFiles.length;

    // UI: show progress, hide empty/results
    emptyState.style.display = 'none';
    progressSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    btnConvert.disabled = true;
    btnConvert.querySelector('.btn-text').textContent = '转换中...';

    results = [];
    resultListEl.innerHTML = '';

    for (let fi = 0; fi < totalFiles; fi++) {
        const { file } = selectedFiles[fi];
        const fileLabel = totalFiles > 1 ? `[${fi + 1}/${totalFiles}] ` : '';
        const startTime = performance.now();

        try {
            updateProgress(0, `${fileLabel}正在读取...`);
            const arrayBuffer = await file.arrayBuffer();

            updateProgress(5, `${fileLabel}正在解析 PDF...`);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDoc = await loadingTask.promise;
            const totalPages = pdfDoc.numPages;

            updateProgress(10, `${fileLabel}共 ${totalPages} 页，开始渲染...`);

            // Get first page dimensions
            const firstPage = await pdfDoc.getPage(1);
            const firstViewport = firstPage.getViewport({ scale: 1 });
            const pageWidthPt = firstViewport.width;
            const pageHeightPt = firstViewport.height;

            const { jsPDF } = window.jspdf;
            const orientation = pageWidthPt > pageHeightPt ? 'landscape' : 'portrait';
            const pdf = new jsPDF({
                orientation,
                unit: 'pt',
                format: [pageWidthPt, pageHeightPt],
                compress: true
            });

            for (let i = 1; i <= totalPages; i++) {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 1 });
                const scale = dpi / 72;
                const scaledViewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;
                const ctx = canvas.getContext('2d');

                await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

                const imgData = canvas.toDataURL('image/jpeg', quality);
                const curWidthPt = viewport.width;
                const curHeightPt = viewport.height;

                if (i > 1) {
                    const orient = curWidthPt > curHeightPt ? 'landscape' : 'portrait';
                    pdf.addPage([curWidthPt, curHeightPt], orient);
                }

                pdf.addImage(imgData, 'JPEG', 0, 0, curWidthPt, curHeightPt);

                const pageProgress = 10 + (i / totalPages) * 85;
                const overallProgress = (fi + pageProgress / 100) / totalFiles * 100;
                updateProgress(overallProgress, `${fileLabel}第 ${i}/${totalPages} 页...`);

                await new Promise(r => setTimeout(r, 0));
            }

            updateProgress((fi + 0.95) / totalFiles * 100, `${fileLabel}正在生成 PDF...`);
            const outputBlob = pdf.output('blob');
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

            const baseName = file.name.replace(/\.pdf$/i, '');
            results.push({
                blob: outputBlob,
                name: `${baseName}_图片版.pdf`,
                originalName: file.name,
                pages: totalPages,
                originalSize: file.size,
                outputSize: outputBlob.size,
                elapsed
            });

        } catch (err) {
            console.error(`Conversion error (${file.name}):`, err);
            showError(`"${file.name}" 转换失败: ${err.message}`);
        }
    }

    // Done
    updateProgress(100, '全部完成');
    showResults();

    btnConvert.disabled = false;
    btnConvert.querySelector('.btn-text').textContent = '开始转换';
}

function updateProgress(percent, text) {
    progressBar.style.width = `${Math.min(percent, 100)}%`;
    progressPercent.textContent = `${Math.round(percent)}%`;
    if (text) progressText.textContent = text;
}

// ============ Results ============

function showResults() {
    progressSection.classList.add('hidden');

    if (results.length === 0) {
        emptyState.style.display = '';
        return;
    }

    resultSection.classList.remove('hidden');
    resultListEl.innerHTML = '';

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const el = document.createElement('div');
        el.className = 'result-item';
        el.innerHTML = `
            <div class="result-item-icon">✓</div>
            <div class="result-item-details">
                <div class="result-item-name">${escapeHtml(r.originalName)}</div>
                <div class="result-item-meta">${r.pages} 页 · ${formatSize(r.originalSize)} → ${formatSize(r.outputSize)} · ${r.elapsed}s</div>
            </div>
            <button class="btn-download-single" data-index="${i}">下载</button>
        `;
        el.querySelector('.btn-download-single').addEventListener('click', () => downloadSingle(i));
        resultListEl.appendChild(el);
    }

    if (results.length > 1) {
        btnDownloadAll.classList.remove('hidden');
    } else {
        btnDownloadAll.classList.add('hidden');
    }
}

function downloadSingle(index) {
    const r = results[index];
    if (!r || !r.blob) return;
    triggerDownload(r.blob, r.name);
}

function downloadAll() {
    for (const r of results) {
        triggerDownload(r.blob, r.name);
    }
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ============ Reset ============

function resetAll() {
    selectedFiles = [];
    results = [];
    fileListEl.innerHTML = '';
    resultListEl.innerHTML = '';
    btnConvert.disabled = true;
    btnConvert.querySelector('.btn-text').textContent = '开始转换';

    emptyState.style.display = '';
    progressSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    btnDownloadAll.classList.add('hidden');

    progressBar.style.width = '0%';
    progressText.textContent = '准备中...';
    progressPercent.textContent = '0%';
}

// ============ Utilities ============

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function showError(message) {
    alert(message);
}
