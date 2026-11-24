import { test, expect } from '@playwright/test'

test.describe('Tiny MD v1.0.2 Web E2E Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('renders four-pane layout with zero horizontal overflow at 1280x720 and 1920x1080', async ({ page }) => {
    for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(vp)
      await expect(page.locator('.toolbar')).toBeVisible()
      await expect(page.locator('.panel')).toHaveCount(4)
      await expect(page.locator('.status-bar')).toBeVisible()

      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(hasOverflow, `Horizontal overflow at ${vp.width}x${vp.height}`).toBe(false)
    }
  })

  test('edits markdown in CodeMirror and renders live preview (headings, code highlight, KaTeX)', async ({ page }) => {
    const editor = page.locator('.cm-content')
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('# Live Heading\n\nInline $E=mc^2$\n\n```js\nconst x = 10;\n```')

    const preview = page.locator('.preview-content')
    await expect(preview.locator('h1')).toHaveText('Live Heading')
    await expect(preview.locator('.katex').first()).toBeVisible()
    await expect(preview.locator('pre code .hljs-keyword').first()).toBeVisible()
  })

  test('switches language to zh-CN and theme to light via Settings modal', async ({ page }) => {
    await page.locator('.settings-btn').click()
    const modal = page.locator('.settings-modal')
    await expect(modal).toBeVisible()

    await modal.locator('select').first().selectOption('zh-CN')
    await modal.getByRole('button', { name: /Light|浅色/ }).click()
    await modal.locator('.save-btn').click()

    await expect(page.locator('.app')).toHaveClass(/light/)
    await expect(page.locator('.panel-header').nth(1)).toContainText('源码')
    await expect(page.locator('.panel-header').nth(2)).toContainText('预览')
    await expect(page.locator('.panel-header').nth(3)).toContainText('翻译')
  })

  test('switches preview style and collapses/expands FileManager', async ({ page }) => {
    await page.locator('.style-trigger').click()
    await page.locator('.style-item', { hasText: 'GitHub' }).click()
    const styleText = await page.locator('.preview-container style').textContent()
    expect(styleText).toContain('.markdown-body')

    await page.locator('.file-manager .header-content').click()
    await expect(page.locator('.file-manager')).toHaveClass(/collapsed/)
    await page.locator('.file-manager .collapsed-header').click()
    await expect(page.locator('.file-manager')).not.toHaveClass(/collapsed/)
  })

  test('applies YAML template and translates with Apply back to editor', async ({ page }) => {
    await page.locator('.toolbar').getByRole('button', { name: /YAML/ }).click()
    await page.locator('.action-btn.apply').first().click()
    await expect(page.locator('.cm-content')).toContainText('title: untitled')

    await page.route('https://translate.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([[['# 你好 Tiny MD', '# Hello Tiny MD']]]),
      })
    })
    await page.locator('.translation-btn').click()
    await expect(page.locator('.translation-output')).toContainText('你好 Tiny MD')
    await page.locator('.apply-btn').click()
    await expect(page.locator('.cm-content')).toContainText('# 你好 Tiny MD')
  })

  test('drags panel resize handle smoothly', async ({ page }) => {
    const handle = page.locator('.resize-handle').nth(1)
    const box = await handle.boundingBox()
    const beforeWidth = (await page.locator('.panel').nth(1).boundingBox()).width

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()

    const afterWidth = (await page.locator('.panel').nth(1).boundingBox()).width
    expect(afterWidth).toBeGreaterThan(beforeWidth + 20)
  })
})
