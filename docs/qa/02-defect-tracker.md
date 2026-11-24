# Tiny MD (v1.0.2) 全生命周期缺陷台账

> 目标仓库：`E:\AI-train\MD编辑器\tiny-md`  
> 状态说明：全部 13 条缺陷（含 3 个 P0、5 个 P1、4 个 P2、1 个 P3）已 100% 修复并完成自动化回归验证。

| 缺陷ID | 级别 | 所属模块 | 源码位置（文件:行号） | 复现步骤 | 状态 | 关联回归用例ID |
| :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| **BUG-001** | P0 | Electron / 安全 | `electron/main.cjs:57` | `webPreferences.sandbox` 为 `false`，未启用渲染进程沙盒隔离 | 已回归 | `tests/electron/electron.spec.mjs` + 打包成品冒烟测试 |
| **BUG-002** | P0 | Preview / 安全 | `src/utils/markdown.js:92`, `src/components/Preview/Preview.jsx:162` | 自定义样式 `</style><script>` 逃逸及 DOMPurify 未显式禁用高危标签 | 已回归 | `tests/unit/utils.test.js#BUG-002`, `tests/unit/components-core.test.jsx#BUG-002`, `tests/e2e/security-and-perf.spec.js` |
| **BUG-003** | P0 | Electron / 启动与打包 | `electron/main.cjs:85-90`, `package.json:98-115` | 未启动 Vite 时直接 `electron .` 白屏；缺 Windows NSIS 安装包与 `.ico` 图标 | 已回归 | `tests/electron/electron.spec.mjs`, `release/Tiny MD Setup 1.0.2.exe` |
| **BUG-004** | P1 | App & Editor / 快捷键 | `src/App.jsx:755-784`, `src/components/Editor/Editor.jsx:166-170` | Windows `Ctrl+Shift+S` 大写失效；`Ctrl+B/I/K` 未绑定 | 已回归 | `tests/unit/components-modals.test.jsx#BUG-004` |
| **BUG-005** | P1 | YAML / Windows CRLF | `src/utils/yaml.js:23-44` | Windows `\r\n` YAML 解析行尾残留 `\r`、不支持连字符键、`replaceYAML` 丢换行 | 已回归 | `tests/unit/utils.test.js#BUG-005` |
| **BUG-006** | P1 | ImageUpload / 容错 | `src/components/ImageUpload/ImageUpload.jsx:20-58` | 损坏 localStorage 崩溃；浏览器模式批量上传 `imageMap` 剪贴板图片 404 | 已回归 | `tests/unit/components-modals.test.jsx#BUG-006` |
| **BUG-007** | P1 | Preview & Translation | `src/utils/markdown.js`, `src/components/Translation/Translation.jsx:134-141` | 缺 KaTeX 数学公式渲染；翻译面板缺“应用译文”按钮 | 已回归 | `tests/unit/utils.test.js#BUG-007`, `tests/unit/components-modals.test.jsx#BUG-007`, `tests/e2e/app.spec.js` |
| **BUG-008** | P1 | 性能 / 大文档 | `src/components/Editor/Editor.jsx`, `src/App.jsx`, `src/utils/markdown.js` | 1MB 文档敲键同步全量渲染与 Linter 扫描卡顿 | 已回归 | `tests/e2e/security-and-perf.spec.js` (1MB 输入 43.9ms < 50ms) |
| **BUG-009** | P2 | Editor / Linter | `src/components/Editor/Editor.jsx:21-81` | 无序列表 `* item` 与代码块内 `*` 误报斜体未闭合 | 已回归 | `tests/unit/granular-coverage.test.jsx#BUG-009` |
| **BUG-010** | P2 | QuickEdit & Toolbar | `src/components/QuickEdit/QuickEdit.jsx`, `src/components/Toolbar/Toolbar.jsx:94` | 16 个按钮提示未国际化；关于弹窗版本硬编码 `V1.0.0` | 已回归 | `tests/unit/components-core.test.jsx` |
| **BUG-011** | P2 | 体验缺口与兜底 | `src/App.css:83`, `src/main.jsx`, `YAMLTemplateModal.jsx`, `Toolbar.jsx` | 拖拽条被裁、缺 ErrorBoundary、缺模板导入导出/预览 YAML 显隐/HTML 与 PDF 导出 | 已回归 | `tests/unit/granular-coverage.test.jsx`, `tests/e2e/app.spec.js` |
| **BUG-012** | P2 | 构建体积 | `vite.config.js` | 单 JS Chunk 1.03MB 告警 | 已回归 | `npm run build` (178ms, 0 告警) |
| **BUG-013** | P3 | 文档与测试体系 | `README.md`, `docs/manual/README.md`, `docs/qa/` | 缺少测试体系、Windows 安装指南与图文用户手册 | 已回归 | `README.md` 与 `docs/manual/README.md` 已同步更新 |
