/**
 * PicPDF Web — PDF 转图片版 PDF
 * 纯浏览器端处理，使用 pdf.js 渲染 + jsPDF 组装
 */

// ============ DOM Elements ============

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileMeta = document.getElementById('file-meta');
const btnRemove = document.getElementById('btn-remove');
const btnConvert = document.getElementById('btn-convert');
const dpiSelect = document.getElementById('dpi-select');
const qualityRange = document.getElementById('quality-range');
const qualityValue = document.getElementById('quality-value');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const btnDownload = document.getElementById('btn-download');
const btnRestart = document.getElementById('btn-restart');

const stepUpload = document.getElementById('step-upload');
const stepSettings = document.getElementById('step-settings');
const stepProgress = document.getElementById('step-progress');
const stepDone = document.getElementById('step-done');

// ============ State ============

let selectedFile = null;
let outputBlob = null;
let originalSize = 0;

// ============ Event Listeners ============

// Drop zone - click to select
dropZone.addEventListener('click', () => fileInput.click());

// Drag & drop
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
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
});

// File input change
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

// Remove file
btnRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    resetToUpload();
});

// Quality slider
qualityRange.addEventListener('input', () => {
    qualityValue.textContent = qualityRange.value;
});

// Convert button
btnConvert.addEventListener('click', startConversion);

// Download button
btnDownload.addEventListener('click', downloadResult);

// Restart button
btnRestart.addEventListener('click', resetToUpload);

// ============ File Handling ============

function handleFile(file) {
    // Validate PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showError('请选择 PDF 文件');
        return;
    }

    if (file.size > 200 * 1024 * 1024) {
        showError('文件大小超过 200MB 限制');
        return;
    }

    selectedFile = file;
    originalSize = file.size;

    // Show file info
    fileName.textContent = file.name;
    fileMeta.textContent = formatSize(file.size);
    fileInfo.classList.remove('hidden');
    dropZone.style.display = 'none';

    // Enable convert button
    btnConvert.disabled = false;
}

function resetToUpload() {
    selectedFile = null;
    outputBlob = null;
    originalSize = 0;

    // Reset UI
    fileInfo.classList.add('hidden');
    dropZone.style.display = '';
    fileInput.value = '';
    btnConvert.disabled = true;

    // Show only upload & settings steps
    stepUpload.classList.remove('hidden');
    stepSettings.classList.remove('hidden');
    stepProgress.classList.add('hidden');
    stepDone.classList.add('hidden');

    // Reset progress
    progressBar.style.width = '0%';
    progressText.textContent = '准备中...';
    progressPercent.textContent = '0%';
}

// ============ Conversion ============

async function startConversion() {
    const dpi = parseInt(dpiSelect.value);
    const quality = parseInt(qualityRange.value) / 100;

    // Show progress
    stepProgress.classList.remove('hidden');
    stepDone.classList.add('hidden');
    btnConvert.disabled = true;
    btnConvert.querySelector('.btn-text').textContent = '转换中...';

    const startTime = performance.now();

    try {
        // Read file as ArrayBuffer
        updateProgress(0, '正在读取文件...');
        const arrayBuffer = await selectedFile.arrayBuffer();

        // Load PDF with pdf.js
        updateProgress(5, '正在解析 PDF...');

        // 使用全局 pdfjsLib
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;

        updateProgress(10, `共 ${totalPages} 页，开始渲染...`);

        // Create jsPDF document
        // 先渲染第一页以获取尺寸
        const firstPage = await pdfDoc.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });

        // pdf.js viewport at scale=1 returns dimensions in PDF points (72 pt/inch)
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

        // Process each page
        for (let i = 1; i <= totalPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1 });

            // 计算渲染比例：dpi / 72 (PDF 标准是 72 pt/inch)
            const scale = dpi / 72;
            const scaledViewport = page.getViewport({ scale });

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            const ctx = canvas.getContext('2d');

            // Render page to canvas
            await page.render({
                canvasContext: ctx,
                viewport: scaledViewport
            }).promise;

            // Canvas to JPEG data URL
            const imgData = canvas.toDataURL('image/jpeg', quality);

            // 当前页面尺寸 (pt) — viewport at scale=1 already in PDF points
            const curWidthPt = viewport.width;
            const curHeightPt = viewport.height;

            // Add page to PDF (first page already created)
            if (i > 1) {
                const orient = curWidthPt > curHeightPt ? 'landscape' : 'portrait';
                pdf.addPage([curWidthPt, curHeightPt], orient);
            }

            // Insert image filling the entire page
            pdf.addImage(imgData, 'JPEG', 0, 0, curWidthPt, curHeightPt);

            // Update progress
            const progress = 10 + (i / totalPages) * 85;
            updateProgress(progress, `正在处理第 ${i}/${totalPages} 页...`);

            // Yield to keep UI responsive
            await new Promise(r => setTimeout(r, 0));
        }

        // Generate output
        updateProgress(95, '正在生成 PDF...');
        outputBlob = pdf.output('blob');

        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

        // Show done
        updateProgress(100, '完成');
        showDone(totalPages, elapsed);

    } catch (err) {
        console.error('Conversion error:', err);
        showError(`转换失败: ${err.message}`);
        btnConvert.disabled = false;
        btnConvert.querySelector('.btn-text').textContent = '开始转换';
        stepProgress.classList.add('hidden');
    }
}

function updateProgress(percent, text) {
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${Math.round(percent)}%`;
    if (text) progressText.textContent = text;
}

function showDone(pages, elapsed) {
    stepProgress.classList.add('hidden');
    stepDone.classList.remove('hidden');

    document.getElementById('stat-pages').textContent = pages;
    document.getElementById('stat-original-size').textContent = formatSize(originalSize);
    document.getElementById('stat-output-size').textContent = outputBlob ? formatSize(outputBlob.size) : '—';
    document.getElementById('stat-time').textContent = `${elapsed}s`;

    // Reset convert button
    btnConvert.disabled = false;
    btnConvert.querySelector('.btn-text').textContent = '开始转换';
}

function downloadResult() {
    if (!outputBlob) return;

    const baseName = selectedFile.name.replace(/\.pdf$/i, '');
    const downloadName = `${baseName}_图片版.pdf`;

    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ============ Utilities ============

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showError(message) {
    // Simple alert for now — can be upgraded to toast later
    alert(message);
}


// pdfjsLib 已通过全局 script 标签加载
