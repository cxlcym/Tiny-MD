# CLAUDE.md - Tiny MD 开发指南 (V1.0.0)

## 项目概述

Tiny Markdown Editor（Tiny MD）是一款基于 React + Vite 的轻量级且灵活的 Markdown 编辑器，专为开发者设计。支持四栏布局（文件管理器、源码编辑、预览、翻译）、YAML 模板、图床集成和多引擎翻译。

## 技术栈

- **前端框架**: React 18 + Vite
- **编辑器核心**: CodeMirror 6
- **Markdown 解析**: Marked
- **代码高亮**: Highlight.js
- **状态管理**: React Hooks + LocalStorage

## 项目结构

```
tiny-md/
├── src/
│   ├── components/
│   │   ├── Editor/          # CodeMirror 编辑器组件
│   │   ├── Preview/         # Markdown 预览组件（支持自定义样式）
│   │   ├── Translation/     # 翻译面板组件（多引擎支持）
│   │   ├── Toolbar/         # 工具栏组件
│   │   ├── StatusBar/       # 状态栏组件
│   │   ├── QuickEdit/       # 快捷编辑工具栏
│   │   ├── YAMLTemplate/    # YAML 模板管理
│   │   ├── ImageUpload/     # 图片上传组件
│   │   ├── Settings/        # 设置面板组件
│   │   ├── FileManager/     # 文件管理器组件
│   │   ├── StyleSelector/   # 预览样式选择器
│   │   └── ResizablePanels/ # 可调整大小的面板
│   ├── services/
│   │   └── imageUpload/     # 图床服务 (picgo.js)
│   ├── hooks/
│   │   └── useLocalStorage.js  # LocalStorage Hook
│   ├── utils/
│   │   ├── yaml.js          # YAML 处理工具
│   │   └── i18n.js          # 国际化翻译文件
│   ├── App.jsx              # 主应用组件
│   ├── App.css              # 应用样式 (主题变量)
│   └── index.css            # 全局样式
├── package.json
└── vite.config.js
```

## 核心功能模块

### 1. Editor (编辑器)
- 使用 CodeMirror 6 实现
- 支持 Markdown 语法高亮
- 支持语法错误检测 (lint)
- 支持快捷键操作
- 实时同步滚动到预览面板

### 2. Preview (预览)
- 使用 Marked 解析 Markdown
- 支持代码高亮 (Highlight.js)
- 支持本地图片预览 (imageMap)
- 支持实时同步滚动
- 支持 5 种预设样式 + 自定义 CSS 样式

### 3. Translation (翻译)
- 支持 5 种免费翻译 API:
  - Google Translate（非官方）
  - MyMemory（每天 5000 字符）
  - DeepL Free（每月 50 万字符）
  - LibreTranslate（开源自托管）
  - 自定义 LLM（OpenAI 格式）
- 自动过滤 YAML 区块
- 支持自定义翻译提示词

### 4. FileManager (文件管理器)
- 支持打开文件夹（File System Access API）
- 树状结构显示文件夹内容
- 支持文件重命名和删除
- 支持折叠/展开
- 未保存文件标识

### 5. ImageUpload (图床)
- PicGo 本地代理
- Cloudflare R2 支持
- AWS S3 支持
- 剪贴板图片自动转换 WebP

### 6. YAMLTemplate (模板)
- 预设 Hugo/Hexo 模板
- 动态占位符替换
- 模板 CRUD 操作

### 7. StyleSelector (样式选择器)
- 5 种预设样式: Default, GitHub, Notion, Medium, Book
- 支持添加自定义 CSS 样式
- 样式保存到 localStorage

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint
```

## 代码规范

### 组件结构
- 使用函数式组件 + Hooks
- 使用 forwardRef 暴露子组件引用
- 使用 useCallback/useMemo 优化性能

### 样式规范
- 使用 CSS Variables 实现主题切换
- 主题变量定义在 App.css
- 支持 dark/light 两种主题

### 状态管理
- 使用 useLocalStorage 持久化状态
- 关键配置存储在 localStorage

## 主题变量

```css
/* 深色主题 */
.app.dark {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-input: #3c3c3c;
  --text-primary: #d4d4d4;
  --text-secondary: #888;
  --border-color: #333;
  --accent-color: #007acc;
}

/* 浅色主题 */
.app.light {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-input: #ffffff;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
  --accent-color: #0078d4;
}
```

## 国际化

翻译文件位于 `src/utils/i18n.js`，支持：
- `en` - English
- `zh-CN` - 简体中文

使用方式：
```javascript
import { t } from '../../utils/i18n'
const text = t('key', lang)
```

## 本地存储 Keys

| Key | 说明 |
|-----|------|
| `tiny-md-content` | 文档内容 |
| `tiny-md-filename` | 文件名 |
| `tiny-md-config` | 应用配置（含翻译 API 配置） |
| `tiny-md-templates` | YAML 模板 |
| `tiny-md-image-map` | 图片映射表 |
| `tiny-md-style` | 当前预览样式 |
| `tiny-md-custom-styles` | 自定义预览样式 |

## 配置项 (tiny-md-config)

```javascript
{
  language: 'en',                    // 界面语言
  theme: 'dark',                     // 主题
  picgoEndpoint: 'http://127.0.0.1:36677',
  picgoUploadPath: '/upload',
  llmApiKey: '',                     // LLM API 密钥
  llmApiUrl: 'https://api.openai.com/v1/chat/completions',
  llmTranslationPrompt: '',          // 自定义翻译提示词
  deeplApiKey: '',                   // DeepL API 密钥
  libretranslateEndpoint: '',        // LibreTranslate 服务地址
  imageBed: 'picgo',                 // 图床类型
  cloudflareR2: { ... },
  awsS3: { ... }
}
```

## 已知限制

1. File System Access API 需要现代浏览器支持（Chrome, Edge）
2. 图片预览依赖 imageMap 映射
3. 翻译 API 可能有请求限制
4. 部分翻译服务可能需要科学上网

## 后续优化方向

- [ ] 多标签页编辑
- [ ] 文档历史版本
- [ ] 云同步支持
- [ ] 插件系统
- [ ] 协作编辑
- [ ] 导出 PDF/HTML

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 发起 Pull Request

## 许可证

MIT License
