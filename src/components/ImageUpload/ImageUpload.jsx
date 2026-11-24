import { useState, useCallback } from 'react'
import { picgoService } from '../../services/imageUpload/picgo'
import { t } from '../../utils/i18n'
import './ImageUpload.css'

const isDesktop = window.electronAPI?.isElectron === true

function dataURLToBlob(dataUrl) {
  const [header, base64Data] = dataUrl.split(',')
  const mimeMatch = header.match(/data:([^;]+);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/webp'
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

function ImageUpload({ onClose, lang, content, onContentChange, picgoConfig, imageMap = {} }) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState([])
  const [config, setConfig] = useState(() => {
    if (picgoConfig) {
      return {
        endpoint: picgoConfig.endpoint,
        uploadPath: picgoConfig.uploadPath
      }
    }
    try {
      const saved = localStorage.getItem('tiny-md-picgo-config')
      if (saved) return JSON.parse(saved)
    } catch {
      // Fallback to default config on corrupt JSON
    }
    return {
      endpoint: 'http://127.0.0.1:36677',
      uploadPath: '/upload'
    }
  })

  const handleSaveConfig = useCallback(() => {
    localStorage.setItem('tiny-md-picgo-config', JSON.stringify(config))
    picgoService.updateConfig(config)
  }, [config])

  // Read local image file (prefer imageMap data URL, then desktop electron API, then fetch)
  const readLocalImage = useCallback(async (imagePath) => {
    const normalized = imagePath.replace(/\\/g, '/')
    if (imageMap?.[normalized]) return dataURLToBlob(imageMap[normalized])
    if (imageMap?.[imagePath]) return dataURLToBlob(imageMap[imagePath])
    if (isDesktop) {
      const result = await window.electronAPI.readImage({ filePath: imagePath })
      if (result.success) {
        const byteString = atob(result.data)
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i)
        }
        const blob = new Blob([ab], { type: result.mimeType })
        return blob
      }
      throw new Error(result.error || 'Failed to read image')
    } else {
      const response = await fetch(imagePath)
      if (!response.ok) {
        throw new Error('Failed to fetch image')
      }
      return await response.blob()
    }
  }, [imageMap])

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
      // Only process local file paths (not URLs or data URLs)
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
        name: img.url.split('/').pop(),
        status: 'uploading'
      }])

      try {
        const blob = await readLocalImage(img.url)
        const fileName = img.url.split('/').pop() || 'image.png'
        const file = new File([blob], fileName, { type: blob.type })

        const result = await picgoService.upload(file)

        setUploadProgress(prev => prev.map(item =>
          item.name === img.url.split('/').pop()
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
          item.name === img.url.split('/').pop()
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
  }, [content, config, onContentChange, lang, readLocalImage])

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
