import { useState, useCallback, useEffect, useRef, useMemo, useDeferredValue } from 'react'
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
import HljsTheme from './components/HljsTheme/HljsTheme'
import { useFileWorkspace, DEFAULT_CONTENT } from './hooks/useFileWorkspace'
import { useLocalStorage } from './hooks/useLocalStorage'
import { extractYAML, replaceYAML } from './utils/yaml'
import { extractMarkdownBody, renderMarkdown } from './utils/markdown'
import { PRESET_STYLES } from './components/StyleSelector/StyleSelector'
import { convertToWebP, blobToDataURL, saveImageFile, openLocalImage, isDesktop } from './utils/imageUtils'
import { t } from './utils/i18n'
import './App.css'

const DEFAULT_PANEL_SIZES = [15, 28.33, 28.33, 28.34]

function readStoredJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

// Make desktop folder tree node paths absolute so they match file entries
function absolutizeTree(nodes, folderPath) {
  return Object.fromEntries(
    Object.entries(nodes).map(([key, node]) => [
      key,
      node.isFolder
        ? { ...node, path: `${folderPath}/${node.path}`, children: absolutizeTree(node.children || {}, folderPath) }
        : { ...node, path: `${folderPath}/${node.path}` }
    ])
  )
}

function collectFilesFromTree(nodes, { folderPath = '', handleFromNode = false } = {}) {
  const out = []
  const walk = (list) => {
    Object.values(list).forEach(node => {
      if (node.isFolder) {
        walk(node.children || {})
      } else {
        const path = folderPath ? `${folderPath}/${node.path}` : node.path
        out.push({
          path,
          name: node.name,
          content: '',
          savedContent: '',
          isModified: false,
          loaded: false,
          fileHandle: handleFromNode ? node.handle : path
        })
      }
    })
  }
  walk(nodes)
  return out
}

