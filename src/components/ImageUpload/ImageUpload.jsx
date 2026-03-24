import { useState, useCallback } from 'react'
import { picgoService } from '../../services/imageUpload/picgo'
import { t } from '../../utils/i18n'
import './ImageUpload.css'

function ImageUpload({ onClose, lang, content, onContentChange, picgoConfig }) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState([])
  const [config, setConfig] = useState(() => {
    if (picgoConfig) {
      return {
        endpoint: picgoConfig.endpoint,
        uploadPath: picgoConfig.uploadPath
      }
    }
    const saved = localStorage.getItem('tiny-md-picgo-config')
    return saved ? JSON.parse(saved) : {
      endpoint: 'http://127.0.0.1:36677',
      uploadPath: '/upload'
    }
  })

  const handleSaveConfig = useCallback(() => {
    localStorage.setItem('tiny-md-picgo-config', JSON.stringify(config))
    picgoService.updateConfig(config)
  }, [config])

  // Batch upload - find all local images and upload to PicGo
  const handleBatchUpload = useCallback(async () => {
    if (!content) return

    setIsUploading(true)
    setUploadProgress([])

    picgoService.updateConfig(config)

    // Find all local image references in markdown
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const matches = []
    let match

    while ((match = imageRegex.exec(content)) !== null) {
      const [fullMatch, alt, url] = match
      // Only process local file paths (not URLs)
      if (!url.startsWith('http') && !url.startsWith('data:')) {
        matches.push({
          fullMatch,
          alt,
          url,
          index: match.index
        })
      }
    }

    if (matches.length === 0) {
      setUploadProgress([{
        name: lang === 'zh-CN' ? '未找到本地图片' : 'No local images found',
        status: 'info'
      }])
      setIsUploading(false)
      return
    }

    let newContent = content
    let offset = 0

    for (const img of matches) {
      setUploadProgress(prev => [...prev, {
        name: img.url,
        status: 'uploading'
      }])

      try {
        // Try to fetch the image (for local files served by dev server)
        const response = await fetch(img.url)
        if (!response.ok) {
          throw new Error('Failed to fetch image')
        }

        const blob = await response.blob()
        const file = new File([blob], img.url.split('/').pop(), { type: blob.type })

        const result = await picgoService.upload(file)

        setUploadProgress(prev => prev.map(item =>
          item.name === img.url
            ? { ...item, status: result.success ? 'success' : 'error', url: result.url, error: result.error }
            : item
        ))

        if (result.success) {
          // Replace the image URL in content
          const newImgMarkdown = `![${img.alt}](${result.url})`
          const adjustedIndex = img.index + offset
          newContent = newContent.substring(0, adjustedIndex) + 
                       newImgMarkdown + 
                       newContent.substring(adjustedIndex + img.fullMatch.length)
          offset += newImgMarkdown.length - img.fullMatch.length
        }
      } catch (err) {
        setUploadProgress(prev => prev.map(item =>
          item.name === img.url
            ? { ...item, status: 'error', error: err.message }
            : item
        ))
      }
    }

    // Update content with new URLs
    if (newContent !== content) {
      onContentChange(newContent)
    }

    setIsUploading(false)
  }, [content, config, onContentChange, lang])

  return (
    <div className="image-upload-overlay" onClick={onClose}>
      <div className="image-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('imageUploadTitle', lang)}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="config-section">
            <h4>{t('picgoConfig', lang)}</h4>
            <div className="config-row">
              <label>{t('endpoint', lang)}:</label>
              <input
                type="text"
                value={config.endpoint}
                onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                placeholder="http://127.0.0.1:36677"
              />
            </div>
            <div className="config-row">
              <label>{t('uploadPath', lang)}:</label>
              <input
                type="text"
                value={config.uploadPath}
                onChange={(e) => setConfig({ ...config, uploadPath: e.target.value })}
                placeholder="/upload"
              />
              <button className="save-config-btn" onClick={handleSaveConfig}>
                {t('saveConfig', lang)}
              </button>
            </div>
          </div>

          <div className="upload-section">
            <button
              className="batch-upload-btn"
              onClick={handleBatchUpload}
              disabled={isUploading}
            >
              {isUploading 
                ? (lang === 'zh-CN' ? '上传中...' : 'Uploading...') 
                : (lang === 'zh-CN' ? '批量上传本地图片' : 'Batch Upload Local Images')}
            </button>
          </div>

          {uploadProgress.length > 0 && (
            <div className="progress-section">
              <h4>{t('uploadProgress', lang)}</h4>
              {uploadProgress.map((item, index) => (
                <div key={index} className={`progress-item ${item.status}`}>
                  <span className="filename">{item.name}</span>
                  <span className="status">
                    {item.status === 'uploading' && '⏳'}
                    {item.status === 'success' && '✓'}
                    {item.status === 'error' && '✗ ' + item.error}
                    {item.status === 'info' && 'ℹ️'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageUpload
