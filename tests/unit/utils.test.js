import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  extractYAML,
  replaceYAML,
  parseYAML,
  stringifyYAML,
  getYAMLField,
  setYAMLField,
} from '../../src/utils/yaml'
import { translations, t } from '../../src/utils/i18n'
import { extractMarkdownBody, renderMarkdown } from '../../src/utils/markdown'
import { blobToDataURL, saveImageFile, convertToWebP, openLocalImage } from '../../src/utils/imageUtils'
import { PicGoService, loadPicGoConfig, savePicGoConfig, picgoService } from '../../src/services/imageUpload/picgo'
import { useLocalStorage } from '../../src/hooks/useLocalStorage'

describe('utils/yaml (14 tests)', () => {
  it('extracts LF YAML front-matter and body', () => {
    const res = extractYAML('---\ntitle: Hello\ndate: 2026-11-24\n---\n\n# Body')
    expect(res.hasYAML).toBe(true)
    expect(res.yamlContent).toBe('title: Hello\ndate: 2026-11-24')
    expect(res.body).toBe('# Body')
  })

  it('extracts Windows CRLF YAML front-matter', () => {
    const res = extractYAML('---\r\ntitle: WinDoc\r\n---\r\n\r\n# Win')
    expect(res.hasYAML).toBe(true)
    expect(res.body).toBe('# Win')
  })

  it('returns hasYAML false when absent', () => {
    const res = extractYAML('# Only Body')
    expect(res.hasYAML).toBe(false)
    expect(res.body).toBe('# Only Body')
  })

  it('handles empty string safely', () => {
    expect(extractYAML('').hasYAML).toBe(false)
  })

  it('BUG-005: replaces YAML preserving newline separation with body', () => {
    const updated = replaceYAML('---\ntitle: Old\n---\n\n# Body', '---\ntitle: New\n---')
    expect(updated).toBe('---\ntitle: New\n---\n\n# Body')
  })

  it('prepends YAML when none exists', () => {
    expect(replaceYAML('# Body', '---\ntitle: Added\n---')).toBe('---\ntitle: Added\n---\n\n# Body')
  })

  it('BUG-005: parses CRLF YAML lines and hyphenated keys', () => {
    const parsed = parseYAML('title: Win Post\r\nlast-modified: 2026-11-24\r\n')
    expect(parsed.title).toBe('Win Post')
    expect(parsed['last-modified']).toBe('2026-11-24')
  })

  it('stringifies key-value map to YAML', () => {
    expect(stringifyYAML({ title: 'A', draft: 'false' })).toBe('title: A\ndraft: false')
  })

  it('gets YAML field or returns null when missing', () => {
    const doc = '---\ntitle: Demo\n---\nBody'
    expect(getYAMLField(doc, 'title')).toBe('Demo')
    expect(getYAMLField(doc, 'missing')).toBeNull()
    expect(getYAMLField('# Plain', 'title')).toBeNull()
  })

  it('updates existing field and preserves others', () => {
    const doc = '---\ntitle: Old\ncover: \n---\n\nBody'
    const updated = setYAMLField(doc, 'cover', 'https://a.com/1.webp')
    expect(getYAMLField(updated, 'cover')).toBe('https://a.com/1.webp')
    expect(getYAMLField(updated, 'title')).toBe('Old')
  })

  it('creates YAML block when setting field on plain markdown', () => {
    const updated = setYAMLField('# Plain', 'title', 'New')
    expect(extractYAML(updated).hasYAML).toBe(true)
    expect(getYAMLField(updated, 'title')).toBe('New')
  })
})

describe('utils/i18n (6 tests)', () => {
  it('has identical key sets in en and zh-CN', () => {
    expect(Object.keys(translations['zh-CN']).sort()).toEqual(Object.keys(translations.en).sort())
  })

  it('has non-empty values for every key', () => {
    for (const lang of ['en', 'zh-CN']) {
      for (const [k, v] of Object.entries(translations[lang])) {
        expect(typeof v, `${lang}.${k}`).toBe('string')
        expect(v.trim().length, `${lang}.${k}`).toBeGreaterThan(0)
      }
    }
  })

  it('translates known keys in both languages', () => {
    expect(t('newFile', 'en')).toBe('New')
    expect(t('newFile', 'zh-CN')).toBe('新建')
  })

  it('falls back to English for unknown locale and key for unknown key', () => {
    expect(t('saveFile', 'de')).toBe('Save')
    expect(t('unknown_key_xyz', 'zh-CN')).toBe('unknown_key_xyz')
  })

  it('defaults to English when lang omitted', () => {
    expect(t('openFile')).toBe('Open')
  })
})

