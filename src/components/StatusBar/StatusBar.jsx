import { t } from '../../utils/i18n'
import './StatusBar.css'

function StatusBar({ fileName, wordCount, cursorPos, lang, isModified }) {
  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item filename">
          {isModified && '● '}
          {fileName}
        </span>
        <span className="status-item">{t('words', lang)}: {wordCount}</span>
      </div>
      <div className="status-right">
        <span className="status-item">{t('line', lang)} {cursorPos.line}, {t('column', lang)} {cursorPos.column}</span>
        <span className="status-item">UTF-8</span>
        <span className="status-item">Markdown</span>
      </div>
    </div>
  )
}

export default StatusBar
