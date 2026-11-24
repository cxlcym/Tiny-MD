import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileWorkspace } from '../../src/hooks/useFileWorkspace'
import { useTranslationEngines } from '../../src/hooks/useTranslationEngines'

describe('hooks/useFileWorkspace (14 tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete window.showSaveFilePicker
  })

  it('initializes workspace with active file', () => {
    const { result } = renderHook(() => useFileWorkspace({ content: '# Init', fileName: 'init.md' }))
    expect(result.current.state.fileName).toBe('init.md')
    expect(result.current.state.content).toBe('# Init')
    expect(result.current.isModified).toBe(false)
  })

  it('updates content and marks active file modified', () => {
    const { result } = renderHook(() => useFileWorkspace({ content: '# Init', fileName: 'init.md' }))
    act(() => result.current.setContent('# Changed'))
    expect(result.current.state.content).toBe('# Changed')
    expect(result.current.isModified).toBe(true)
    expect(result.current.currentFile.isModified).toBe(true)
  })

  it('upserts, activates, renames, and removes files cleanly', () => {
    const { result } = renderHook(() => useFileWorkspace({ content: '# A', fileName: 'a.md' }))
    act(() => {
      result.current.upsertFile({
        path: 'b.md', name: 'b.md', content: '# B', savedContent: '# B', isModified: false, fileHandle: null, loaded: true,
      })
    })
    expect(result.current.state.files).toHaveLength(2)
    expect(result.current.state.currentPath).toBe('b.md')

    act(() => result.current.activateFile('a.md'))
    expect(result.current.state.currentPath).toBe('a.md')

    act(() => result.current.renameFile('a.md', 'a2.md', 'a2.md'))
    expect(result.current.state.fileName).toBe('a2.md')

    act(() => result.current.removeFile('a2.md'))
    expect(result.current.state.currentPath).toBe('b.md')

    // Removing last file creates fallback default file
    act(() => result.current.removeFile('b.md'))
    expect(result.current.state.files).toHaveLength(1)
    expect(result.current.state.fileName).toBe('untitled.md')
  })

  it('replaces files list with and without activating first item', () => {
    const { result } = renderHook(() => useFileWorkspace({ content: '# A', fileName: 'a.md' }))
    act(() => {
      result.current.replaceFiles([
        { path: 'x.md', name: 'x.md', content: '# X', savedContent: '# X', isModified: false, fileHandle: null, loaded: true },
      ], true)
    })
    expect(result.current.state.currentPath).toBe('x.md')

    act(() => result.current.replaceFiles([], true))
    expect(result.current.state.files).toHaveLength(0)
    expect(result.current.state.currentPath).toBe('')
  })

  it('validates markdown filename extension helper', () => {
    const { result } = renderHook(() => useFileWorkspace({ content: '', fileName: 'a.md' }))
    expect(result.current.isMarkdownFile('doc.md')).toBe(true)
    expect(result.current.isMarkdownFile('doc.MARKDOWN')).toBe(true)
    expect(result.current.isMarkdownFile('image.png')).toBe(false)
  })

  it('saves via File System Access API and falls back to download', async () => {
    const writable = { write: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue() }
    const handle = { name: 'saved.md', createWritable: vi.fn().mockResolvedValue(writable) }
    window.showSaveFilePicker = vi.fn().mockResolvedValue(handle)

    const { result } = renderHook(() => useFileWorkspace({ content: '# Save Me', fileName: 'draft.md' }))
    await act(async () => {
      const ok = await result.current.saveActiveFileAs()
      expect(ok).toBe(true)
    })
    expect(result.current.state.fileName).toBe('saved.md')

    // Save to existing handle
    await act(async () => {
      const ok = await result.current.saveActiveFile()
      expect(ok).toBe(true)
    })

    // Save specific file to disk
    await act(async () => {
      const ok = await result.current.saveFileToDisk(result.current.currentFile)
      expect(ok).toBe(true)
    })

    // Download fallback
    delete window.showSaveFilePicker
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await act(async () => {
      const ok = await result.current.saveActiveFileAs()
      expect(ok).toBe(true)
    })
    expect(clickSpy).toHaveBeenCalled()
  })
})

describe('hooks/useTranslationEngines (12 tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('translates with Google Translate and handles errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [[['你好', 'Hello']]] })
      .mockResolvedValueOnce({ ok: false })
    )
    const { result } = renderHook(() => useTranslationEngines({}, 'en'))
    expect(await result.current.google('Hello', 'zh-CN')).toBe('你好')
    await expect(result.current.google('Hello', 'zh-CN')).rejects.toThrow()
  })

  it('translates with MyMemory and reports API error details', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: '世界' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ responseStatus: 403, responseDetails: 'Limit reached' }) })
    )
    const { result } = renderHook(() => useTranslationEngines({}, 'en'))
    expect(await result.current.mymemory('World', 'zh-CN')).toBe('世界')
    await expect(result.current.mymemory('World', 'zh-CN')).rejects.toThrow('Limit reached')
  })

  it('translates with DeepL Free and requires API key', async () => {
    const { result: noKey } = renderHook(() => useTranslationEngines({ deeplApiKey: '' }, 'en'))
    await expect(noKey.current.deepl('Hi', 'zh-CN')).rejects.toThrow(/DeepL/i)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [{ text: '你好 DeepL' }] }),
    }))
    const { result } = renderHook(() => useTranslationEngines({ deeplApiKey: 'key-123' }, 'en'))
    expect(await result.current.deepl('Hi DeepL', 'zh-CN')).toBe('你好 DeepL')
  })

  it('translates with LibreTranslate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translatedText: 'Bonjour' }),
    }))
    const { result } = renderHook(() => useTranslationEngines({ libretranslateEndpoint: 'https://lt.local' }, 'en'))
    expect(await result.current.libretranslate('Hello', 'fr')).toBe('Bonjour')
  })

  it('translates with Custom LLM and validates API key & response', async () => {
    const { result: noKey } = renderHook(() => useTranslationEngines({ apiKey: '' }, 'en'))
    await expect(noKey.current.llm('Hello', 'zh-CN')).rejects.toThrow(/API key/i)

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: '自定义译文' } }] }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid key' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [] }) })
    )
    const { result } = renderHook(() => useTranslationEngines({ apiKey: 'sk-1', apiUrl: 'https://llm.local/v1' }, 'en'))
    expect(await result.current.llm('Hello', 'zh-CN')).toBe('自定义译文')
    await expect(result.current.llm('Hello', 'zh-CN')).rejects.toThrow('Invalid key')
    await expect(result.current.llm('Hello', 'zh-CN')).rejects.toThrow(/empty/i)
  })
})
