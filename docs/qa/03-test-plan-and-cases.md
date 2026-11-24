# Tiny MD (v1.0.2) 测试计划与测试用例设计文档（阶段 2）

> 目标仓库：`E:\AI-train\MD编辑器\tiny-md`

## 一、测试金字塔架构
1. **单元测试与组件集成测试（Vitest + React Testing Library + jsdom）**：覆盖全部工具函数（`yaml.js`、`i18n.js`、`markdown.js`、`imageUtils.js`）、服务层（`picgo.js`）、自定义 Hooks（`useLocalStorage.js`、`useFileWorkspace.js`、`useTranslationEngines.js`）、全部 12 个 UI 组件与 `App` 集成。目标：有效用例 ≥ 100 条，语句覆盖率 ≥ 85%，分支覆盖率 ≥ 75%。
2. **Web E2E、安全与性能测试（Playwright Chromium）**：覆盖四栏布局与 1280×720 / 1920×1080 零水平溢出、实时预览（Markdown/高亮/KaTeX）、样式切换、文件管理器折叠、YAML 模板、翻译应用、面板拖拽、5 类 XSS 拦截及 100KB/1MB/5MB 性能基准。
3. **Windows Electron 桌面端自动化测试（Playwright `_electron`）**：验证沙盒安全隔离（`sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`）、无页面异常、磁盘文件读写删除 IPC 以及打包成品 `.exe` 真实启动冒烟测试。

## 二、首轮 TDD 红灯基线记录
首轮运行 `npm run test:unit` 共 62 条初始用例，**49 通过 / 13 失败**，精准复现 `BUG-002`（CSS `</style>` 逃逸）、`BUG-004`（Windows `Ctrl+Shift+S`）、`BUG-005`（CRLF YAML 与替换换行）、`BUG-006`（ImageUpload 损坏 JSON 崩溃与 imageMap 读取）、`BUG-007`（缺 KaTeX 与应用译文按钮）、`BUG-010`（QuickEdit 英文硬编码 & Toolbar 版本号 `V1.0.0`）、`BUG-011`（预览 YAML 显隐/模板 JSON 导入导出/导出 HTML/PDF 缺失）。
