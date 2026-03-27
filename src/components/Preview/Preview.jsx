import { useMemo, useEffect } from 'react'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { PRESET_STYLES } from '../StyleSelector/StyleSelector'
import './Preview.css'

marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (err) {
        console.error('Highlight error:', err)
      }
    }
    return hljs.highlightAuto(code).value
  }
})

function extractBodyContent(content) {
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (yamlMatch) {
    return content.slice(yamlMatch[0].length).trim()
  }
  return content
}

// Dynamic highlight.js theme loading
function loadHighlightTheme(theme) {
  const existingLink = document.getElementById('hljs-theme')
  if (existingLink) {
    existingLink.remove()
  }

  const link = document.createElement('link')
  link.id = 'hljs-theme'
  link.rel = 'stylesheet'
  link.href = theme === 'dark' 
    ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
    : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
  document.head.appendChild(link)
}

function Preview({ content, theme, imageMap, currentStyle, customStyles }) {
  // Load highlight.js theme based on app theme
  useEffect(() => {
    loadHighlightTheme(theme)
  }, [theme])

  // Get current style CSS
  const styleCss = useMemo(() => {
    const allStyles = [...PRESET_STYLES, ...(customStyles || [])]
    const style = allStyles.find(s => s.id === currentStyle)
    return style?.css || ''
  }, [currentStyle, customStyles])

  const html = useMemo(() => {
    let body = extractBodyContent(content)
    
    // Replace local image paths with base64 data URLs from imageMap
    if (imageMap && Object.keys(imageMap).length > 0) {
      body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        // Normalize the src path for comparison
        const normalizedSrc = src.replace(/\\/g, '/')
        
        // Check if this is a local path that we have a mapping for
        if (imageMap[normalizedSrc]) {
          return `![${alt}](${imageMap[normalizedSrc]})`
        }
        // Also try the original src
        if (imageMap[src]) {
          return `![${alt}](${imageMap[src]})`
        }
        return match
      })
    }
    
    return marked.parse(body)
  }, [content, imageMap])

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
