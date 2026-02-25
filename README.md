# PicPDF Web

在线将 PDF 转换为图片版 PDF。纯浏览器端处理，文件不上传到任何服务器。

## 功能

- **PDF → 图片版 PDF**：将 PDF 每一页渲染为图片，重新组装为新的 PDF
- **图片版特性**：输出的 PDF 中文字不可选中、不可复制
- **隐私安全**：所有处理在浏览器本地完成，文件不离开你的设备
- **可调参数**：支持 150/200/300 DPI 和 50-100% 质量范围
- **拖拽上传**：支持拖拽文件或点击选择

## 技术栈

- 原生 HTML/CSS/JS（无框架）
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF 渲染
- [jsPDF](https://github.com/parallax/jsPDF) — PDF 生成
- Vercel 静态部署

## 本地运行

在项目目录下启动任意 HTTP 服务器，例如：

```bash
npx serve .
# 或
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`（或对应端口）。

> ⚠️ 不能直接用 `file://` 协议打开，因为 pdf.js 的 Worker 需要 HTTP 环境。

## 部署到 Vercel

1. 将此目录推送到 GitHub 仓库
2. 在 [Vercel](https://vercel.com) 导入该仓库
3. 无需任何配置，直接部署

## 项目结构

```
PicPDF-Web/
├── index.html      # 页面
├── style.css       # 样式
├── app.js          # 核心逻辑
├── vercel.json     # Vercel 配置
└── README.md
```

## 许可证

MIT
