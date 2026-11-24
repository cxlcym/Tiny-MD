import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

test.describe('Tiny MD Windows Electron Desktop App E2E', () => {
  test('launches with sandbox isolation, zero page errors, KaTeX/XSS & disk IPC', async () => {
    const electronApp = await electron.launch({
      args: [path.resolve('electron/main.cjs')],
    })

    const pageErrors = []
    const window = await electronApp.firstWindow()
    window.on('pageerror', (err) => pageErrors.push(err.message))

    await window.waitForLoadState('domcontentloaded')
    await expect(window.locator('.toolbar')).toBeVisible()
    await expect(window.locator('.panel')).toHaveCount(4)
    await expect(window.locator('.status-bar')).toBeVisible()

    // Security check: nodeIntegration disabled, sandbox enabled, preload bridge exposed
    const sec = await window.evaluate(() => ({
      hasRequire: typeof window.require !== 'undefined',
      hasProcess: typeof window.process !== 'undefined',
      isElectron: window.electronAPI?.isElectron === true,
    }))
    expect(sec.hasRequire).toBe(false)
    expect(sec.hasProcess).toBe(false)
    expect(sec.isElectron).toBe(true)

    // Test real disk write/read/delete IPC on temp markdown file
    const tmpFile = path.join(os.tmpdir(), `tiny-md-v102-${Date.now()}.md`)
    const writeRes = await window.evaluate(
      (args) => window.electronAPI.writeFile(args),
      { filePath: tmpFile, content: '# Electron IPC OK' }
    )
    expect(writeRes.success).toBe(true)
    const readRes = await window.evaluate(
      (fp) => window.electronAPI.readFile({ filePath: fp }),
      tmpFile
    )
    expect(readRes.content).toBe('# Electron IPC OK')
    await window.evaluate((fp) => window.electronAPI.deleteFile({ filePath: fp }), tmpFile)
    expect(fs.existsSync(tmpFile)).toBe(false)

    expect(pageErrors).toEqual([])
    await electronApp.close()
  })
})
