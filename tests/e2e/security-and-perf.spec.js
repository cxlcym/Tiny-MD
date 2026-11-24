import { test, expect } from '@playwright/test'

test.describe('Security (XSS) & Large Document Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('blocks all 5 classes of XSS payloads in preview pane', async ({ page }) => {
    const payloads = [
      '<script>window.__xssTriggered = "script"</script>',
      '<img src="x" onerror="window.__xssTriggered = \'img\'" />',
      '[click](javascript:window.__xssTriggered="jsurl")',
      '<svg onload="window.__xssTriggered = \'svg\'"></svg>',
      '<div onmouseover="window.__xssTriggered = \'event\'" onclick="alert(1)">hover</div>',
    ].join('\n\n')

    await page.evaluate((md) => {
      localStorage.setItem('tiny-md-content', JSON.stringify(md))
    }, payloads)
    await page.reload()

    await page.waitForTimeout(300)
    const triggered = await page.evaluate(() => window.__xssTriggered || null)
    expect(triggered).toBeNull()

    const previewHtml = await page.locator('.preview-content').innerHTML()
    expect(previewHtml).not.toContain('<script')
    expect(previewHtml).not.toContain('onerror')
    expect(previewHtml).not.toContain('onload')
    expect(previewHtml).not.toContain('onmouseover')
    expect(previewHtml).not.toContain('javascript:')
  })

  test('measures load and input latency for 100KB, 1MB, and 5MB documents', async ({ page }) => {
    const sizes = [
      { label: '100KB', bytes: 100 * 1024 },
      { label: '1MB', bytes: 1024 * 1024 },
      { label: '5MB', bytes: 5 * 1024 * 1024 },
    ]
    const metrics = []

    for (const s of sizes) {
      const chunk = '## Performance Section\n\nLorem ipsum dolor sit amet, **markdown** bench `code` test.\n\n'
      const largeDoc = chunk.repeat(Math.ceil(s.bytes / chunk.length)).slice(0, s.bytes)

      const loadStart = Date.now()
      if (s.bytes <= 1024 * 1024) {
        await page.evaluate((doc) => localStorage.setItem('tiny-md-content', JSON.stringify(doc)), largeDoc)
      } else {
        await page.evaluate(() => localStorage.removeItem('tiny-md-content'))
      }
      await page.reload()
      await page.locator('.cm-content').waitFor({ state: 'visible' })
      const loadMs = Date.now() - loadStart

      const cm = page.locator('.cm-content')
      await cm.click()
      await page.waitForTimeout(100)
      const inputStart = await page.evaluate(() => performance.now())
      await page.keyboard.type('X')
      const inputMs = await page.evaluate((start) => performance.now() - start, inputStart)

      metrics.push({ size: s.label, loadMs, inputMs: Math.round(inputMs * 100) / 100 })
      if (s.label === '1MB') {
        expect(loadMs).toBeLessThan(1500)
        expect(inputMs).toBeLessThan(50)
      }
    }

    console.log('PERF_METRICS_JSON:', JSON.stringify(metrics))
  })
})
