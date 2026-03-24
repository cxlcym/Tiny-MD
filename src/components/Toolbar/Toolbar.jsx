import { useState } from 'react'
import { t } from '../../utils/i18n'
import StyleSelector from '../StyleSelector/StyleSelector'
import './Toolbar.css'

function Toolbar({ onNew, onOpen, onSave, onSaveAs, onYAMLTemplate, onImageUpload, onSettings, currentStyle, onStyleChange, customStyles, onCustomStylesChange, lang, isModified }) {
  const [showAbout, setShowAbout] = useState(false)

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onNew} title={`${t('newFile', lang)} (Ctrl+N)`}>
          <span className="btn-icon">+</span>
          <span className="btn-text">{t('newFile', lang)}</span>
        </button>
        <button className="toolbar-btn" onClick={onOpen} title={`${t('openFile', lang)} (Ctrl+O)`}>
          <span className="btn-icon">📂</span>
          <span className="btn-text">{t('openFile', lang)}</span>
        </button>
        <button className="toolbar-btn" onClick={onSave} title={`${t('saveFile', lang)} (Ctrl+S)`}>
          <span className="btn-icon">💾</span>
          <span className="btn-text">{t('saveFile', lang)}</span>
        </button>
        <button className="toolbar-btn" onClick={onSaveAs} title={`${t('saveAs', lang)} (Ctrl+Shift+S)`}>
          <span className="btn-icon">📄</span>
          <span className="btn-text">{t('saveAs', lang)}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <StyleSelector
          currentStyle={currentStyle}
          onStyleChange={onStyleChange}
          customStyles={customStyles}
          onCustomStylesChange={onCustomStylesChange}
          lang={lang}
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onYAMLTemplate} title={`${t('yamlTemplate', lang)} (Ctrl+Shift+Y)`}>
          <span className="btn-icon">📋</span>
          <span className="btn-text">{t('yamlTemplate', lang)}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onImageUpload} title={`${t('imageUpload', lang)} (Ctrl+Shift+P)`}>
          <span className="btn-icon">🖼️</span>
          <span className="btn-text">{t('imageUpload', lang)}</span>
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        {isModified && <span className="modified-indicator">●</span>}
        <button className="toolbar-btn settings-btn" onClick={onSettings} title={t('settings', lang)}>
          <span className="btn-icon">⚙️</span>
        </button>
        <button className="app-title" onClick={() => setShowAbout(true)}>Tiny MD</button>
      </div>
      {showAbout && (
        <div className="about-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-modal" onClick={(e) => e.stopPropagation()}>
            <div className="about-header">
              <h2>Tiny MD</h2>
              <span className="about-version">V1.0.0</span>
              <button className="close-btn" onClick={() => setShowAbout(false)}>×</button>
            </div>
            <div className="about-content">
              <p className="about-description">
                {lang === 'zh-CN' ? '一款轻量级且灵活的 Markdown 编辑器' : 'A lightweight and flexible Markdown editor'}
              </p>
              <div className="about-info">
                <div className="about-item">
                  <span className="about-label">{lang === 'zh-CN' ? '作者' : 'Author'}:</span>
                  <span className="about-value">JackCao</span>
                </div>
                <div className="about-item">
                  <span className="about-label">{lang === 'zh-CN' ? '仓库' : 'Repository'}:</span>
                  <a 
                    href="https://github.com/cxlcym/Tiny-MD" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="about-link"
                  >
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Toolbar
