# Tiny MD (v1.0.2) Windows 桌面端打包与测试验证报告（阶段 4）

> 目标仓库：`E:\AI-train\MD编辑器\tiny-md`  
> 验证日期：2026-11-24  
> 环境：Windows 11 (x64) / OS 10.0.26300 / Node.js v24.14.0 / Electron 41.0.4 / electron-builder 26.8.1

---

## 一、Electron 安全与架构核验

| 检查项 | 源码位置 | 实测结果 | 结论 |
| :--- | :--- | :--- | :---: |
| 渲染进程沙盒 (`sandbox`) | `electron/main.cjs:57` | 已由 `false` 修复为 `true` | ✓ 通过 |
| 上下文隔离 (`contextIsolation`) | `electron/main.cjs:55` | `true`（渲染层 `window.require` 为 `undefined`） | ✓ 通过 |
| 禁用节点集成 (`nodeIntegration`) | `electron/main.cjs:54` | `false`（渲染层 `window.process` 为 `undefined`） | ✓ 通过 |
| 离线/打包入口路径加载 | `electron/main.cjs:86-90` | 优先 `VITE_DEV_SERVER_URL`，否则加载 `../dist/index.html` | ✓ 通过 |
| 文件扩展名白名单防护 | `electron/main.cjs:26-45` | 仅允许 `.md`/`.markdown`/`.txt` 与白名单图片格式读写 | ✓ 通过 |
| Windows 图标嵌入 | `build/icon.ico` | 256×256 32-bit ICO，打包自动嵌入 `.exe` | ✓ 通过 |

---

## 二、桌面端自动化测试与成品冒烟结果

1. **开发态 Electron E2E（`npm run test:electron`）**：**1 / 1 通过（607ms）**，验证四栏布局渲染、沙盒隔离、磁盘读写删 IPC 与零页面异常。
2. **打包成品冒烟测试（`release/win-unpacked/Tiny MD.exe`）**：Playwright `_electron` 实测启动输出 `PACKAGED_SMOKE: {"panels":4,"isElectron":true,"noRequire":true}`，退出码 `0`。

---

## 三、Windows 安装包产物清单与 SHA256 校验值

| 产物文件名 | 类型 | 字节大小 | 体积 | SHA256 校验值 |
| :--- | :--- | :---: | :---: | :--- |
| `release/Tiny MD Setup 1.0.2.exe` | Windows NSIS 安装向导（支持自定义目录/快捷方式/卸载） | 103,629,527 | 98.83 MB | `B4D32CFED09EDF19D71C65CE53AF8D66DF3C30CD5D25B07FA0F5FED6B4475ECF` |
| `release/Tiny MD 1.0.2.exe` | Windows 绿色免安装便携版（Portable x64） | 103,421,115 | 98.63 MB | `F0ABCD54A368CBB279CC9AF3664A6EAB442F500E9931739D7A8143304A8F320B` |
| `release/win-unpacked/Tiny MD.exe` | 解包主程序（已通过真实启动冒烟测试） | 222,910,464 | 212.58 MB | `3F6213665CE358B32DEC0917DD3D988922ABEB319182BB34576B1FCFE5BAB55B` |
