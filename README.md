# Tiny-MD - 轻量级 Markdown 编辑器 (V1.0.0)

<div align="center">

![Tiny MD Logo](https://img.shields.io/badge/Tiny%20MD-Markdown%20Editor-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

一款轻量级且灵活的 Markdown 编辑器，支持 Web 版和桌面版

[功能特性](#功能特性) • [下载安装](#-下载安装) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [快捷键](#️-快捷键)

</div>

---

## 📖 简介

Tiny Markdown Editor（Tiny MD）是一款轻量级且灵活的 Markdown 编辑器，支持四栏布局（文件管理器/源码/预览/翻译）、YAML 模板系统、多图床集成、五种翻译引擎、自定义预览样式等功能。提供 **Web 版**和**桌面版（Electron）**两种形态，适用于技术文档编写、博客发布和 README 维护场景。

### 🖥️ 桌面版特性

桌面版基于 Electron 构建，相比 Web 版具有以下优势：
- **本地文件系统访问**：无需依赖 File System Access API
- **图片粘贴优化**：粘贴图片时弹出保存对话框，用户选择位置后自动插入 Markdown 格式
- **更好的性能**：优化的内存管理和窗口关闭逻辑

## ✨ 功能特性

### 📝 基础编辑
- ✅ 四栏布局（文件管理器/源码/预览/翻译）
- ✅ 实时 Markdown 预览与同步滚动
- ✅ 语法高亮显示
- ✅ 代码块语法高亮（支持多种语言）
- ✅ LaTeX 数学公式渲染
- ✅ 快捷编辑工具栏
- ✅ Markdown 语法错误检测

### 📁 文件管理器
- ✅ 打开文件夹（树状结构显示）
- ✅ 文件重命名和删除
- ✅ 折叠/展开文件夹
- ✅ 未保存文件标识
- ✅ 新建/打开单个文件

### 🎨 预览样式
- ✅ 5 种预设样式（Default, GitHub, Notion, Medium, Book）
- ✅ 支持自定义 CSS 样式
- ✅ 深色/浅色主题切换
- ✅ 响应式布局

### 🌍 多语言支持
- ✅ 中文/英文界面切换
- ✅ 国际化 i18n 支持

### 📋 YAML 模板系统
- ✅ 预设多个模板（Hugo、Hexo 等）
- ✅ 动态占位符自动填充
- ✅ 模板增删改查
- ✅ 一键插入/更新 YAML Front-matter

### 🖼️ 图床集成
- ✅ PicGo 本地服务代理
- ✅ Cloudflare R2 支持
- ✅ AWS S3 支持
- ✅ 批量上传本地图片
- ✅ 剪贴板图片粘贴自动转换 WebP

### 🌐 多引擎翻译
- ✅ Google Translate（免费，非官方）
- ✅ MyMemory（免费，每天 5000 字符）
- ✅ DeepL Free（免费，每月 50 万字符）
- ✅ LibreTranslate（开源自托管）
- ✅ 自定义 LLM（支持 OpenAI 格式）
- ✅ 自定义翻译提示词
- ✅ 自动过滤 YAML 区块

### 📄 文件操作
- ✅ 新建/打开/保存文档
- ✅ 另存为功能
- ✅ 未保存文件提醒
- ✅ 自动保存草稿（本地存储）

### 🔧 其他功能
- ✅ 面板自由拖动调整大小
- ✅ 源码与预览实时同步滚动
- ✅ 字数统计
- ✅ 光标位置显示

---

## 📥 下载安装

### 桌面版（推荐）

直接下载便携版，无需安装：

| 平台 | 下载 |
|------|------|
| Windows | [Tiny MD 1.0.0.exe](release/Tiny%20MD%201.0.0.exe) |

> 桌面版特性：
> - 便携版，下载后双击即可运行
> - 图片粘贴时弹出保存对话框，选择位置后自动插入 Markdown 格式
> - 支持本地文件系统完整访问

### Web 版

如果只需要 Web 版，可以克隆项目后自行构建：

```bash
git clone https://github.com/your-username/tiny-md.git
cd tiny-md
npm install
npm run build
```

构建后的文件在 `dist` 目录中。

---

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0
- npm 或 yarn

### 安装

```bash
# 克隆项目
git clone https://github.com/your-username/tiny-md.git

# 进入项目目录
cd tiny-md

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 访问

开发服务器启动后，访问 `http://localhost:5173`

---

## 📖 使用指南

### 基础操作

| 操作 | 说明 |
|------|------|
| 新建文档 | 点击 `+ 新建` 按钮或按 `Ctrl+N` |
| 打开文档 | 点击 `📂 打开` 按钮或按 `Ctrl+O` |
| 保存文档 | 点击 `💾 保存` 按钮或按 `Ctrl+S` |
| 另存为 | 点击 `📄 另存为` 按钮或按 `Ctrl+Shift+S` |

### 文件管理器

| 操作 | 说明 |
|------|------|
| 打开文件夹 | 点击文件夹图标，选择文件夹 |
| 折叠面板 | 点击面板标题栏 |
| 重命名文件 | 悬停文件，点击编辑图标 |
| 删除文件 | 悬停文件，点击删除图标 |

### YAML 模板

1. 点击工具栏的 `YAML` 按钮
2. 选择预设模板或创建新模板
3. 模板支持以下占位符：
   - `{{title}}` - 文档标题
   - `{{date}}` - 当前日期
   - `{{time}}` - 时间戳
   - `{{datetime}}` - 日期时间
   - `{{image}}` - 封面图路径
   - `{{category}}` - 分类
   - `{{tags}}` - 标签

### 预览样式

1. 点击工具栏的 `🎨 样式` 按钮
2. 选择预设样式或添加自定义 CSS
3. 样式会保存到本地存储

### 图片上传

1. **PicGo 上传**
   - 点击工具栏的 `PicGo` 按钮
   - 配置 PicGo 服务地址（默认 `http://127.0.0.1:36677`）
   - 点击"批量上传本地图片"扫描并上传文章中的本地图片

2. **剪贴板粘贴**
   - 复制图片到剪贴板
   - 在编辑器中按 `Ctrl+V`
   - **桌面版**：弹出保存对话框，选择位置后自动插入 `![image](path)`
   - **Web 版**：图片自动转换为 WebP 并下载，插入本地路径引用

### 翻译功能

1. 在翻译面板选择翻译引擎
2. 选择目标语言
3. 点击"翻译"按钮
4. 翻译完成后点击"应用"替换原文

### LLM 翻译配置

在设置面板配置自定义 LLM API：
- API Key：OpenAI 或兼容 API 的密钥
- API URL：API 端点地址
- 翻译提示词：可自定义 system prompt，使用 `{{targetLanguage}}` 占位符

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文档 |
| `Ctrl+O` | 打开文档 |
| `Ctrl+S` | 保存文档 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Ctrl+B` | 加粗 |
| `Ctrl+I` | 斜体 |
| `Ctrl+K` | 插入链接 |
| `Ctrl+Shift+Y` | YAML 模板 |
| `Ctrl+Shift+P` | PicGo 上传 |

---

## 🛠️ 技术栈

- **前端框架**: React 18 + Vite
- **桌面框架**: Electron 41
- **编辑器核心**: CodeMirror 6
- **Markdown 解析**: Marked
- **代码高亮**: Highlight.js
- **样式**: CSS Variables

---

## 📁 项目结构

```
tiny-md/
├── electron/
│   ├── main.cjs             # Electron 主进程
│   └── preload.cjs          # Electron 预加载脚本
├── src/
│   ├── components/
│   │   ├── Editor/          # CodeMirror 编辑器
│   │   ├── Preview/         # Markdown 预览（支持自定义样式）
│   │   ├── Translation/     # 翻译面板（多引擎支持）
│   │   ├── Toolbar/         # 工具栏
│   │   ├── StatusBar/       # 状态栏
│   │   ├── QuickEdit/       # 快捷编辑工具栏
│   │   ├── YAMLTemplate/    # YAML 模板管理
│   │   ├── ImageUpload/     # 图片上传
│   │   ├── Settings/        # 设置面板
│   │   ├── FileManager/     # 文件管理器
│   │   └── StyleSelector/   # 预览样式选择器
│   ├── services/
│   │   └── imageUpload/     # 图床服务
│   ├── hooks/               # 自定义 Hooks
│   ├── utils/               # 工具函数
│   ├── App.jsx              # 主应用组件
│   ├── App.css              # 应用样式
│   └── index.css            # 全局样式
├── release/                 # 桌面版构建产物
│   └── Tiny MD 1.0.0.exe   # Windows 便携版
├── public/                  # 静态资源
├── package.json
└── vite.config.js
```

---

## 🔧 配置说明

### 图床配置

在设置面板可以配置以下图床：

| 类型 | 说明 |
|------|------|
| PicGo 服务 | 本地代理服务，需安装 PicGo |
| Cloudflare R2 | 需配置 Account ID、Access Key、Bucket |
| AWS S3 | 需配置 Access Key、Bucket、Region |

### 翻译 API 配置

| 引擎 | 免费额度 | 配置要求 |
|------|----------|----------|
| Google Translate | 无限制（非官方） | 无需配置 |
| MyMemory | 每天 5000 字符 | 无需配置 |
| DeepL Free | 每月 50 万字符 | 需要 API Key |
| LibreTranslate | 无限制（自托管） | 可配置服务地址 |
| 自定义 LLM | 取决于 API | 需要 API Key 和 URL |

### 浏览器兼容性

| 功能 | Chrome | Edge | Firefox | Safari |
|------|--------|------|---------|--------|
| 基础编辑 | ✅ | ✅ | ✅ | ✅ |
| 打开文件夹 | ✅ | ✅ | ❌ | ❌ |
| 文件保存 | ✅ | ✅ | ❌ | ❌ |

> 注：打开文件夹和文件保存功能需要 File System Access API 支持

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📧 联系方式

如有问题或建议，请提交 Issue。

---

<div align="center">

Made with ❤️ jack Cao
Powerby OpenCode + MiMo V2 Pro

</div>
