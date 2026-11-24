# Tiny MD (v1.0.2) 基线质量评估与需求追溯矩阵报告（阶段 1）

> 评估日期：2026-11-24  
> 目标仓库：`E:\AI-train\MD编辑器\tiny-md`  
> 评估环境：Windows 11 (x64) / Node.js v24.14.0 / npm 11.9.0

---

## 一、执行摘要与基线状态

| 基线检查项 | 实测结果 | 详细说明 |
| :--- | :--- | :--- |
| **ESLint (`npm run lint`)** | **通过（0 Error）** | 当前规则仅覆盖 `src/` 基础 lint，不含测试/Electron 目录 |
| **生产构建 (`npm run build`)** | **通过（带体积告警）** | 99 modules，构建耗时 263ms；单 JS Chunk 达 `1,037.49 kB`（gzip `337.81 kB`），触发 Vite 500kB 警告 |
| **自动化测试体系** | **缺失（0 用例）** | 无 Vitest / React Testing Library / Playwright / Electron 自动化测试 |
| **Windows 桌面端打包** | **仅便携版** | `package.json` 仅配置 `portable`，缺少 NSIS 安装向导（`.exe` Setup）与自定义图标 `build/icon.ico`；Electron `sandbox: false` 存在安全隐患 |
| **用户手册** | **缺失** | 仅根目录有基础 `README.md`，无面向 Windows 用户的详细图文操作手册 |

---

## 二、需求追溯矩阵（RTM）

| 需求编号 | 核心功能点 | 当前状态 | 源码定位（文件:行号） | 缺口说明 |
| :--- | :--- | :---: | :--- | :--- |
| **REQ-01** | 四栏布局（文件管理/源码/预览/翻译）与拖拽 | 已实现 | `src/App.jsx:769-856` | 支持折叠文件管理器与拖拽，需验证 1280×720/1920×1080 零溢出 |
| **REQ-02** | CodeMirror 6 编辑、语法检测与快捷键 | 部分实现 | `src/components/Editor/Editor.jsx:15-165`, `src/App.jsx:721-749` | `Ctrl+Shift+S` 在 Windows 大写失效；`Ctrl+B/I/K` 未绑定；Linter 误报无序列表 `*` |
| **REQ-03** | 实时预览、代码高亮、样式切换与 LaTeX 公式 | 部分实现 | `src/components/Preview/Preview.jsx:66-169`, `src/utils/markdown.js:58-93` | 离线高亮已实现，但缺少 LaTeX 数学公式渲染、缺少预览区 YAML 显隐切换 |
| **REQ-04** | 多引擎翻译（Google/MyMemory/DeepL/LibreTranslate/LLM） | 部分实现 | `src/components/Translation/Translation.jsx:8-144`, `src/hooks/useTranslationEngines.js:1-210` | 缺少一键“应用译文”按钮（i18n 已有 `applyTranslation` 但 UI 未实现） |
| **REQ-05** | YAML 模板 CRUD 与导入/导出 | 部分实现 | `src/components/YAMLTemplate/YAMLTemplateModal.jsx`, `src/utils/yaml.js:1-71` | `parseYAML` 未处理 CRLF 行尾与连字符键；缺少模板 JSON 导入/导出 |
| **REQ-06** | 图片粘贴转 WebP、本地插图与 PicGo 批量上传 | 部分实现 | `src/components/ImageUpload/ImageUpload.jsx:18-136`, `src/utils/imageUtils.js:1-160` | `ImageUpload` 解析 `localStorage` 无 `try/catch`；未回退读取 `imageMap` 剪贴板图 |
| **REQ-07** | 文件工作区管理（多文件/文件夹/重命名/删除） | 已实现 | `src/hooks/useFileWorkspace.js:1-349`, `src/components/FileManager/FileManager.jsx:1-345` | 需补充全覆盖单元测试与 Electron IPC 集成测试 |
| **REQ-08** | 安全性（Electron 沙盒 + XSS / CSS 注入防护） | 部分实现 | `electron/main.cjs:53-58`, `src/components/Preview/Preview.jsx:162`, `src/utils/markdown.js:92` | `sandbox: false` 未开启沙盒；自定义 `<style>` 未净化；DOMPurify 未显式禁用高危标签 |
| **REQ-09** | 大文档性能（1MB 加载 < 1s、输入 < 50ms） | 未达标 | `src/App.jsx:171-185,805-832`, `src/components/Editor/Editor.jsx:15-72,158-165` | 1MB 文档每次敲键同步全量渲染与 Linter 扫描，易产生明显卡顿 |
| **REQ-10** | 文档导出（HTML / PDF）与异常兜底 | 未实现 | — | 无导出 HTML/PDF 按钮，无 React `ErrorBoundary` |
| **REQ-11** | Windows 桌面端完整安装包与自动化验证 | 部分实现 | `package.json:52-101`, `electron/main.cjs:85-89` | 缺少 NSIS Setup 安装程序与 `.ico` 图标；未打包态直接 `electron .` 会连 `localhost:5173` 失败 |
