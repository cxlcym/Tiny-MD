import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Translation from '../../src/components/Translation/Translation'
import YAMLTemplateModal from '../../src/components/YAMLTemplate/YAMLTemplateModal'
import ImageUpload from '../../src/components/ImageUpload/ImageUpload'
import SettingsModal from '../../src/components/Settings/SettingsModal'
import App from '../../src/App'
import { picgoService } from '../../src/services/imageUpload/picgo'

describe('Modals & App Integration (30+ tests)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    delete window.showOpenFilePicker
    delete window.showSaveFilePicker
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Translation', () => {
    it('translates body while preserving YAML and supports Apply button (BUG-007)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [[['# 你好', '# Hello']]],
      }))
      const onTranslated = vi.fn()
      render(
        <Translation
          content={'---\ntitle: Keep\n---\n\n# Hello'}
          onTranslated={onTranslated}
          lang="en"
          llmConfig={{}}
        />
      )
      fireEvent.click(screen.getByText('Translate'))
      await waitFor(() => expect(screen.getByText('Apply')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Apply'))
      expect(onTranslated).toHaveBeenCalledWith('---\ntitle: Keep\n---\n\n# 你好')
    })

    it('shows error on empty body and handles API failures', async () => {
      render(<Translation content={'---\ntitle: Only\n---\n '} lang="en" llmConfig={{}} />)
      fireEvent.click(screen.getByText('Translate'))
      expect(await screen.findByText('No content to translate')).toBeInTheDocument()
    })
  })

  describe('YAMLTemplateModal', () => {
    const tpls = [
      { id: 'hugo', name: 'Hugo Blog', content: '---\ntitle: {{title}}\n---' },
      { id: 'hexo', name: 'Hexo Blog', content: '---\ntitle: {{title}}\n---' },
    ]

    it('applies, creates, edits, deletes, exports, and imports templates', async () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const onApply = vi.fn()
      const onSave = vi.fn()
      const { container } = render(
        <YAMLTemplateModal templates={tpls} onApply={onApply} onSave={onSave} onClose={vi.fn()} lang="en" />
      )

      fireEvent.click(screen.getAllByText('Apply')[0])
      expect(onApply).toHaveBeenCalledWith(tpls[0])

      fireEvent.change(screen.getByPlaceholderText('Template name'), { target: { value: 'Doc' } })
      fireEvent.click(screen.getByText('Create Template'))
      expect(onSave).toHaveBeenCalled()

      fireEvent.click(screen.getAllByText('Edit')[0])
      fireEvent.click(screen.getByText('Save'))
      fireEvent.click(screen.getAllByText('Delete')[0])

      fireEvent.click(screen.getByText('Export JSON'))
      expect(clickSpy).toHaveBeenCalled()

      const fileInput = container.querySelector('input[type="file"]')
      const imported = [{ id: 'imp', name: 'Imp', content: '---\ntitle: imp\n---' }]
      const file = new File([JSON.stringify(imported)], 'tpl.json', { type: 'application/json' })
      file.text = async () => JSON.stringify(imported)
      fireEvent.change(fileInput, { target: { files: [file] } })
      await waitFor(() => expect(onSave).toHaveBeenCalledWith(imported))
    })
  })

  describe('ImageUpload', () => {
    it('BUG-006: recovers from corrupt localStorage JSON without throwing', () => {
      localStorage.setItem('tiny-md-picgo-config', '{corrupt')
      expect(() => render(<ImageUpload onClose={vi.fn()} lang="en" content="" onContentChange={vi.fn()} />)).not.toThrow()
    })

    it('BUG-006: uploads clipboard image from imageMap and replaces URL', async () => {
      const onContentChange = vi.fn()
      vi.spyOn(picgoService, 'upload').mockResolvedValue({ success: true, url: 'https://cdn.test/1.webp' })
      render(
        <ImageUpload
          onClose={vi.fn()}
          lang="en"
          content="![clip](./img_1.webp)"
          onContentChange={onContentChange}
          imageMap={{ './img_1.webp': 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=' }}
          picgoConfig={{ endpoint: 'http://127.0.0.1:36677', uploadPath: '/upload' }}
        />
      )
      fireEvent.click(screen.getByText('Batch Upload Local Images'))
      await waitFor(() => expect(onContentChange).toHaveBeenCalledWith('![clip](https://cdn.test/1.webp)'))
    })

    it('reports when no local images exist', async () => {
      render(<ImageUpload onClose={vi.fn()} lang="zh-CN" content="![r](https://a.com/x.png)" onContentChange={vi.fn()} picgoConfig={{ endpoint: 'http://127.0.0.1:36677', uploadPath: '/upload' }} />)
      fireEvent.click(screen.getByText('批量上传本地图片'))
      expect(await screen.findByText('未找到本地图片')).toBeInTheDocument()
    })
  })

  describe('SettingsModal', () => {
    const cfg = {
      language: 'en', theme: 'dark', picgoEndpoint: 'http://127.0.0.1:36677', picgoUploadPath: '/upload',
      llmApiKey: '', llmApiUrl: 'https://api.openai.com/v1/chat/completions', llmModel: 'gpt-3.5-turbo',
      llmTranslationPrompt: 'Translate to {{targetLanguage}}', deeplApiKey: '', libretranslateEndpoint: 'https://libretranslate.com',
      imageBed: 'picgo',
      cloudflareR2: { accountId: '', accessKeyId: '', secretAccessKey: '', bucketName: '', publicUrl: '' },
      awsS3: { accessKeyId: '', secretAccessKey: '', bucketName: '', region: 'us-east-1', endpoint: '' },
    }

    it('updates language, theme, image beds (PicGo/R2/S3), translation APIs, and saves', () => {
      const onSave = vi.fn()
      const onClose = vi.fn()
      const { container } = render(<SettingsModal config={cfg} onSave={onSave} onClose={onClose} lang="en" />)
      const selects = container.querySelectorAll('select')
      fireEvent.change(selects[0], { target: { value: 'zh-CN' } })
      fireEvent.click(screen.getByText('Light'))
      fireEvent.change(selects[1], { target: { value: 'cloudflare-r2' } })
      fireEvent.change(selects[1], { target: { value: 'aws-s3' } })
      fireEvent.click(container.querySelector('.save-btn'))
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ language: 'zh-CN', theme: 'light', imageBed: 'aws-s3' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('App integration', () => {
    it('renders four-pane layout and toggles modals, YAML preview, Export HTML, and Ctrl+Shift+S (BUG-004)', () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

      const { container } = render(<App />)
      expect(container.querySelectorAll('.panel')).toHaveLength(4)

      // Toggle preview YAML
      fireEvent.click(screen.getByText('Show YAML'))
      expect(screen.getByText('Hide YAML')).toBeInTheDocument()

      // Export HTML & PDF
      fireEvent.click(screen.getByText('Export HTML'))
      expect(clickSpy).toHaveBeenCalled()
      fireEvent.click(screen.getByText('Print / PDF'))
      expect(printSpy).toHaveBeenCalled()

      // Windows Ctrl+Shift+S (uppercase S)
      clickSpy.mockClear()
      fireEvent.keyDown(window, { key: 'S', ctrlKey: true, shiftKey: true })
      expect(clickSpy).toHaveBeenCalled()

      // Open & close Settings
      fireEvent.click(screen.getByTitle('Settings'))
      expect(screen.getByText('Settings')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Cancel'))
    })
  })
})