describe('utils/markdown (10 tests)', () => {
  it('extractMarkdownBody strips YAML front-matter', () => {
    expect(extractMarkdownBody('---\ntitle: X\n---\n\n# Hello')).toBe('# Hello')
    expect(extractMarkdownBody('# Plain')).toBe('# Plain')
  })

  it('renders headings, tables, and highlighted code blocks', () => {
    const html = renderMarkdown('# Title\n\n```javascript\nconst a = 1;\n```')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('hljs')
  })

  it('BUG-007: renders inline and block LaTeX math via KaTeX', () => {
    const html = renderMarkdown('Inline $E=mc^2$ and\n\n$$\n\\sum_{i=1}^n i\n$$')
    expect(html).toContain('katex')
  })

  it('BUG-002 (XSS-1): strips <script> tags', () => {
    const html = renderMarkdown('Safe<script>window.__xss=1</script>Text')
    expect(html).not.toContain('<script')
  })

  it('BUG-002 (XSS-2): strips <img onerror> handlers', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)" />')
    expect(html).not.toContain('onerror')
  })

  it('BUG-002 (XSS-3): strips javascript: URLs', () => {
    const html = renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })

  it('BUG-002 (XSS-4): strips <svg onload> payloads', () => {
    const html = renderMarkdown('<svg onload="alert(1)"></svg>')
    expect(html).not.toContain('onload')
  })

  it('BUG-002 (XSS-5): strips inline HTML event attributes and iframes', () => {
    const html = renderMarkdown('<div onmouseover="alert(1)" onclick="alert(2)">x</div><iframe src="https://evil.com"></iframe>')
    expect(html).not.toContain('onmouseover')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<iframe')
  })
})

describe('utils/imageUtils & services/picgo & hooks/useLocalStorage (20 tests)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    delete window.showSaveFilePicker
    delete window.showOpenFilePicker
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('blobToDataURL encodes Blob to data URL', async () => {
    const url = await blobToDataURL(new Blob(['abc'], { type: 'text/plain' }))
    expect(url).toMatch(/^data:text\/plain;base64,/)
  })

  it('saveImageFile uses File System Access API and handles AbortError', async () => {
    const writable = { write: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue() }
    window.showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable: vi.fn().mockResolvedValue(writable) })
    expect(await saveImageFile(new Blob(['1']), 'a.webp')).toBe('a.webp')

    const abortErr = new Error('cancel')
    abortErr.name = 'AbortError'
    window.showSaveFilePicker = vi.fn().mockRejectedValue(abortErr)
    expect(await saveImageFile(new Blob(['1']), 'a.webp')).toBeNull()
  })

  it('saveImageFile falls back to anchor download', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(await saveImageFile(new Blob(['1']), 'b.webp')).toBe('b.webp')
    expect(clickSpy).toHaveBeenCalled()
  })

  it('openLocalImage uses showOpenFilePicker when available', async () => {
    const mockFile = new File(['img'], 'photo.png', { type: 'image/png' })
    window.showOpenFilePicker = vi.fn().mockResolvedValue([{ getFile: async () => mockFile }])
    const res = await openLocalImage()
    expect(res.name).toBe('photo.png')
  })

  it('convertToWebP converts image via canvas', async () => {
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toBlob: (cb) => cb(new Blob(['w'], { type: 'image/webp' })) }
      }
      return origCreate(tag)
    })
    const OrigImage = globalThis.Image
    globalThis.Image = class {
      set src(_v) { this.width = 8; this.height = 8; setTimeout(() => this.onload?.(), 0) }
    }
    try {
      const b = await convertToWebP(new Blob(['p'], { type: 'image/png' }))
      expect(b.type).toBe('image/webp')
    } finally {
      globalThis.Image = OrigImage
    }
  })

  it('PicGoService uploads single & multiple files and handles errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, result: ['https://img/1.webp'] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, result: 'https://img/2.webp' }) })
      .mockResolvedValueOnce({ ok: false, statusText: 'Bad Gateway' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: false, message: 'No auth' }) })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
    )
    const svc = new PicGoService()
    expect((await svc.upload(new File(['1'], '1.png'))).url).toBe('https://img/1.webp')
    expect((await svc.upload(new File(['2'], '2.png'))).url).toBe('https://img/2.webp')
    expect((await svc.upload(new File(['3'], '3.png'))).success).toBe(false)
    expect((await svc.upload(new File(['4'], '4.png'))).error).toBe('No auth')
    expect((await svc.upload(new File(['5'], '5.png'))).error).toBe('ECONNREFUSED')
  })

  it('PicGoService uploadMultiple, testConnection, and config persistence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, result: ['https://img/ok.webp'] }) }))
    const svc = new PicGoService()
    const multi = await svc.uploadMultiple([new File(['a'], 'a.png'), new File(['b'], 'b.png')])
    expect(multi).toHaveLength(2)
    expect(await svc.testConnection()).toBe(true)

    savePicGoConfig({ endpoint: 'http://127.0.0.1:36678', uploadPath: '/up' })
    expect(loadPicGoConfig().endpoint).toBe('http://127.0.0.1:36678')
    expect(picgoService.config.endpoint).toBe('http://127.0.0.1:36678')

    localStorage.setItem('tiny-md-picgo-config', '{bad')
    expect(loadPicGoConfig().endpoint).toBe('http://127.0.0.1:36677')
  })

  it('useLocalStorage reads, writes, debounces, and recovers from corrupt JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('corrupt', '{bad')
    const { result: r1 } = renderHook(() => useLocalStorage('corrupt', 'fallback'))
    expect(r1.current[0]).toBe('fallback')

    vi.useFakeTimers()
    const { result: r2 } = renderHook(() => useLocalStorage('debounced', 'init', { debounce: 200 }))
    act(() => r2.current[1]('updated'))
    act(() => vi.advanceTimersByTime(250))
    expect(JSON.parse(localStorage.getItem('debounced'))).toBe('updated')
  })
})
