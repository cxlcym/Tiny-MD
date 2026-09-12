import { useMemo, useEffect, useState } from 'react'
import { PRESET_STYLES } from '../StyleSelector/StyleSelector'
import { extractMarkdownBody, renderMarkdown } from '../../utils/markdown'
import './Preview.css'

// Check if path is a local file path (not URL)
function isLocalPath(path) {
  if (!path) return false
  // Not a URL
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return false
  }
  // Is a relative or absolute path
  return true
}

// Resolve relative path to absolute path
function resolveImagePath(src, currentFilePath, currentFolderPath) {
  if (!src || !isLocalPath(src)) return src

  // Already absolute path
  if (src.startsWith('/') || src.match(/^[A-Za-z]:\\/)) {
    return src
  }

  // Relative path - resolve based on current file location
  if (src.startsWith('./') || src.startsWith('../')) {
    // Get directory of current file
    const filePath = currentFilePath || ''
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    const fileDir = lastSlash >= 0 ? filePath.substring(0, lastSlash) : ''

    if (fileDir) {
      // Simple path resolution
      let resolved = fileDir
      const parts = src.split('/')
      for (const part of parts) {
        if (part === '..') {
          const lastSlash2 = Math.max(resolved.lastIndexOf('/'), resolved.lastIndexOf('\\'))
          resolved = lastSlash2 >= 0 ? resolved.substring(0, lastSlash2) : ''
        } else if (part !== '.') {
          resolved = resolved ? `${resolved}/${part}` : part
        }
      }
      return resolved
    }

    // Fallback: use folder path
    if (currentFolderPath) {
      const cleanSrc = src.replace(/^\.\//, '')
      return `${currentFolderPath}/${cleanSrc}`
    }
  }

  // Plain filename - use folder path
  if (currentFolderPath) {
    return `${currentFolderPath}/${src}`
  }

  return src
}

// Check if running in Electron
const isDesktop = window.electronAPI?.isElectron === true

function Preview({ content, theme, imageMap, currentStyle, customStyles, currentFilePath, currentFolderPath }) {
  const [loadedImages, setLoadedImages] = useState({})

  // Get current style CSS
  const styleCss = useMemo(() => {
    const allStyles = [...PRESET_STYLES, ...(customStyles || [])]
    const style = allStyles.find(s => s.id === currentStyle)
    return style?.css || ''
  }, [currentStyle, customStyles])

  // Extract all image paths from content
  const imagePaths = useMemo(() => {
    const paths = []
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    let match
    while ((match = imageRegex.exec(content)) !== null) {
      const src = match[2]
      if (isLocalPath(src)) {
        const resolved = resolveImagePath(src, currentFilePath, currentFolderPath)
        paths.push({ original: src, resolved })
      }
    }
    return paths
  }, [content, currentFilePath, currentFolderPath])

  // Load images from local file system (desktop only)
  useEffect(() => {
    if (!isDesktop || imagePaths.length === 0) return

    let cancelled = false

    const loadImages = async () => {
      const newLoadedImages = {}

      for (const { original, resolved } of imagePaths) {
        if (cancelled) return
        // Skip if already in imageMap or loadedImages
        if (imageMap[original] || loadedImages[original]) continue
        if (imageMap[resolved] || loadedImages[resolved]) continue

        try {
          const result = await window.electronAPI.readImage({ filePath: resolved })
          if (result.success) {
            const dataUrl = `data:${result.mimeType};base64,${result.data}`
            newLoadedImages[original] = dataUrl
            newLoadedImages[resolved] = dataUrl
          }
        } catch (err) {
          console.error('Failed to load image:', resolved, err)
        }
      }

      if (!cancelled && Object.keys(newLoadedImages).length > 0) {
        setLoadedImages(prev => ({ ...prev, ...newLoadedImages }))
      }
    }

    loadImages()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePaths, imageMap])

  const html = useMemo(() => {
    let body = extractMarkdownBody(content)

    // Replace local image paths with data URLs from imageMap or loadedImages
    body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      // Normalize the src path for comparison
      const normalizedSrc = src.replace(/\\/g, '/')

      // Check imageMap first (user uploaded images)
      if (imageMap[normalizedSrc]) {
        return `![${alt}](${imageMap[normalizedSrc]})`
      }
      if (imageMap[src]) {
        return `![${alt}](${imageMap[src]})`
      }

      // Check loadedImages (local file system images)
      if (loadedImages[normalizedSrc]) {
        return `![${alt}](${loadedImages[normalizedSrc]})`
      }
      if (loadedImages[src]) {
        return `![${alt}](${loadedImages[src]})`
      }

      return match
    })

    return renderMarkdown(body)
  }, [content, imageMap, loadedImages])

  return (
    <div className={`preview-container ${theme}`}>
      {styleCss && <style>{styleCss}</style>}
      <div
        className="preview-content markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

export default Preview
