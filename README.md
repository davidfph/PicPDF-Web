# PicPDF Web

> 在线将 PDF 转换为图片版 PDF — 文字不可选中、不可复制。
>
> 🔗 **在线体验**: [pic-pdf.vercel.app](https://pic-pdf.vercel.app)

---

## 这个工具做什么？

将普通 PDF 的每一页渲染为图片，再重新组装成新的 PDF。输出的 PDF 看起来和原件一样，但**文字已变成图片**，无法选中、复制或搜索。

适用场景：
- 发送合同/报价单等敏感文档，防止内容被直接复制
- 提交不希望被文字提取的文件

## 核心原则：文件不离开你的电脑

**PicPDF 没有后端服务器。** 整个转换过程 100% 在你的浏览器中完成：

```
你的 PDF 文件
    ↓  (读取到浏览器内存)
浏览器用 pdf.js 将每页渲染为图片
    ↓
浏览器用 jsPDF 将图片组装为新 PDF
    ↓
你下载新文件
```

- ❌ 文件不会上传到任何服务器
- ❌ 没有后端 API、没有数据库、没有日志
- ❌ 网站本身不存储任何数据（无 Cookie、无 localStorage）
- ✅ 断网后依然可以使用（仅首次加载需要网络）

你可以打开浏览器的开发者工具（Network 标签页），观察整个转换过程中**没有任何网络请求离开你的设备**。

## 技术实现

这是一个纯静态网站，只有 4 个文件：

| 文件 | 作用 |
|------|------|
| `index.html` | 页面结构 |
| `style.css` | 样式（暗色主题、响应式布局） |
| `app.js` | 核心逻辑（~250 行） |
| `favicon.svg` | 图标 |

### 依赖库（通过 CDN 加载）

- **[pdf.js](https://mozilla.github.io/pdf.js/)** (Mozilla) — 在 Canvas 上渲染 PDF 页面
- **[jsPDF](https://github.com/parallax/jsPDF)** — 将图片组装为 PDF

### 转换流程

1. 用户选择 PDF 文件（支持多文件）
2. `FileReader` 读取文件为 `ArrayBuffer`
3. `pdf.js` 解析 PDF，逐页渲染到 `<canvas>`（按用户选择的 DPI 缩放）
4. `canvas.toDataURL('image/jpeg', quality)` 将每页导出为 JPEG
5. `jsPDF` 创建新 PDF，将 JPEG 图片逐页写入
6. `pdf.output('blob')` 生成最终文件，通过 `<a download>` 触发下载

### 可调参数

- **DPI**（150 / 200 / 300）：控制渲染分辨率，DPI 越高清晰度越好但文件越大
- **JPEG 质量**（50%-100%）：控制图片压缩程度

## 本地运行

```bash
# 任意 HTTP 服务器均可
npx serve .
# 或
python3 -m http.server 8080
```

> ⚠️ 不能直接用 `file://` 协议打开，pdf.js 的 Worker 需要 HTTP 环境。

## 部署

项目是纯静态文件，可部署到任意静态托管：

- **Vercel**: 导入 GitHub 仓库，零配置部署
- **GitHub Pages / Netlify / Cloudflare Pages**: 同理

## 许可证

MIT
