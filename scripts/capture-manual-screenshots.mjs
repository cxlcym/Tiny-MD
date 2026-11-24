import { chromium } from '@playwright/test'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const outDir = path.resolve('docs/manual/assets')
fs.mkdirSync(outDir, { recursive: true })

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Preview server did not start in time')
}

async function main() {
  const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4180'], {
    shell: true,
    stdio: 'ignore',
  })

  try {
    const baseUrl = 'http://127.0.0.1:4180'
    await waitForServer(baseUrl)

    const browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()

    const demoDoc = `---
title: Tiny MD Windows 使用指南示例
date: 2026-11-24
tags: [Markdown, Windows, Electron]
categories: [技术文档]
description: Tiny MD 四栏桌面端核心功能演示文档
---

# 欢迎使用 Tiny MD v1.0.2

Tiny MD 是一款轻量灵活的**四栏智能 Markdown 编辑器**（文件管理 / 源码 / 预览 / 翻译）。

## 数学公式与代码高亮

行内公式：$E = mc^2$，块级公式：

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`
}
\`\`\`

| 功能模块 | 状态 |
| :--- | :---: |
| 四栏布局 & 文件树 | 已支持 |
| KaTeX 公式 & 代码高亮 | 已支持 |
| DOMPurify + Electron 沙盒 | 已支持 |
`

    await page.goto(baseUrl)
    await page.evaluate((doc) => {
      localStorage.setItem('tiny-md-content', JSON.stringify(doc))
      localStorage.setItem('tiny-md-filename', JSON.stringify('guide-demo.md'))
      localStorage.setItem('tiny-md-config', JSON.stringify({
        language: 'zh-CN',
        theme: 'dark',
        picgoEndpoint: 'http://127.0.0.1:36677',
        picgoUploadPath: '/upload',
        llmApiKey: '',
        llmApiUrl: 'https://api.openai.com/v1/chat/completions',
        imageBed: 'picgo',
      }))
    }, demoDoc)
    await page.reload()
    await page.waitForTimeout(400)

    // 1. 深色四栏主界面
    await page.screenshot({ path: path.join(outDir, '01-dark-four-pane.png') })

    // 2. 翻译结果区演示
    await page.route('https://translate.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([[['# Welcome to Tiny MD v1.0.2\n\nTiny MD is a lightweight four-pane Markdown editor.', '']]]),
      })
    })
    await page.locator('.translation-select').nth(1).selectOption('en')
    await page.locator('.translation-btn').click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(outDir, '02-translation-panel.png') })

    // 3. YAML 模板管理弹窗
    await page.locator('.toolbar').getByRole('button', { name: /YAML/ }).click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(outDir, '03-yaml-template-modal.png') })
    await page.locator('.modal-content .close-btn').click()

    // 4. PicGo 图片上传弹窗
    await page.locator('.toolbar').getByRole('button', { name: /PicGo/ }).click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(outDir, '04-image-upload-modal.png') })
    await page.locator('.image-upload-modal .close-btn').click()

    // 5. 设置面板弹窗
    await page.locator('.settings-btn').click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(outDir, '05-settings-modal.png') })

    // 6. 切换浅色主题并截浅色四栏界面
    await page.locator('.settings-modal').getByRole('button', { name: /浅色/ }).click()
    await page.locator('.settings-modal .save-btn').click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(outDir, '06-light-four-pane.png') })

    await browser.close()
    console.log('Captured 6 manual screenshots in docs/manual/assets/')
  } finally {
    server.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
