import { useState, useCallback } from 'react'
import './StyleSelector.css'

const PRESET_STYLES = [
  {
    id: 'default',
    name: { en: 'Default', 'zh-CN': '默认' },
    css: ''
  },
  {
    id: 'github',
    name: { en: 'GitHub', 'zh-CN': 'GitHub' },
    css: `
      .markdown-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
      .markdown-body h1, .markdown-body h2 { border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      .markdown-body code { background-color: rgba(27, 31, 35, 0.05); border-radius: 3px; padding: 0.2em 0.4em; }
      .markdown-body pre { background-color: #f6f8fa; border-radius: 6px; padding: 16px; }
      .markdown-body blockquote { border-left: 4px solid #dfe2e5; color: #6a737d; padding: 0 1em; }
      .markdown-body table { border-collapse: collapse; }
      .markdown-body table th, .markdown-body table td { border: 1px solid #dfe2e5; padding: 6px 13px; }
      .markdown-body table tr:nth-child(2n) { background-color: #f6f8fa; }
    `
  },
  {
    id: 'notion',
    name: { en: 'Notion', 'zh-CN': 'Notion' },
    css: `
      .markdown-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.7; }
      .markdown-body h1 { font-size: 2.5em; font-weight: 700; margin-bottom: 0.5em; }
      .markdown-body h2 { font-size: 1.5em; font-weight: 600; margin-top: 1.5em; }
      .markdown-body code { background-color: rgba(55, 53, 47, 0.08); border-radius: 3px; font-size: 0.9em; padding: 0.2em 0.4em; }
      .markdown-body pre { background-color: #f7f6f3; border-radius: 4px; padding: 1em; }
      .markdown-body blockquote { border-left: 3px solid currentColor; margin: 0.5em 0; padding-left: 1em; }
      .markdown-body ul, .markdown-body ol { padding-left: 1.5em; }
      .markdown-body a { color: #2383e2; text-decoration: none; }
      .markdown-body a:hover { text-decoration: underline; }
    `
  },
  {
    id: 'medium',
    name: { en: 'Medium', 'zh-CN': 'Medium' },
    css: `
      .markdown-body { font-family: Georgia, 'Times New Roman', serif; font-size: 1.125rem; line-height: 1.8; }
      .markdown-body h1, .markdown-body h2, .markdown-body h3 { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 700; }
      .markdown-body h1 { font-size: 2.5em; margin-bottom: 0.5em; }
      .markdown-body h2 { font-size: 1.75em; margin-top: 1.5em; }
      .markdown-body p { margin-bottom: 1.5em; }
      .markdown-body code { font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em; background-color: rgba(0,0,0,0.05); padding: 0.15em 0.3em; border-radius: 3px; }
      .markdown-body pre { background-color: #f9f9f9; border-radius: 4px; padding: 1.5em; overflow-x: auto; }
      .markdown-body blockquote { border-left: 3px solid #000; font-style: italic; margin: 1.5em 0; padding-left: 1em; }
      .markdown-body img { max-width: 100%; height: auto; border-radius: 4px; }
    `
  },
  {
    id: 'book',
    name: { en: 'Book', 'zh-CN': '书籍' },
    css: `
      .markdown-body { font-family: 'Noto Serif SC', 'Source Han Serif SC', Georgia, serif; font-size: 16px; line-height: 2; text-align: justify; }
      .markdown-body h1 { font-size: 2em; text-align: center; margin: 2em 0 1em; font-weight: 700; }
      .markdown-body h2 { font-size: 1.5em; margin: 1.5em 0 0.8em; border-bottom: 2px solid currentColor; padding-bottom: 0.3em; }
      .markdown-body h3 { font-size: 1.25em; margin: 1.2em 0 0.6em; }
      .markdown-body p { text-indent: 2em; margin-bottom: 1em; }
      .markdown-body p:first-of-type { text-indent: 0; }
      .markdown-body pre, .markdown-body code { font-family: 'Fira Code', Consolas, monospace; }
      .markdown-body pre { background-color: #f5f5f5; border-radius: 4px; padding: 1em; text-indent: 0; }
      .markdown-body blockquote { border-left: 4px solid #ccc; margin: 1em 0; padding: 0.5em 1em; background-color: #fafafa; text-indent: 0; }
      .markdown-body ul, .markdown-body ol { padding-left: 2em; }
    `
  }
]