function App() {
  const [initialState] = useState(() => ({
    content: typeof readStoredJSON('tiny-md-content') === 'string' ? readStoredJSON('tiny-md-content') : DEFAULT_CONTENT,
    fileName: typeof readStoredJSON('tiny-md-filename') === 'string' ? readStoredJSON('tiny-md-filename') : 'untitled.md'
  }))
  const ws = useFileWorkspace(initialState)
  const { state, isModified, isModifiedRef, setContent, upsertFile, activateFile, renameFile, removeFile, replaceFiles, saveFileToDisk, saveActiveFile, saveActiveFileAs } = ws
  const { content, fileName } = state

  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 })
  const [showYAMLModal, setShowYAMLModal] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPreviewYAML, setShowPreviewYAML] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [panelSizes, setPanelSizes] = useState(() => {
    const stored = readStoredJSON('tiny-md-panel-sizes')
    return Array.isArray(stored) && stored.length === 4 ? stored : DEFAULT_PANEL_SIZES
  })
  const editorRef = useRef(null)
  const previewRef = useRef(null)
  const containerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(null)
  const startPosRef = useRef(null)
  const startSizesRef = useRef(null)
  const dragFrameRef = useRef(0)
  const dragXRef = useRef(0)

  const [currentFolderPath, setCurrentFolderPath] = useState('')
  const [fileManagerCollapsed, setFileManagerCollapsed] = useState(false)
  const [folderTree, setFolderTree] = useState(null)

  // Image map: local path -> base64 data URL (for preview)
  const [imageMap, setImageMap] = useLocalStorage('tiny-md-image-map', {}, { debounce: 500 })

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

  const lang = config.language

  // Check if unsaved before dangerous actions
  const checkUnsaved = useCallback(() => {
    if (isModifiedRef.current) {
      return window.confirm(t('unsavedWarning', lang))
    }
    return true
  }, [isModifiedRef, lang])

  // Debounce preview & word count for large docs (>50KB) to keep typing latency < 50ms
  const [debouncedLargeContent, setDebouncedLargeContent] = useState(content)
  useEffect(() => {
    if (content.length <= 50 * 1024) return
    const timer = setTimeout(() => setDebouncedLargeContent(content), 150)
    return () => clearTimeout(timer)
  }, [content])

  const effectivePreviewContent = content.length > 50 * 1024 ? debouncedLargeContent : content
  const deferredContent = useDeferredValue(effectivePreviewContent)

  // Calculate word count (CJK-aware)
  const wordCount = useMemo(() => {
    const { body, hasYAML } = extractYAML(deferredContent)
    const text = hasYAML ? body : deferredContent
    const trimmed = text.trim()
    if (!trimmed) return 0
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
      let count = 0
      for (const segment of segmenter.segment(trimmed)) {
        if (segment.isWordLike) count++
      }
      return count
    }
    return trimmed.split(/\s+/).filter(Boolean).length
  }, [deferredContent])

  // Clean up image map entries no longer referenced in content
  useEffect(() => {
    if (Object.keys(imageMap).length === 0) return

    const referencedPaths = new Set()
    const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g
    let match
    while ((match = imageRegex.exec(content)) !== null) {
      referencedPaths.add(match[1].replace(/\\/g, '/'))
    }

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

  // Persist document content and filename (debounced to avoid writing on every keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('tiny-md-content', JSON.stringify(state.content))
      } catch (err) {
        console.error('Error writing to localStorage:', err)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [state.content])

  useEffect(() => {
    try {
      localStorage.setItem('tiny-md-filename', JSON.stringify(state.fileName))
    } catch (err) {
      console.error('Error writing to localStorage:', err)
    }
  }, [state.fileName])

  // Before unload warning (browser only; desktop uses close-confirmation IPC)
  useEffect(() => {
    if (isDesktop) return

    const handleBeforeUnload = (e) => {
      if (isModifiedRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isModifiedRef])

  // Desktop: ask the renderer before closing a window with unsaved changes
  useEffect(() => {
    if (!isDesktop || !window.electronAPI.onCloseRequested) return

    const unsubscribe = window.electronAPI.onCloseRequested(() => {
      let proceed = true
      if (isModifiedRef.current) {
        proceed = window.confirm(t('unsavedWarning', lang))
      }
      window.electronAPI.confirmClose(proceed)
    })
    return unsubscribe
  }, [isModifiedRef, lang])

  // Panel resize handlers (requestAnimationFrame throttled)
  const applyDrag = useCallback(() => {
    dragFrameRef.current = 0
    if (isDragging === null || !containerRef.current) return

    const containerWidth = containerRef.current.offsetWidth
    const deltaPercent = ((dragXRef.current - startPosRef.current) / containerWidth) * 100

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

  const handleMouseMove = useCallback((e) => {
    dragXRef.current = e.clientX
    if (!dragFrameRef.current) {
      dragFrameRef.current = requestAnimationFrame(applyDrag)
    }
  }, [applyDrag])

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    try {
      localStorage.setItem('tiny-md-panel-sizes', JSON.stringify(panelSizes))
    } catch { /* ignore */ }
  }, [panelSizes])

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
      if (dragFrameRef.current) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = 0
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleMouseDown = useCallback((index, e) => {
    e.preventDefault()
    setIsDragging(index)
    startPosRef.current = e.clientX
    dragXRef.current = e.clientX
    startSizesRef.current = [...panelSizes]
  }, [panelSizes])

  const insertImageMarkdown = useCallback((normalizedPath, savedCursorPos) => {
    const imageMarkdown = `![image](${normalizedPath})`

    if (savedCursorPos >= 0 && editorRef.current?.insertAtPos) {
      editorRef.current.insertAtPos(imageMarkdown, savedCursorPos)
      return
    }

    if (editorRef.current?.insertAtCursor) {
      editorRef.current.insertAtCursor(imageMarkdown)
      return
    }

    setContent(`${state.content}\n${imageMarkdown}`)
  }, [state.content, setContent])

  const handleClipboardImage = useCallback(async (file) => {
    try {
      // Save cursor position before opening dialog
      const savedCursorPos = editorRef.current?.getCursorPos?.() ?? -1

      const imageName = `image_${Date.now()}.webp`

      const blob = await convertToWebP(file)
      const dataUrl = await blobToDataURL(blob)
      const savedPath = await saveImageFile(blob, imageName)

      // If user cancelled or save failed, don't insert
      if (!savedPath) return

      // Normalize path to use forward slashes for consistency
      const normalizedPath = savedPath.replace(/\\/g, '/')
      setImageMap(prev => ({ ...prev, [normalizedPath]: dataUrl }))

      insertImageMarkdown(normalizedPath, savedCursorPos)
    } catch (err) {
      console.error('Failed to process clipboard image:', err)
    }
  }, [setImageMap, insertImageMarkdown])

  const handleSelectLocalImage = useCallback(async () => {
    try {
      const savedCursorPos = editorRef.current?.getCursorPos?.() ?? -1

      const result = await openLocalImage()
      if (!result) return

      const { path: imagePath, name, file } = result
      const normalizedPath = imagePath.replace(/\\/g, '/')

      // If we have a file object (browser mode), convert for preview
      if (file) {
        const blob = await convertToWebP(file)
        const dataUrl = await blobToDataURL(blob)
        setImageMap(prev => ({
          ...prev,
          [normalizedPath]: dataUrl,
          [name]: dataUrl
        }))
      }

      insertImageMarkdown(normalizedPath, savedCursorPos)
    } catch (err) {
      console.error('Failed to select local image:', err)
    }
  }, [setImageMap, insertImageMarkdown])

  // Sync scroll between editor and preview
  const handleEditorScroll = useCallback((scrollInfo) => {
    const preview = previewRef.current
    if (!preview) return
    const maxSource = scrollInfo.scrollHeight - scrollInfo.clientHeight
    const maxTarget = preview.scrollHeight - preview.clientHeight
    if (maxSource <= 0 || maxTarget <= 0) return
    preview.scrollTop = (scrollInfo.scrollTop / maxSource) * maxTarget
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

  const handleCursorChange = useCallback((line, column) => {
    setCursorPos({ line, column })
  }, [])

  const handleSaveFile = useCallback(async () => {
    const saved = await saveActiveFile()
    if (!saved) await saveActiveFileAs()
  }, [saveActiveFile, saveActiveFileAs])

  const handleSaveAsFile = useCallback(() => saveActiveFileAs(), [saveActiveFileAs])

  const handleNewFile = useCallback(() => {
    if (!checkUnsaved()) return
    upsertFile(makeDefaultFileForNew())
  }, [checkUnsaved, upsertFile])

  const handleNewFileWithManager = useCallback(() => {
    if (!checkUnsaved()) return
    const newFileName = `untitled-${Date.now()}.md`
    upsertFile(makeDefaultFileForNew(newFileName))
  }, [checkUnsaved, upsertFile])

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
    setContent(hasYAML ? replaceYAML(content, yamlContent) : `${yamlContent}\n\n${content}`)
    setShowYAMLModal(false)
  }, [content, fileName, setContent])

  const handleConfigSave = useCallback((newConfig) => {
    setConfig(newConfig)
  }, [setConfig])

  // Load file content on demand (folder files are lazy)
  const loadFileContent = useCallback(async (file) => {
    if (isDesktop && typeof file.fileHandle === 'string') {
      const result = await window.electronAPI.readFile({ filePath: file.fileHandle })
      if (result.success) return result.content
      throw new Error(result.error || 'Failed to read file')
    }
    if (file.fileHandle?.getFile) {
      const f = await file.fileHandle.getFile()
      return await f.text()
    }
    return file.content
  }, [])

  const handleFileSelect = useCallback(async (filePath) => {
    const file = state.files.find(f => f.path === filePath)
    if (!file || file.path === state.currentPath) return
    if (!checkUnsaved()) return

    if (file.loaded) {
      activateFile(filePath)
      return
    }

    try {
      const text = await loadFileContent(file)
      upsertFile({ ...file, content: text, savedContent: text, isModified: false, loaded: true })
    } catch (err) {
      console.error('Failed to load file:', filePath, err)
    }
  }, [state.files, state.currentPath, checkUnsaved, activateFile, upsertFile, loadFileContent])

  const refreshFolderTree = useCallback(async () => {
    if (!isDesktop || !currentFolderPath) return
    try {
      const result = await window.electronAPI.readDirectory({ dirPath: currentFolderPath })
      if (result.success) {
        setFolderTree(absolutizeTree(result.entries, currentFolderPath))
      }
    } catch (err) {
      console.error('Failed to refresh folder tree:', err)
    }
  }, [currentFolderPath])

  const isDiskFile = useCallback((file) => {
    return isDesktop && typeof file?.fileHandle === 'string' && file.path === file.fileHandle
  }, [])

  const handleFileRename = useCallback(async (oldPath, newName) => {
    const file = state.files.find(f => f.path === oldPath)
    if (!file) return

    if (isDiskFile(file)) {
      const lastSlash = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'))
      const newPath = oldPath.slice(0, lastSlash + 1) + newName
      try {
        await window.electronAPI.renameFile({ oldPath, newPath })
      } catch (err) {
        alert(t('renameFailed', lang).replace('{message}', err.message))
        return
      }
      renameFile(oldPath, newName, newPath)
      refreshFolderTree()
      return
    }

    renameFile(oldPath, newName)
  }, [state.files, isDiskFile, renameFile, refreshFolderTree, lang])

  const handleFileDelete = useCallback(async (filePath) => {
    if (!window.confirm(t('deleteFileConfirm', lang))) return

    const file = state.files.find(f => f.path === filePath)
    if (isDiskFile(file)) {
      try {
        await window.electronAPI.deleteFile({ filePath })
      } catch (err) {
        alert(t('deleteFailed', lang).replace('{message}', err.message))
        return
      }
    }

    removeFile(filePath)
    if (isDiskFile(file)) refreshFolderTree()
  }, [state.files, isDiskFile, removeFile, refreshFolderTree, lang])

  // Close a file, saving ITS OWN content (not the active document) when asked
  const handleFileClose = useCallback(async (filePath) => {
    const file = state.files.find(f => f.path === filePath)
    if (!file) return

    if (file.isModified) {
      const message = t('closeUnsavedConfirm', lang).replace('{name}', file.name)
      if (window.confirm(message)) {
        const saved = await saveFileToDisk(file)
        if (!saved && file.path === state.currentPath) {
          // No existing handle for the active document — fall back to Save As
          await saveActiveFileAs()
        }
      }
    }

    removeFile(filePath)
  }, [state.files, state.currentPath, lang, saveFileToDisk, saveActiveFileAs, removeFile])

  const handleOpenFile = useCallback(async () => {
    if (!checkUnsaved()) return

    const addOpenedFile = (path, name, text, handle) => {
      upsertFile({
        path,
        name,
        content: text,
        savedContent: text,
        isModified: false,
        fileHandle: handle,
        loaded: true
      })
    }

    try {
      if (isDesktop) {
        const result = await window.electronAPI.openFileDialog()
        if (result.success) {
          addOpenedFile(result.filePath, result.fileName, result.content, result.filePath)
        }
      } else if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Markdown Files',
            accept: { 'text/markdown': ['.md'] }
          }]
        })
        const file = await handle.getFile()
        const text = await file.text()
        addOpenedFile(file.name, file.name, text, handle)
      } else {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.md'
        input.onchange = async (e) => {
          const file = e.target.files[0]
          if (file) {
            const text = await file.text()
            addOpenedFile(file.name, file.name, text, null)
          }
        }
        input.click()
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to open file:', err)
      }
    }
  }, [checkUnsaved, upsertFile])

  // Recursively build directory tree (browser File System Access API, lazy)
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
      } else if (/\.(md|markdown)$/i.test(entry.name)) {
        entries[entry.name] = {
          name: entry.name,
          path: entryPath,
          isFolder: false,
          handle: entry
        }
      }
    }

    return entries
  }, [])

  const handleOpenFolder = useCallback(async () => {
    if (!checkUnsaved()) return

    try {
      if (isDesktop) {
        setIsLoading(true)
        const result = await window.electronAPI.openFolderDialog()

        if (result.success) {
          const dirResult = await window.electronAPI.readDirectory({
            dirPath: result.folderPath
          })

          if (dirResult.success) {
            setCurrentFolderPath(result.folderPath)
            const tree = absolutizeTree(dirResult.entries, result.folderPath)
            setFolderTree(tree)

            const allFiles = collectFilesFromTree(tree)
            replaceFiles(allFiles, false)

            if (allFiles.length > 0) {
              const first = allFiles[0]
              const text = await loadFileContent(first)
              upsertFile({ ...first, content: text, savedContent: text, loaded: true })
            } else {
              replaceFiles([], true)
            }
          }
        }
        return
      }

      if (window.showDirectoryPicker) {
        setIsLoading(true)
        const handle = await window.showDirectoryPicker()

        const tree = await readDirectory(handle)
        setFolderTree(tree)
        setCurrentFolderPath('')

        const allFiles = collectFilesFromTree(tree, { handleFromNode: true })
        replaceFiles(allFiles, false)

        if (allFiles.length > 0) {
          const first = allFiles[0]
          const text = await loadFileContent(first)
          upsertFile({ ...first, content: text, savedContent: text, loaded: true })
        } else {
          replaceFiles([], true)
        }
      } else {
        alert(t('openFolderUnsupported', lang))
      }
    } catch (err) {
      if (err.name && err.name !== 'AbortError') {
        console.error('Failed to open folder:', err)
        alert(t('folderOpenFailed', lang).replace('{message}', err.message))
      }
    } finally {
      setIsLoading(false)
    }
  }, [checkUnsaved, readDirectory, loadFileContent, lang, replaceFiles, upsertFile])

  const handleExportHtml = useCallback(() => {
    const safeHtml = renderMarkdown(extractMarkdownBody(content))
    const docHtml = `<!DOCTYPE html>
<html lang="${config.language}">
<head>
<meta charset="UTF-8" />
<title>${fileName.replace(/\.md$/i, '')}</title>
<style>body{max-width:860px;margin:2rem auto;padding:0 1rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.6;}pre{background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:6px;overflow:auto;}</style>
</head>
<body>${safeHtml}</body>
</html>`
    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.replace(/\.md$/i, '') + '.html'
    a.click()
    URL.revokeObjectURL(url)
  }, [content, config.language, fileName])

  const handleExportPdf = useCallback(() => {
    window.print()
  }, [])

  // Keyboard shortcuts (case-insensitive for Windows Ctrl+Shift+S/Y/P)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey
      const key = (e.key || '').toLowerCase()

      if (isCtrl && key === 's') {
        e.preventDefault()
        if (e.shiftKey) {
          handleSaveAsFile()
        } else {
          handleSaveFile()
        }
      } else if (isCtrl && !e.shiftKey && key === 'n') {
        e.preventDefault()
        handleNewFile()
      } else if (isCtrl && !e.shiftKey && key === 'o') {
        e.preventDefault()
        handleOpenFile()
      } else if (isCtrl && e.shiftKey && key === 'y') {
        e.preventDefault()
        setShowYAMLModal(true)
      } else if (isCtrl && e.shiftKey && key === 'p') {
        e.preventDefault()
        setShowImageUpload(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveFile, handleSaveAsFile, handleNewFile, handleOpenFile])

  return (
    <div className={`app ${config.theme}`}>
      <HljsTheme theme={config.theme} />
      <Toolbar
        onNew={handleNewFile}
        onOpen={handleOpenFile}
        onSave={handleSaveFile}
        onSaveAs={handleSaveAsFile}
        onExportHtml={handleExportHtml}
        onExportPdf={handleExportPdf}
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
            files={state.files}
            currentFile={state.currentPath}
            isModified={isModified}
            onFileSelect={handleFileSelect}
            onFileRename={handleFileRename}
            onFileDelete={handleFileDelete}
            onFileClose={handleFileClose}
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
            {t('sourcePanel', config.language)}
          </div>
          <QuickEdit
            editorRef={editorRef}
            content={content}
            onChange={setContent}
            onSelectLocalImage={handleSelectLocalImage}
            lang={config.language}
          />
          <div className="panel-content">
            <Editor
              ref={editorRef}
              value={content}
              onChange={setContent}
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
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('previewPanel', config.language)}</span>
            <button
              className="yaml-toggle-btn"
              onClick={() => setShowPreviewYAML((prev) => !prev)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              {showPreviewYAML ? t('hideYaml', config.language) : t('showYaml', config.language)}
            </button>
          </div>
          <div className="panel-content" ref={previewRef}>
            <Preview
              content={deferredContent}
              theme={config.theme}
              imageMap={imageMap}
              currentStyle={currentStyle}
              customStyles={customStyles}
              currentFilePath={state.currentPath}
              currentFolderPath={currentFolderPath}
              showYAML={showPreviewYAML}
            />
          </div>
          <div className="resize-handle" onMouseDown={(e) => handleMouseDown(2, e)}>
            <div className="resize-handle-bar" />
          </div>
        </div>

        <div className="panel" style={{ width: `${panelSizes[3]}%` }}>
          <div className="panel-header">
            {t('translationPanel', config.language)}
          </div>
          <Translation
            content={content}
            onTranslated={setContent}
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
          imageMap={imageMap}
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

// New file factories (kept outside App to avoid re-creation per render)
function makeDefaultFileForNew(name = 'untitled.md') {
  return {
    path: name,
    name,
    content: DEFAULT_CONTENT,
    savedContent: DEFAULT_CONTENT,
    isModified: false,
    fileHandle: null,
    loaded: true
  }
}

export default App
