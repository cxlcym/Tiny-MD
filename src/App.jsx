import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Toolbar from './components/Toolbar/Toolbar'
import FileManager from './components/FileManager/FileManager'
import Editor from './components/Editor/Editor'
import Preview from './components/Preview/Preview'
import Translation from './components/Translation/Translation'
import StatusBar from './components/StatusBar/StatusBar'
import YAMLTemplateModal from './components/YAMLTemplate/YAMLTemplateModal'
import ImageUpload from './components/ImageUpload/ImageUpload'
import SettingsModal from './components/Settings/SettingsModal'
import QuickEdit from './components/QuickEdit/QuickEdit'
import { useLocalStorage } from './hooks/useLocalStorage'
import { extractYAML, replaceYAML } from './utils/yaml'
import { PRESET_STYLES } from './components/StyleSelector/StyleSelector'
import './App.css'

const DEFAULT_CONTENT = `---
title: Welcome to Tiny MD
date: ${new Date().toISOString().split('T')[0]}
tags: []
categories: []
cover: 
description: 
---

# Hello Tiny MD

This is a smart Markdown editor for developers.

## Features

- Real-time preview
- YAML template system
- Translation support
- PicGo image upload
`

function App() {
  const [content, setContent] = useLocalStorage('tiny-md-content', DEFAULT_CONTENT)
  const [fileName, setFileName] = useLocalStorage('tiny-md-filename', 'untitled.md')
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 })
  const [showYAMLModal, setShowYAMLModal] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [panelSizes, setPanelSizes] = useState([15, 28.33, 28.33, 28.34])
  const editorRef = useRef(null)
  const previewRef = useRef(null)
  const containerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(null)
  const startPosRef = useRef(null)
  const startSizesRef = useRef(null)
  
  // Track saved content and file handle for proper save
  const [savedContent, setSavedContent] = useState(content)
  const [fileHandle, setFileHandle] = useState(null)
  const isModified = content !== savedContent
  
  // File manager state
  const [files, setFiles] = useState([
    {
      path: fileName,
      name: fileName,
      content: content,
      savedContent: savedContent,
      isModified: isModified,
      fileHandle: fileHandle
    }
  ])
  const [currentFilePath, setCurrentFilePath] = useState(fileName)
  const [fileManagerCollapsed, setFileManagerCollapsed] = useState(false)
  const [folderTree, setFolderTree] = useState(null)
  
  // Image map: local path -> base64 data URL (for preview)
  const [imageMap, setImageMap] = useLocalStorage('tiny-md-image-map', {})
  
  // Preview style
  const [currentStyle, setCurrentStyle] = useLocalStorage('tiny-md-style', 'default')
  const [customStyles, setCustomStyles] = useLocalStorage('tiny-md-custom-styles', [])
  
  // App configuration
  const [config, setConfig] = useLocalStorage('tiny-md-config', {
    language: 'en',
    theme: 'dark',
    picgoEndpoint: 'http://127.0.0.1:36677',
    picgoUploadPath: '/upload',
    llmApiKey: '',
    llmApiUrl: 'https://api.openai.com/v1/chat/completions',
    llmTranslationPrompt: 'You are a professional translator. Translate the following markdown content to {{targetLanguage}}. Keep all markdown formatting, code blocks, and links intact. Only translate the text content. Do not add any explanations.',
    deeplApiKey: '',
    libretranslateEndpoint: 'https://libretranslate.com',
    imageBed: 'picgo',
    cloudflareR2: {
      accountId: '',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
      publicUrl: ''
    },
    awsS3: {
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
      region: 'us-east-1',
      endpoint: ''
    }
  })

  const [templates, setTemplates] = useLocalStorage('tiny-md-templates', [
    {
      id: 'hugo',
      name: 'Hugo Blog',
      content: `---
title: {{title}}
date: {{date}}
draft: false
tags: []
categories: []
cover: {{image}}
description: ""
---`
    },
    {
      id: 'hexo',
      name: 'Hexo Blog',
      content: `---
title: {{title}}
date: {{date}}
tags: []
categories: []
photos: []
---`
    }
  ])

  // Check if unsaved before dangerous actions
  const checkUnsaved = useCallback(() => {
    if (isModified) {
      const lang = config.language
      const message = lang === 'zh-CN' 
        ? '当前文件未保存，是否继续？' 
        : 'Current file is not saved. Continue?'
      return window.confirm(message)
    }
    return true
  }, [isModified, config.language])

  // Calculate word count
  const wordCount = useMemo(() => {
    const text = content.replace(/---[\s\S]*?---/, '').trim()
    return text.split(/\s+/).filter(w => w.length > 0).length
  }, [content])

  // Clean up unused images from imageMap
  useEffect(() => {
    if (Object.keys(imageMap).length === 0) return

    // Find all image paths referenced in content
    const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g
    const referencedPaths = new Set()
    let match

    while ((match = imageRegex.exec(content)) !== null) {
      const src = match[1]
      if (src.startsWith('./')) {
        referencedPaths.add(src)
      }
    }

    // Remove unused entries from imageMap
    const newImageMap = {}
    let hasChanges = false

    for (const [path, dataUrl] of Object.entries(imageMap)) {
      if (referencedPaths.has(path)) {
        newImageMap[path] = dataUrl
      } else {
        hasChanges = true
      }
    }

    if (hasChanges) {
      setImageMap(newImageMap)
    }
  }, [content, imageMap, setImageMap])

  // Apply theme
  useEffect(() => {
    document.body.className = config.theme
  }, [config.theme])

  // Before unload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isModified) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isModified])

  // Panel resize handlers
  const handleMouseDown = useCallback((index, e) => {
    e.preventDefault()
    setIsDragging(index)
    startPosRef.current = e.clientX
    startSizesRef.current = [...panelSizes]
  }, [panelSizes])

  const handleMouseMove = useCallback((e) => {
    if (isDragging === null || !containerRef.current) return

    const containerWidth = containerRef.current.offsetWidth
    const deltaX = e.clientX - startPosRef.current
    const deltaPercent = (deltaX / containerWidth) * 100

    const newSizes = [...startSizesRef.current]
    const leftIndex = isDragging
    const rightIndex = isDragging + 1

    const minSize = 15

    const leftNew = Math.max(minSize, Math.min(70, newSizes[leftIndex] + deltaPercent))
    const rightNew = Math.max(minSize, Math.min(70, newSizes[rightIndex] - deltaPercent))

    if (leftNew >= minSize && rightNew >= minSize) {
      newSizes[leftIndex] = leftNew
      newSizes[rightIndex] = rightNew
      setPanelSizes(newSizes)
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    if (isDragging !== null) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Helper function to convert file to WebP blob
  const convertToWebP = (file) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.onload = (event) => {
        img.onerror = () => reject(new Error('Failed to load image'))
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Failed to convert to WebP'))
              }
            },
            'image/webp',
            0.9
          )
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  // Helper function to convert blob to data URL
  const blobToDataURL = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read blob'))
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  }

  // Helper function to save file using File System Access API or download
  const saveImageFile = async (blob, imageName) => {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: imageName,
          types: [{
            description: 'WebP Image',
            accept: { 'image/webp': ['.webp'] }
          }]
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return true
      } catch (err) {
        if (err.name === 'AbortError') {
          return false // User cancelled
        }
        // Fallback to download
      }
    }
    
    // Download fallback
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = imageName
    a.click()
    URL.revokeObjectURL(url)
    return true
  }

  const handleClipboardImage = useCallback(async (file) => {
    try {
      const timestamp = Date.now()
      const imageName = `image_${timestamp}.webp`
      const localPath = `./${imageName}`

      // Convert to WebP
      const blob = await convertToWebP(file)
      
      // Convert to data URL for preview
      const dataUrl = await blobToDataURL(blob)

      // Store in image map for preview
      setImageMap(prev => ({
        ...prev,
        [localPath]: dataUrl
      }))

      // Save file
      const saved = await saveImageFile(blob, imageName)
      
      if (saved) {
        // Insert local path reference
        const imageMarkdown = `![image](${localPath})\n`
        setContent(prev => prev + '\n' + imageMarkdown)
      }
    } catch (err) {
      console.error('Failed to process clipboard image:', err)
    }
  }, [setContent, setImageMap])

  // Sync scroll between editor and preview
  const handleEditorScroll = useCallback((scrollInfo) => {
    if (previewRef.current) {
      const scrollPercent = scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight)
      const previewScrollTop = scrollPercent * (previewRef.current.scrollHeight - previewRef.current.clientHeight)
      previewRef.current.scrollTop = previewScrollTop
    }
  }, [])

  // Clipboard paste image handling
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await handleClipboardImage(file)
          }
          break
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handleClipboardImage])

  const handleContentChange = useCallback((newContent) => {
    setContent(newContent)
    // Update files array when content changes
    setFiles(prevFiles => {
      return prevFiles.map(file => {
        if (file.path === currentFilePath) {
          return {
            ...file,
            content: newContent,
            savedContent: savedContent,
            isModified: newContent !== savedContent,
            fileHandle: fileHandle
          }
        }
        return file
      })
    })
  }, [setContent, currentFilePath, savedContent, fileHandle])

  const handleCursorChange = useCallback((line, column) => {
    setCursorPos({ line, column })
  }, [])

  const handleNewFile = useCallback(() => {
    if (!checkUnsaved()) return
    
    const newFileName = 'untitled.md'
    const newFile = {
      path: newFileName,
      name: newFileName,
      content: DEFAULT_CONTENT,
      savedContent: DEFAULT_CONTENT,
      isModified: false,
      fileHandle: null
    }
    
    setFiles(prevFiles => {
      const existingIndex = prevFiles.findIndex(f => f.path === newFileName)
      if (existingIndex >= 0) {
        return prevFiles.map((f, i) => i === existingIndex ? newFile : f)
      }
      return [...prevFiles, newFile]
    })
    
    setContent(DEFAULT_CONTENT)
    setFileName(newFileName)
    setSavedContent(DEFAULT_CONTENT)
    setFileHandle(null)
    setCurrentFilePath(newFileName)
  }, [checkUnsaved, setContent, setFileName, setSavedContent, setFileHandle])

  const handleOpenFile = useCallback(async () => {
    if (!checkUnsaved()) return
    
    try {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Markdown Files',
            accept: { 'text/markdown': ['.md'] }
          }]
        })
        const file = await handle.getFile()
        const text = await file.text()
        const newFile = {
          path: file.name,
          name: file.name,
          content: text,
          savedContent: text,
          isModified: false,
          fileHandle: handle
        }
        
        setFiles(prevFiles => {
          const existingIndex = prevFiles.findIndex(f => f.path === file.name)
          if (existingIndex >= 0) {
            return prevFiles.map((f, i) => i === existingIndex ? newFile : f)
          }
          return [...prevFiles, newFile]
        })
        
        setContent(text)
        setFileName(file.name)
        setSavedContent(text)
        setFileHandle(handle)
        setCurrentFilePath(file.name)
      } else {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.md'
        input.onchange = async (e) => {
          const file = e.target.files[0]
          if (file) {
            const text = await file.text()
            const newFile = {
              path: file.name,
              name: file.name,
              content: text,
              savedContent: text,
              isModified: false,
              fileHandle: null
            }
            
            setFiles(prevFiles => {
              const existingIndex = prevFiles.findIndex(f => f.path === file.name)
              if (existingIndex >= 0) {
                return prevFiles.map((f, i) => i === existingIndex ? newFile : f)
              }
              return [...prevFiles, newFile]
            })
            
            setContent(text)
            setFileName(file.name)
            setSavedContent(text)
            setFileHandle(null)
            setCurrentFilePath(file.name)
          }
        }
        input.click()
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to open file:', err)
      }
    }
  }, [checkUnsaved, setContent, setFileName, setSavedContent, setFileHandle])

  const handleSaveFile = useCallback(async () => {
    try {
      // If we have a file handle, write directly to it
      if (fileHandle) {
        const writable = await fileHandle.createWritable()
        await writable.write(content)
        await writable.close()
        setSavedContent(content)
        return
      }
      
      // Otherwise, use File System Access API to pick save location
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Markdown Files',
            accept: { 'text/markdown': ['.md'] }
          }]
        })
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        setSavedContent(content)
        setFileHandle(handle)
        setFileName(handle.name)
      } else {
        // Fallback: download file
        const blob = new Blob([content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
        setSavedContent(content)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err)
      }
    }
  }, [content, fileName, fileHandle, setSavedContent, setFileHandle, setFileName])

  const handleSaveAsFile = useCallback(async () => {
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Markdown Files',
            accept: { 'text/markdown': ['.md'] }
          }]
        })
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        setSavedContent(content)
        setFileHandle(handle)
        setFileName(handle.name)
      } else {
        // Fallback: download file
        const blob = new Blob([content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
        setSavedContent(content)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err)
      }
    }
  }, [content, fileName, setSavedContent, setFileHandle, setFileName])

  // Keyboard shortcuts (must be after function definitions)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey

      if (isCtrl && e.key === 's') {
        e.preventDefault()
        if (e.shiftKey) {
          handleSaveAsFile()
        } else {
          handleSaveFile()
        }
      } else if (isCtrl && e.key === 'n') {
        e.preventDefault()
        handleNewFile()
      } else if (isCtrl && e.key === 'o') {
        e.preventDefault()
        handleOpenFile()
      } else if (isCtrl && e.shiftKey && e.key === 'Y') {
        e.preventDefault()
        setShowYAMLModal(true)
      } else if (isCtrl && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        setShowImageUpload(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveFile, handleSaveAsFile, handleNewFile, handleOpenFile])

  const handleApplyTemplate = useCallback((template) => {
    const yamlContent = template.content
      .replace(/\{\{title\}\}/g, fileName.replace('.md', ''))
      .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0])
      .replace(/\{\{time\}\}/g, Date.now().toString())
      .replace(/\{\{datetime\}\}/g, new Date().toLocaleString())
      .replace(/\{\{image\}\}/g, '')
      .replace(/\{\{category\}\}/g, '')
      .replace(/\{\{tags\}\}/g, '[]')

    const { hasYAML } = extractYAML(content)
    const newContent = hasYAML ? replaceYAML(content, yamlContent) : `${yamlContent}\n\n${content}`
    setContent(newContent)
    setShowYAMLModal(false)
  }, [content, fileName, setContent])

  const handleConfigSave = useCallback((newConfig) => {
    setConfig(newConfig)
  }, [setConfig])

  // File manager handlers
  const handleFileSelect = useCallback((filePath) => {
    if (!checkUnsaved()) return
    
    const file = files.find(f => f.path === filePath)
    if (file) {
      setContent(file.content)
      setSavedContent(file.savedContent)
      setFileName(file.name)
      setCurrentFilePath(file.path)
      setFileHandle(file.fileHandle)
    }
  }, [files, checkUnsaved, setContent, setSavedContent, setFileName])

  const handleFileRename = useCallback((oldPath, newName) => {
    setFiles(prevFiles => {
      return prevFiles.map(file => {
        if (file.path === oldPath) {
          const newPath = newName
          return {
            ...file,
            path: newPath,
            name: newName
          }
        }
        return file
      })
    })
    
    if (currentFilePath === oldPath) {
      setFileName(newName)
      setCurrentFilePath(newName)
    }
  }, [currentFilePath, setFileName])

  const handleFileDelete = useCallback((filePath) => {
    const lang = config.language
    const message = lang === 'zh-CN' 
      ? '确定要删除这个文件吗？' 
      : 'Are you sure you want to delete this file?'
    
    if (!window.confirm(message)) return
    
    setFiles(prevFiles => {
      const newFiles = prevFiles.filter(f => f.path !== filePath)
      
      if (newFiles.length === 0) {
        const defaultFile = {
          path: 'untitled.md',
          name: 'untitled.md',
          content: DEFAULT_CONTENT,
          savedContent: DEFAULT_CONTENT,
          isModified: false,
          fileHandle: null
        }
        setContent(DEFAULT_CONTENT)
        setSavedContent(DEFAULT_CONTENT)
        setFileName('untitled.md')
        setCurrentFilePath('untitled.md')
        setFileHandle(null)
        return [defaultFile]
      }
      
      if (currentFilePath === filePath) {
        const nextFile = newFiles[0]
        setContent(nextFile.content)
        setSavedContent(nextFile.savedContent)
        setFileName(nextFile.name)
        setCurrentFilePath(nextFile.path)
        setFileHandle(nextFile.fileHandle)
      }
      
      return newFiles
    })
  }, [currentFilePath, config.language, setContent, setSavedContent, setFileName])

  const handleNewFileWithManager = useCallback(() => {
    if (!checkUnsaved()) return
    
    const newFileName = `untitled-${Date.now()}.md`
    const newFile = {
      path: newFileName,
      name: newFileName,
      content: DEFAULT_CONTENT,
      savedContent: DEFAULT_CONTENT,
      isModified: false,
      fileHandle: null
    }
    
    setFiles(prevFiles => [...prevFiles, newFile])
    setContent(DEFAULT_CONTENT)
    setSavedContent(DEFAULT_CONTENT)
    setFileName(newFileName)
    setCurrentFilePath(newFileName)
    setFileHandle(null)
  }, [checkUnsaved, setContent, setSavedContent, setFileName])

  // Recursively read directory contents
  const readDirectory = useCallback(async (dirHandle, path = '') => {
    const entries = {}
    
    for await (const entry of dirHandle.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name
      
      if (entry.kind === 'directory') {
        const subEntries = await readDirectory(entry, entryPath)
        entries[entry.name] = {
          name: entry.name,
          path: entryPath,
          isFolder: true,
          children: subEntries,
          handle: entry
        }
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
        try {
          const file = await entry.getFile()
          const text = await file.text()
          entries[entry.name] = {
            name: entry.name,
            path: entryPath,
            isFolder: false,
            content: text,
            savedContent: text,
            isModified: false,
            handle: entry
          }
        } catch (err) {
          console.error('Failed to read file:', entry.name, err)
        }
      }
    }
    
    return entries
  }, [])

  const handleOpenFolder = useCallback(async () => {
    if (!checkUnsaved()) return
    
    try {
      if (window.showDirectoryPicker) {
        setIsLoading(true)
        const handle = await window.showDirectoryPicker()
        
        const tree = await readDirectory(handle)
        setFolderTree(tree)
        
        // Collect all markdown files from tree
        const allFiles = []
        const flattenTree = (nodes) => {
          Object.values(nodes).forEach(node => {
            if (node.isFolder && node.children) {
              flattenTree(node.children)
            } else if (!node.isFolder && node.content !== undefined) {
              allFiles.push({
                path: node.path,
                name: node.name,
                content: node.content,
                savedContent: node.savedContent,
                isModified: false,
                fileHandle: node.handle
              })
            }
          })
        }
        flattenTree(tree)
        
        if (allFiles.length > 0) {
          setFiles(allFiles)
          const firstFile = allFiles[0]
          setContent(firstFile.content)
          setSavedContent(firstFile.savedContent)
          setFileName(firstFile.name)
          setCurrentFilePath(firstFile.path)
          setFileHandle(firstFile.fileHandle)
        } else {
          setFiles([])
          setContent('')
          setSavedContent('')
          setFileName('untitled.md')
          setCurrentFilePath('')
          setFileHandle(null)
        }
        setIsLoading(false)
      } else {
        // Fallback for browsers without File System Access API
        alert(config.language === 'zh-CN' 
          ? '您的浏览器不支持打开文件夹功能。请使用 Chrome, Edge 或其他支持 File System Access API 的浏览器。' 
          : 'Your browser does not support opening folders. Please use Chrome, Edge or other browsers with File System Access API.')
      }
    } catch (err) {
      setIsLoading(false)
      if (err.name && err.name !== 'AbortError') {
        console.error('Failed to open folder:', err)
        alert(config.language === 'zh-CN' 
          ? '打开文件夹失败: ' + err.message 
          : 'Failed to open folder: ' + err.message)
      }
    }
  }, [checkUnsaved, readDirectory, config.language, setContent, setSavedContent, setFileName])

  return (
    <div className={`app ${config.theme}`}>
      <Toolbar
        onNew={handleNewFile}
        onOpen={handleOpenFile}
        onSave={handleSaveFile}
        onSaveAs={handleSaveAsFile}
        onYAMLTemplate={() => setShowYAMLModal(true)}
        onImageUpload={() => setShowImageUpload(true)}
        onSettings={() => setShowSettings(true)}
        currentStyle={currentStyle}
        onStyleChange={setCurrentStyle}
        customStyles={customStyles}
        onCustomStylesChange={setCustomStyles}
        lang={config.language}
        isModified={isModified}
      />
      <main className="main-content" ref={containerRef}>
        <div className="panel file-manager-panel" style={{ width: fileManagerCollapsed ? '32px' : `${panelSizes[0]}%` }}>
          <FileManager
            files={files}
            currentFile={currentFilePath}
            isModified={isModified}
            onFileSelect={handleFileSelect}
            onFileRename={handleFileRename}
            onFileDelete={handleFileDelete}
            onNewFile={handleNewFileWithManager}
            onOpenFile={handleOpenFile}
            onOpenFolder={handleOpenFolder}
            onCollapseChange={setFileManagerCollapsed}
            folderTree={folderTree}
            lang={config.language}
            isLoading={isLoading}
          />
          {!fileManagerCollapsed && (
            <div className="resize-handle" onMouseDown={(e) => handleMouseDown(0, e)}>
              <div className="resize-handle-bar" />
            </div>
          )}
        </div>
        
        <div className="panel" style={{ width: fileManagerCollapsed ? `${panelSizes[0] + panelSizes[1]}%` : `${panelSizes[1]}%` }}>
          <div className="panel-header">
            {config.language === 'zh-CN' ? '源码' : 'Source'}
          </div>
          <QuickEdit
            editorRef={editorRef}
            content={content}
            onChange={handleContentChange}
          />
          <div className="panel-content">
            <Editor
              ref={editorRef}
              value={content}
              onChange={handleContentChange}
              onCursorChange={handleCursorChange}
              onScroll={handleEditorScroll}
              theme={config.theme}
            />
          </div>
          <div className="resize-handle" onMouseDown={(e) => handleMouseDown(1, e)}>
            <div className="resize-handle-bar" />
          </div>
        </div>
        
        <div className="panel" style={{ width: `${panelSizes[2]}%` }}>
          <div className="panel-header">
            {config.language === 'zh-CN' ? '预览' : 'Preview'}
          </div>
          <div className="panel-content" ref={previewRef}>
            <Preview 
              content={content} 
              theme={config.theme} 
              imageMap={imageMap} 
              currentStyle={currentStyle}
              customStyles={customStyles}
            />
          </div>
          <div className="resize-handle" onMouseDown={(e) => handleMouseDown(2, e)}>
            <div className="resize-handle-bar" />
          </div>
        </div>
        
        <div className="panel" style={{ width: `${panelSizes[3]}%` }}>
          <div className="panel-header">
            {config.language === 'zh-CN' ? '翻译' : 'Translation'}
          </div>
          <Translation
            content={content}
            lang={config.language}
            llmConfig={{
              apiKey: config.llmApiKey,
              apiUrl: config.llmApiUrl,
              model: config.llmModel,
              translationPrompt: config.llmTranslationPrompt,
              deeplApiKey: config.deeplApiKey,
              libretranslateEndpoint: config.libretranslateEndpoint
            }}
          />
        </div>
      </main>
      <StatusBar
        fileName={fileName}
        wordCount={wordCount}
        cursorPos={cursorPos}
        lang={config.language}
        isModified={isModified}
      />
      {showYAMLModal && (
        <YAMLTemplateModal
          templates={templates}
          onApply={handleApplyTemplate}
          onSave={setTemplates}
          onClose={() => setShowYAMLModal(false)}
          lang={config.language}
        />
      )}
      {showImageUpload && (
        <ImageUpload
          onClose={() => setShowImageUpload(false)}
          lang={config.language}
          content={content}
          onContentChange={setContent}
          picgoConfig={{
            endpoint: config.picgoEndpoint,
            uploadPath: config.picgoUploadPath
          }}
        />
      )}
      {showSettings && (
        <SettingsModal
          config={config}
          onSave={handleConfigSave}
          onClose={() => setShowSettings(false)}
          lang={config.language}
        />
      )}
    </div>
  )
}

export default App