function StyleSelector({ currentStyle, onStyleChange, customStyles, onCustomStylesChange, lang }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustomEditor, setShowCustomEditor] = useState(false)
  const [customCss, setCustomCss] = useState('')
  const [customName, setCustomName] = useState('')

  const allStyles = [...PRESET_STYLES, ...customStyles]

  const handleSelectStyle = useCallback((styleId) => {
    onStyleChange(styleId)
    setIsOpen(false)
  }, [onStyleChange])

  const handleAddCustomStyle = useCallback(() => {
    if (!customName.trim() || !customCss.trim()) return
    
    const newStyle = {
      id: `custom-${Date.now()}`,
      name: { en: customName, 'zh-CN': customName },
      css: customCss
    }
    
    onCustomStylesChange([...customStyles, newStyle])
    setCustomName('')
    setCustomCss('')
    setShowCustomEditor(false)
    onStyleChange(newStyle.id)
  }, [customName, customCss, customStyles, onCustomStylesChange, onStyleChange])

  const handleDeleteCustomStyle = useCallback((styleId, e) => {
    e.stopPropagation()
    onCustomStylesChange(customStyles.filter(s => s.id !== styleId))
    if (currentStyle === styleId) {
      onStyleChange('default')
    }
  }, [customStyles, currentStyle, onCustomStylesChange, onStyleChange])

  return (
    <div className="style-selector">
      <button 
        className="toolbar-btn style-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        title={lang === 'zh-CN' ? '样式' : 'Styles'}
      >
        <span className="btn-icon">🎨</span>
        <span className="btn-text">{lang === 'zh-CN' ? '样式' : 'Styles'}</span>
      </button>
      
      {isOpen && (
        <>
          <div className="style-overlay" onClick={() => setIsOpen(false)} />
          <div className="style-dropdown">
            <div className="style-header">
              <span>{lang === 'zh-CN' ? '选择预览样式' : 'Select Preview Style'}</span>
            </div>
            <div className="style-list">
              {allStyles.map(style => (
                <div
                  key={style.id}
                  className={`style-item ${currentStyle === style.id ? 'active' : ''}`}
                  onClick={() => handleSelectStyle(style.id)}
                >
                  <div className="style-info">
                    <span className="style-name">{style.name[lang] || style.name['en']}</span>
                    {style.id.startsWith('custom-') && (
                      <span className="custom-badge">{lang === 'zh-CN' ? '自定义' : 'Custom'}</span>
                    )}
                  </div>
                  <div className="style-preview" style={{ fontFamily: style.css.includes('serif') ? 'Georgia, serif' : 'sans-serif' }}>
                    Aa
                  </div>
                  {style.id.startsWith('custom-') && (
                    <button 
                      className="delete-style-btn"
                      onClick={(e) => handleDeleteCustomStyle(style.id, e)}
                      title={lang === 'zh-CN' ? '删除' : 'Delete'}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="style-footer">
              <button 
                className="add-custom-btn"
                onClick={() => setShowCustomEditor(!showCustomEditor)}
              >
                {lang === 'zh-CN' ? '+ 添加自定义样式' : '+ Add Custom Style'}
              </button>
            </div>
            
            {showCustomEditor && (
              <div className="custom-editor">
                <input
                  type="text"
                  className="custom-name-input"
                  placeholder={lang === 'zh-CN' ? '样式名称' : 'Style Name'}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
                <textarea
                  className="custom-css-input"
                  placeholder={lang === 'zh-CN' ? '输入 CSS 样式...' : 'Enter CSS styles...'}
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  rows={6}
                />
                <div className="custom-editor-actions">
                  <button className="cancel-btn" onClick={() => setShowCustomEditor(false)}>
                    {lang === 'zh-CN' ? '取消' : 'Cancel'}
                  </button>
                  <button className="save-btn" onClick={handleAddCustomStyle}>
                    {lang === 'zh-CN' ? '保存' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export { PRESET_STYLES }
export default StyleSelector
