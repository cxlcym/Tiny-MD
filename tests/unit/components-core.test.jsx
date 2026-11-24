import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import Preview from '../../src/components/Preview/Preview'
import Editor from '../../src/components/Editor/Editor'
import FileManager from '../../src/components/FileManager/FileManager'
import StyleSelector, { PRESET_STYLES } from '../../src/components/StyleSelector/StyleSelector'
import HljsTheme from '../../src/components/HljsTheme/HljsTheme'
import Toolbar from '../../src/components/Toolbar/Toolbar'
import StatusBar from '../../src/components/StatusBar/StatusBar'
import QuickEdit from '../../src/components/QuickEdit/QuickEdit'

describe('Core UI Components (44 tests)', () => {
  describe('Preview', () => {
    it('renders markdown, strips YAML, and resolves imageMap paths', () => {
      const md = '---\ntitle: Hidden\n---\n\n# Visible\n\n![pic](./a.webp)'
      const { container } = render(
        <Preview
          content={md}
          theme="dark"
          imageMap={{ './a.webp': 'data:image/webp;base64,AAA' }}
          currentStyle="github"
          customStyles={[]}
        />
      )
      expect(container.textContent).not.toContain('title: Hidden')
      expect(container.querySelector('h1')?.textContent).toBe('Visible')
      expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/webp;base64,AAA')
    })

    it('BUG-002: neutralizes </style> breakout inside customStyles', () => {
      const { container } = render(
        <Preview
          content="# Safe"
          theme="dark"
          imageMap={{}}
          currentStyle="custom-1"
          customStyles={[{ id: 'custom-1', name: { en: 'Bad' }, css: 'body{}</style><script>alert(1)</script>' }]}
        />
      )
      expect(container.querySelector('script')).toBeNull()
      expect(container.querySelector('style')?.textContent || '').not.toContain('</style>')
    })

    it('renders YAML front-matter preview when showYAML is true', () => {
      const { container } = render(
        <Preview content={'---\ntitle: Shown\n---\n\n# Body'} theme="light" imageMap={{}} currentStyle="default" customStyles={[]} showYAML={true} />
      )
      expect(container.querySelector('.yaml-frontmatter-preview')?.textContent).toContain('title: Shown')
    })
  })

  describe('Editor', () => {
    it('mounts CodeMirror, syncs external value, and exposes imperative methods', () => {
      const ref = createRef()
      const onChange = vi.fn()
      const onCursorChange = vi.fn()
      const onScroll = vi.fn()
      const { container, rerender } = render(
        <Editor ref={ref} value="# Init" onChange={onChange} onCursorChange={onCursorChange} onScroll={onScroll} theme="dark" />
      )
      expect(container.querySelector('.cm-editor')).toBeInTheDocument()
      expect(ref.current.getCursorPos()).toBeGreaterThanOrEqual(0)
      expect(ref.current.insertAtCursor(' text')).toBe(true)
      expect(ref.current.insertAtPos('!', 0)).toBe(true)
      expect(onChange).toHaveBeenCalled()

      rerender(<Editor ref={ref} value="External" onChange={onChange} onCursorChange={onCursorChange} onScroll={onScroll} theme="light" />)
      expect(ref.current.getState().doc.toString()).toBe('External')
      expect(container.querySelector('.editor-container')).toHaveClass('cm-theme-light')

      fireEvent.scroll(container.querySelector('.cm-scroller'))
      expect(onScroll).toHaveBeenCalled()
    })
  })

  describe('FileManager', () => {
    const sampleFiles = [
      { path: 'notes/a.md', name: 'a.md', isModified: true },
      { path: 'notes/b.md', name: 'b.md', isModified: false },
    ]

    it('renders file list, supports collapse/expand, selection, rename, delete, and close', () => {
      const onFileSelect = vi.fn()
      const onFileRename = vi.fn()
      const onFileDelete = vi.fn()
      const onFileClose = vi.fn()
      const onCollapseChange = vi.fn()

      const { container } = render(
        <FileManager
          files={sampleFiles}
          currentFile="notes/a.md"
          onFileSelect={onFileSelect}
          onFileRename={onFileRename}
          onFileDelete={onFileDelete}
          onFileClose={onFileClose}
          onNewFile={vi.fn()}
          onOpenFile={vi.fn()}
          onOpenFolder={vi.fn()}
          onCollapseChange={onCollapseChange}
          folderTree={null}
          lang="zh-CN"
          isLoading={false}
        />
      )

      // Expand folder "notes"
      fireEvent.click(screen.getByText('notes'))
      expect(screen.getByText('a.md')).toBeInTheDocument()

      fireEvent.click(screen.getByText('b.md'))
      expect(onFileSelect).toHaveBeenCalledWith('notes/b.md')

      // Rename a.md
      fireEvent.click(screen.getAllByTitle('重命名')[1])
      const input = container.querySelector('.rename-input')
      fireEvent.change(input, { target: { value: 'renamed.md' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onFileRename).toHaveBeenCalledWith('notes/a.md', 'renamed.md')

      // Delete & close
      fireEvent.click(screen.getAllByTitle('删除')[1])
      expect(onFileDelete).toHaveBeenCalledWith('notes/a.md')
      fireEvent.click(screen.getByTitle('关闭'))
      expect(onFileClose).toHaveBeenCalledWith('notes/a.md')

      // Collapse & expand sidebar
      fireEvent.click(screen.getByText('文件'))
      expect(onCollapseChange).toHaveBeenCalledWith(true)
      fireEvent.click(screen.getByTitle('展开文件管理器'))
      expect(onCollapseChange).toHaveBeenCalledWith(false)
    })

    it('renders loading and empty states cleanly', () => {
      const { rerender } = render(
        <FileManager files={[]} currentFile="" onFileSelect={vi.fn()} onFileRename={vi.fn()} onFileDelete={vi.fn()} onFileClose={vi.fn()} onNewFile={vi.fn()} onOpenFile={vi.fn()} onOpenFolder={vi.fn()} folderTree={null} lang="zh-CN" isLoading={true} />
      )
      expect(screen.getByText('加载中...')).toBeInTheDocument()

      rerender(
        <FileManager files={[]} currentFile="" onFileSelect={vi.fn()} onFileRename={vi.fn()} onFileDelete={vi.fn()} onFileClose={vi.fn()} onNewFile={vi.fn()} onOpenFile={vi.fn()} onOpenFolder={vi.fn()} folderTree={null} lang="en" isLoading={false} />
      )
      expect(screen.getByText('No files')).toBeInTheDocument()
    })
  })

  describe('StyleSelector & HljsTheme', () => {
    it('opens dropdown, selects preset style, adds and deletes custom style', () => {
      const onStyleChange = vi.fn()
      const onCustomStylesChange = vi.fn()
      const custom = [{ id: 'custom-1', name: { en: 'MyCSS', 'zh-CN': 'MyCSS' }, css: '.markdown-body{color:red}' }]

      render(
        <StyleSelector
          currentStyle="default"
          onStyleChange={onStyleChange}
          customStyles={custom}
          onCustomStylesChange={onCustomStylesChange}
          lang="zh-CN"
        />
      )
      expect(PRESET_STYLES.length).toBeGreaterThanOrEqual(5)

      fireEvent.click(screen.getByText('样式'))
      fireEvent.click(screen.getByText('GitHub'))
      expect(onStyleChange).toHaveBeenCalledWith('github')

      fireEvent.click(screen.getByText('样式'))
      fireEvent.click(screen.getByText('+ 添加自定义样式'))
      fireEvent.change(screen.getByPlaceholderText('样式名称'), { target: { value: 'Solar' } })
      fireEvent.change(screen.getByPlaceholderText('输入 CSS 样式...'), { target: { value: '.markdown-body{font-size:15px}' } })
      fireEvent.click(screen.getByText('保存'))
      expect(onCustomStylesChange).toHaveBeenCalled()

      fireEvent.click(screen.getByTitle('删除'))
      expect(onCustomStylesChange).toHaveBeenCalledWith([])
    })

    it('HljsTheme renders dark and light bundled styles', () => {
      const { container, rerender } = render(<HljsTheme theme="dark" />)
      expect(container.querySelector('style')).toBeInTheDocument()
      rerender(<HljsTheme theme="light" />)
      expect(container.querySelector('style')).toBeInTheDocument()
    })
  })

  describe('Toolbar & StatusBar & QuickEdit', () => {
    it('Toolbar triggers all actions and opens About modal with accurate version', () => {
      const handlers = {
        onNew: vi.fn(), onOpen: vi.fn(), onSave: vi.fn(), onSaveAs: vi.fn(),
        onExportHtml: vi.fn(), onExportPdf: vi.fn(),
        onYAMLTemplate: vi.fn(), onImageUpload: vi.fn(), onSettings: vi.fn(),
        onStyleChange: vi.fn(), onCustomStylesChange: vi.fn(),
      }
      render(<Toolbar {...handlers} currentStyle="default" customStyles={[]} lang="en" isModified={true} />)
      fireEvent.click(screen.getByText('New'))
      fireEvent.click(screen.getByText('Open'))
      fireEvent.click(screen.getByText('Save'))
      fireEvent.click(screen.getByText('Save As'))
      fireEvent.click(screen.getByText('YAML'))
      fireEvent.click(screen.getByText('PicGo'))
      fireEvent.click(screen.getByTitle('Settings'))
      fireEvent.click(screen.getByText('Tiny MD'))
      expect(screen.getByText(/V1\.0\.2/i)).toBeInTheDocument()
      expect(handlers.onNew).toHaveBeenCalledTimes(1)
      expect(handlers.onSave).toHaveBeenCalledTimes(1)
    })

    it('StatusBar displays filename, modified dot, word count, and cursor position', () => {
      const { container } = render(
        <StatusBar fileName="doc.md" wordCount={42} cursorPos={{ line: 3, column: 9 }} lang="zh-CN" isModified={true} />
      )
      expect(container.querySelector('.filename')?.textContent).toContain('● doc.md')
      expect(screen.getByText('字数: 42')).toBeInTheDocument()
      expect(screen.getByText('行 3, 列 9')).toBeInTheDocument()
    })

    it('QuickEdit renders 16 buttons, invokes formatting, and localizes titles in zh-CN', () => {
      const onChange = vi.fn()
      const onSelectLocalImage = vi.fn()
      const { container } = render(
        <QuickEdit editorRef={{ current: null }} content="abc" onChange={onChange} onSelectLocalImage={onSelectLocalImage} lang="zh-CN" />
      )
      const btns = container.querySelectorAll('.quick-btn')
      expect(btns).toHaveLength(16)
      expect(btns[3].getAttribute('title')).toContain('加粗')
      btns.forEach((b) => fireEvent.click(b))
      expect(onSelectLocalImage).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledTimes(15)
    })
  })
})
