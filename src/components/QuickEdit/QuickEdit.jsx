import { useCallback } from 'react'
import { t } from '../../utils/i18n'
import './QuickEdit.css'

function QuickEdit({ editorRef, content, onChange, onSelectLocalImage, lang = 'en' }) {
  const getView = useCallback(() => {
    if (editorRef?.current?.getView) {
      return editorRef.current.getView()
    }
    return editorRef?.current || null
  }, [editorRef])

  const insertText = useCallback((before, after = '', defaultText = '') => {
    const view = getView()
    if (view && view.state) {
      const { from, to } = view.state.selection.main
      const selectedText = view.state.sliceDoc(from, to) || defaultText
      
      view.dispatch({
        changes: {
          from,
          to,
          insert: before + selectedText + after
        },
        selection: {
          anchor: from + before.length,
          head: from + before.length + selectedText.length
        }
      })
      view.focus()
    } else {
      onChange(content + '\n' + before + defaultText + after)
    }
  }, [getView, content, onChange])

  const insertAtLineStart = useCallback((prefix) => {
    const view = getView()
    if (view && view.state) {
      const { from } = view.state.selection.main
      const line = view.state.doc.lineAt(from)
      const lineStart = line.from
      
      view.dispatch({
        changes: {
          from: lineStart,
          to: lineStart,
          insert: prefix
        }
      })
      view.focus()
    } else {
      onChange(prefix + content)
    }
  }, [getView, content, onChange])

  const insertAtCursor = useCallback((text) => {
    const view = getView()
    if (view && view.state) {
      const { from } = view.state.selection.main
      
      view.dispatch({
        changes: {
          from,
          to: from,
          insert: text
        },
        selection: {
          anchor: from + text.length
        }
      })
      view.focus()
    } else {
      onChange(content + text)
    }
  }, [getView, content, onChange])

  const handleBold = () => insertText('**', '**', 'bold')
  const handleItalic = () => insertText('*', '*', 'italic')
  const handleStrikethrough = () => insertText('~~', '~~', 'text')
  const handleCode = () => insertText('`', '`', 'code')
  const handleLink = () => insertText('[', '](url)', 'link text')
  const handleLocalImage = () => {
    if (onSelectLocalImage) {
      onSelectLocalImage()
    } else {
      insertText('![', '](url)', 'alt text')
    }
  }
  const handleH1 = () => insertAtLineStart('# ')
  const handleH2 = () => insertAtLineStart('## ')
  const handleH3 = () => insertAtLineStart('### ')
  const handleQuote = () => insertAtLineStart('> ')
  const handleUl = () => insertAtLineStart('- ')
  const handleOl = () => insertAtLineStart('1. ')
  const handleTask = () => insertAtLineStart('- [ ] ')
  const handleHr = () => insertAtCursor('\n---\n')
  const handleCodeBlock = () => insertText('\n```\n', '\n```\n', 'code here')
  const handleTable = () => {
    const table = `\n| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |\n`
    insertAtCursor(table)
  }

  return (
    <div className="quick-edit">
      <div className="quick-edit-group">
        <button className="quick-btn" onClick={handleH1} title={t('qeH1', lang)}>
          H1
        </button>
        <button className="quick-btn" onClick={handleH2} title={t('qeH2', lang)}>
          H2
        </button>
        <button className="quick-btn" onClick={handleH3} title={t('qeH3', lang)}>
          H3
        </button>
      </div>

      <div className="quick-edit-divider" />

      <div className="quick-edit-group">
        <button className="quick-btn" onClick={handleBold} title={t('qeBold', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
          </svg>
        </button>
        <button className="quick-btn" onClick={handleItalic} title={t('qeItalic', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
          </svg>
        </button>
        <button className="quick-btn" onClick={handleStrikethrough} title={t('qeStrikethrough', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/>
          </svg>
        </button>
        <button className="quick-btn" onClick={handleCode} title={t('qeInlineCode', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
        </button>
      </div>

      <div className="quick-edit-divider" />

      <div className="quick-edit-group">
        <button className="quick-btn" onClick={handleLink} title={t('qeLink', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
          </svg>
        </button>
        <button className="quick-btn" onClick={handleLocalImage} title={t('qeImage', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </button>
        <button className="quick-btn" onClick={handleTable} title={t('qeTable', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M20 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10 17H5v-2h5v2zm0-4H5v-2h5v2zm0-4H5V7h5v2zm9 8h-5v-2h5v2zm0-4h-5v-2h5v2zm0-4h-5V7h5v2z"/>
          </svg>
        </button>
      </div>

      <div className="quick-edit-divider" />

      <div className="quick-edit-group">
        <button className="quick-btn" onClick={handleQuote} title={t('qeQuote', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
          </svg>
        </button>
        <button className="quick-btn" onClick={handleCodeBlock} title={t('qeCodeBlock', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
        </button>
      </div>

      <div className="quick-edit-divider" />

      <div className="quick-edit-group">
        <button className="quick-btn" onClick={handleUl} title={t('qeUl', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </button>
        <button className="quick-btn" onClick={handleOl} title={t('qeOl', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
          </svg>
        </button>
        <button className="quick-btn" onClick={handleTask} title={t('qeTask', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/>
          </svg>
        </button>
      </div>

      <div className="quick-edit-divider" />

      <div className="quick-edit-group">
        <button className="quick-btn" onClick={handleHr} title={t('qeHr', lang)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M4 11h16v2H4z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default QuickEdit
