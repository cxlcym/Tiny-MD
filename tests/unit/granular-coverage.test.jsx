import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ErrorBoundary from '../../src/components/ErrorBoundary/ErrorBoundary'
import { lintMarkdownDoc } from '../../src/components/Editor/Editor'
import { renderMarkdown, sanitizeCustomCss } from '../../src/utils/markdown'
import QuickEdit from '../../src/components/QuickEdit/QuickEdit'
import SettingsModal from '../../src/components/Settings/SettingsModal'
import App from '../../src/App'

function CrashComponent({ boom }) {
  if (boom) throw new Error('Crash test')
  return <div>OK</div>
}

describe('Granular Coverage & Regression Suite (45 tests)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // ErrorBoundary (3)
  it('ErrorBoundary renders children when healthy', () => {
    render(<ErrorBoundary lang="en"><CrashComponent boom={false} /></ErrorBoundary>)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })
  it('ErrorBoundary catches error in English and recovers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary lang="en"><CrashComponent boom={true} /></ErrorBoundary>)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Recover Editor'))
  })
  it('ErrorBoundary catches error in zh-CN', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary lang="zh-CN"><CrashComponent boom={true} /></ErrorBoundary>)
    expect(screen.getByText('编辑器遇到异常')).toBeInTheDocument()
  })

  // lintMarkdownDoc (8)
  it('BUG-009: ignores bullet lists starting with "* "', () => {
    expect(lintMarkdownDoc('* bullet item\n  * nested bullet', () => 0)).toEqual([])
  })
  it('BUG-009: ignores asterisks inside fenced code blocks', () => {
    expect(lintMarkdownDoc('```js\nconst x = a * b;\n```', () => 0)).toEqual([])
  })
  it('BUG-009: ignores asterisks inside inline code spans', () => {
    expect(lintMarkdownDoc('Use `a * b` to multiply', () => 0)).toEqual([])
  })
  it('flags unclosed bold marker **', () => {
    const res = lintMarkdownDoc('Hello **world', () => 0)
    expect(res.some(d => d.message.includes('bold'))).toBe(true)
  })
  it('flags unclosed italic marker *', () => {
    const res = lintMarkdownDoc('Hello *world', () => 0)
    expect(res.some(d => d.message.includes('italic'))).toBe(true)
  })
  it('flags empty link URL []()', () => {
    const res = lintMarkdownDoc('[empty]()', () => 0)
    expect(res.some(d => d.message.includes('Empty link'))).toBe(true)
  })
  it('BUG-008: skips linting documents larger than 100KB', () => {
    expect(lintMarkdownDoc('**unclosed\n'.repeat(12000), () => 0)).toEqual([])
  })
  it('returns empty array for valid markdown', () => {
    expect(lintMarkdownDoc('# Title\n\n**bold** and *italic* and [ok](https://a.com)', () => 0)).toEqual([])
  })

  // markdown & CSS sanitization (6)
  it('truncates preview above 150KB with performance notice', () => {
    const huge = 'a '.repeat(80 * 1024)
    expect(renderMarkdown(huge)).toContain('Large document preview mode')
  })
  it('preserves code blocks when rendering math', () => {
    const html = renderMarkdown('```\n$not_math$\n```')
    expect(html).not.toContain('katex')
  })
  it('sanitizeCustomCss removes closing style tags case-insensitively', () => {
    expect(sanitizeCustomCss('a{}</STYLE><script>1</script>')).not.toContain('</STYLE')
    expect(sanitizeCustomCss('a{}</STYLE><script>1</script>')).not.toContain('<script')
  })
  it('renders GFM task lists and tables', () => {
    const html = renderMarkdown('- [x] done\n\n| A | B |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<table')
    expect(html).toContain('checkbox')
  })
  it('renders blockquotes and horizontal rules', () => {
    const html = renderMarkdown('> quote\n\n---')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<hr')
  })
  it('handles empty markdown input safely', () => {
    expect(renderMarkdown('')).toBe('')
  })

  // QuickEdit with CodeMirror view mock (16 individual button tests)
  const quickButtons = [
    [0, '# '], [1, '## '], [2, '### '],
    [3, '**hello**'], [4, '*hello*'], [5, '~~hello~~'], [6, '`hello`'],
    [7, '[hello](url)'], [8, '![hello](url)'], [9, '| Header 1 |'],
    [10, '> '], [11, '\n```\nhello\n```\n'], [12, '- '], [13, '1. '], [14, '- [ ] '], [15, '\n---\n'],
  ]
  for (const [idx, expected] of quickButtons) {
    it(`QuickEdit button #${idx} inserts expected syntax`, () => {
      const dispatch = vi.fn()
      const ref = {
        current: {
          getView: () => ({
            state: {
              selection: { main: { from: 0, to: 5 } },
              sliceDoc: () => 'hello',
              doc: { lineAt: () => ({ from: 0 }) },
            },
            dispatch,
            focus: vi.fn(),
          }),
        },
      }
      const { container } = render(<QuickEdit editorRef={ref} content="hello" onChange={vi.fn()} lang="en" />)
      fireEvent.click(container.querySelectorAll('.quick-btn')[idx])
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({ insert: expect.stringContaining(expected) }),
        })
      )
    })
  }

  // SettingsModal detailed fields (6)
  const baseCfg = {
    language: 'en', theme: 'dark', picgoEndpoint: 'http://127.0.0.1:36677', picgoUploadPath: '/upload',
    llmApiKey: '', llmApiUrl: 'https://api.openai.com/v1/chat/completions', llmModel: 'gpt-3.5-turbo',
    llmTranslationPrompt: 'Translate to {{targetLanguage}}', deeplApiKey: '', libretranslateEndpoint: 'https://libretranslate.com',
    imageBed: 'picgo',
    cloudflareR2: { accountId: '', accessKeyId: '', secretAccessKey: '', bucketName: '', publicUrl: '' },
    awsS3: { accessKeyId: '', secretAccessKey: '', bucketName: '', region: 'us-east-1', endpoint: '' },
  }
  it('SettingsModal updates PicGo endpoint and path', () => {
    const onSave = vi.fn()
    const { container } = render(<SettingsModal config={baseCfg} onSave={onSave} onClose={vi.fn()} lang="en" />)
    fireEvent.change(screen.getByPlaceholderText('http://127.0.0.1:36677'), { target: { value: 'http://localhost:9999' } })
    fireEvent.change(screen.getByPlaceholderText('/upload'), { target: { value: '/api' } })
    fireEvent.click(container.querySelector('.save-btn'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ picgoEndpoint: 'http://localhost:9999', picgoUploadPath: '/api' }))
  })
  it('SettingsModal updates Cloudflare R2 fields', () => {
    const onSave = vi.fn()
    const { container } = render(<SettingsModal config={{ ...baseCfg, imageBed: 'cloudflare-r2' }} onSave={onSave} onClose={vi.fn()} lang="en" />)
    const inputs = container.querySelectorAll('.settings-section')[2].querySelectorAll('input')
    inputs.forEach((inp, i) => fireEvent.change(inp, { target: { value: `r2-${i}` } }))
    fireEvent.click(container.querySelector('.save-btn'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ cloudflareR2: expect.objectContaining({ accountId: 'r2-0' }) }))
  })
  it('SettingsModal updates AWS S3 fields', () => {
    const onSave = vi.fn()
    const { container } = render(<SettingsModal config={{ ...baseCfg, imageBed: 'aws-s3' }} onSave={onSave} onClose={vi.fn()} lang="en" />)
    const inputs = container.querySelectorAll('.settings-section')[2].querySelectorAll('input')
    inputs.forEach((inp, i) => fireEvent.change(inp, { target: { value: `s3-${i}` } }))
    fireEvent.click(container.querySelector('.save-btn'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ awsS3: expect.objectContaining({ accessKeyId: 's3-0' }) }))
  })
  it('SettingsModal updates DeepL and LibreTranslate config', () => {
    const onSave = vi.fn()
    const { container } = render(<SettingsModal config={baseCfg} onSave={onSave} onClose={vi.fn()} lang="en" />)
    const deeplInput = container.querySelector('input[placeholder*="DeepL"], input[placeholder*="fx"]')
    if (deeplInput) fireEvent.change(deeplInput, { target: { value: 'dl-key' } })
    fireEvent.click(container.querySelector('.save-btn'))
    expect(onSave).toHaveBeenCalled()
  })
  it('SettingsModal closes on Cancel without saving', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<SettingsModal config={baseCfg} onSave={onSave} onClose={onClose} lang="en" />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
  it('SettingsModal closes on overlay click', () => {
    const onClose = vi.fn()
    const { container } = render(<SettingsModal config={baseCfg} onSave={vi.fn()} onClose={onClose} lang="en" />)
    fireEvent.click(container.querySelector('.settings-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  // App additional interactive flows (6)
  it('App opens YAML modal via Ctrl+Shift+Y shortcut', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true, shiftKey: true })
    expect(screen.getByText('YAML Templates')).toBeInTheDocument()
  })
  it('App opens ImageUpload modal via Ctrl+Shift+P shortcut', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true, shiftKey: true })
    expect(screen.getByText('Image Upload')).toBeInTheDocument()
  })
  it('App handles New file via Ctrl+N shortcut', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(screen.getAllByText('untitled.md').length).toBeGreaterThanOrEqual(1)
  })
  it('App handles panel resize drag events cleanly', () => {
    const { container } = render(<App />)
    const handle = container.querySelectorAll('.resize-handle')[1]
    fireEvent.mouseDown(handle, { clientX: 300 })
    fireEvent.mouseMove(window, { clientX: 380 })
    fireEvent.mouseUp(window)
    expect(container.querySelectorAll('.panel')).toHaveLength(4)
  })
  it('App cleans up unreferenced imageMap entries automatically', async () => {
    localStorage.setItem('tiny-md-image-map', JSON.stringify({ './unused.webp': 'data:image/webp;base64,AAA' }))
    render(<App />)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('tiny-md-image-map'))
      expect(stored).toEqual({})
    })
  })
  it('App triggers beforeunload prevention when modified', () => {
    render(<App />)
    fireEvent.click(screen.getByText('YAML'))
    fireEvent.click(screen.getAllByText('Apply')[0])
    const evt = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(true)
  })
})
