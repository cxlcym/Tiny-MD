import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { isDesktop } from '../utils/imageUtils'

export const DEFAULT_CONTENT = `---
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

function makeDefaultFile(overrides = {}) {
  return {
    path: 'untitled.md',
    name: 'untitled.md',
    content: DEFAULT_CONTENT,
    savedContent: DEFAULT_CONTENT,
    isModified: false,
    fileHandle: null,
    loaded: true,
    ...overrides
  }
}

function initWorkspace({ content, fileName }) {
  const file = makeDefaultFile({
    path: fileName,
    name: fileName,
    content,
    savedContent: content
  })
  return {
    files: [file],
    currentPath: file.path,
    fileName: file.name,
    content: file.content,
    savedContent: file.savedContent,
    fileHandle: file.fileHandle
  }
}

// Single source of truth for open files. The active document is mirrored on
// `content/savedContent/fileHandle` so the editor gets a stable prop, but all
// mutations flow through here so the two can never drift apart.
function workspaceReducer(state, action) {
  switch (action.type) {
    case 'SET_CONTENT': {
      const { content } = action
      if (content === state.content) return state
      return {
        ...state,
        content,
        files: state.files.map(f =>
          f.path === state.currentPath
            ? { ...f, content, isModified: content !== f.savedContent }
            : f
        )
      }
    }
    case 'UPSERT_FILE': {
      const file = action.file
      const exists = state.files.some(f => f.path === file.path)
      const files = exists
        ? state.files.map(f => (f.path === file.path ? { ...f, ...file } : f))
        : [...state.files, file]
      if (!action.activate) return { ...state, files }
      return {
        files,
        currentPath: file.path,
        fileName: file.name,
        content: file.content,
        savedContent: file.savedContent,
        fileHandle: file.fileHandle
      }
    }
    case 'ACTIVATE_FILE': {
      const file = state.files.find(f => f.path === action.path)
      if (!file || file.path === state.currentPath) return state
      return {
        ...state,
        currentPath: file.path,
        fileName: file.name,
        content: file.content,
        savedContent: file.savedContent,
        fileHandle: file.fileHandle
      }
    }
    case 'RENAME_FILE': {
      const { oldPath, newName, newPath } = action
      const isActive = state.currentPath === oldPath
      return {
        ...state,
        fileName: isActive ? newName : state.fileName,
        currentPath: isActive ? newPath : state.currentPath,
        files: state.files.map(f =>
          f.path === oldPath ? { ...f, path: newPath, name: newName } : f
        )
      }
    }
    case 'REMOVE_FILE': {
      const { path } = action
      const newFiles = state.files.filter(f => f.path !== path)
      if (newFiles.length === 0) {
        const fb = action.fallback || makeDefaultFile()
        return {
          files: [fb],
          currentPath: fb.path,
          fileName: fb.name,
          content: fb.content,
          savedContent: fb.savedContent,
          fileHandle: fb.fileHandle
        }
      }
      if (state.currentPath !== path) return { ...state, files: newFiles }
      const next = newFiles[0]
      return {
        files: newFiles,
        currentPath: next.path,
        fileName: next.name,
        content: next.content,
        savedContent: next.savedContent,
        fileHandle: next.fileHandle
      }
    }
    case 'MARK_SAVED': {
      const path = action.path || state.currentPath
      const isCurrent = path === state.currentPath
      return {
        ...state,
        ...(isCurrent
          ? { savedContent: state.content, ...(action.fileHandle !== undefined ? { fileHandle: action.fileHandle } : {}), ...(action.name ? { fileName: action.name } : {}) }
          : {}),
        files: state.files.map(f =>
          f.path === path
            ? {
                ...f,
                content: isCurrent ? state.content : f.content,
                savedContent: isCurrent ? state.content : f.content,
                isModified: false,
                ...(action.fileHandle !== undefined ? { fileHandle: action.fileHandle } : {}),
                ...(action.name ? { name: action.name } : {})
              }
            : f
        )
      }
    }
    case 'REPLACE_FILES': {
      const { files } = action
      if (!action.activate || files.length === 0) {
        if (action.activate && files.length === 0) {
          return { ...state, files, currentPath: '', content: '', savedContent: '', fileHandle: null }
        }
        return { ...state, files }
      }
      const first = files[0]
      return {
        files,
        currentPath: first.path,
        fileName: first.name,
        content: first.content,
        savedContent: first.savedContent,
        fileHandle: first.fileHandle
      }
    }
    default:
      return state
  }
}

const MARKDOWN_FILE_RE = /\.(md|markdown)$/i

export function useFileWorkspace({ content: initialContent, fileName: initialFileName }) {
  const [state, dispatch] = useReducer(workspaceReducer, { content: initialContent, fileName: initialFileName }, initWorkspace)

  const currentFile = useMemo(
    () => state.files.find(f => f.path === state.currentPath) || null,
    [state.files, state.currentPath]
  )
  const isModified = state.content !== state.savedContent

  // Keep a ref for close-confirmation IPC which lives outside React renders
  const isModifiedRef = useRef(isModified)
  useEffect(() => {
    isModifiedRef.current = isModified
  }, [isModified])

  const setContent = useCallback(content => dispatch({ type: 'SET_CONTENT', content }), [])
  const upsertFile = useCallback((file, activate = true) => dispatch({ type: 'UPSERT_FILE', file, activate }), [])
  const activateFile = useCallback(path => dispatch({ type: 'ACTIVATE_FILE', path }), [])
  const renameFile = useCallback((oldPath, newName, newPath = newName) => dispatch({ type: 'RENAME_FILE', oldPath, newName, newPath }), [])
  const removeFile = useCallback((path, fallback) => dispatch({ type: 'REMOVE_FILE', path, fallback }), [])
  const markSaved = useCallback(opts => dispatch({ type: 'MARK_SAVED', ...opts }), [])
  const replaceFiles = useCallback((files, activate = true) => dispatch({ type: 'REPLACE_FILES', files, activate }), [])

  const isMarkdownFile = useCallback(name => MARKDOWN_FILE_RE.test(name), [])

  // Save a specific (possibly non-active) file to its existing handle.
  const saveFileToDisk = useCallback(async (file) => {
    try {
      if (isDesktop && typeof file.fileHandle === 'string') {
        const result = await window.electronAPI.saveFile({ filePath: file.fileHandle, content: file.content })
        if (result.success) {
          markSaved({ path: file.path })
          return true
        }
        return false
      }
      if (!isDesktop && file.fileHandle?.createWritable) {
        const writable = await file.fileHandle.createWritable()
        await writable.write(file.content)
        await writable.close()
        markSaved({ path: file.path })
        return true
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err)
      }
    }
    return false
  }, [markSaved])

  // Save the active document to its existing handle. Returns false when no
  // handle exists and the caller should fall back to Save As.
  const saveActiveFile = useCallback(async () => {
    try {
      if (isDesktop) {
        if (typeof state.fileHandle === 'string') {
          const result = await window.electronAPI.saveFile({ filePath: state.fileHandle, content: state.content })
          if (result.success) {
            markSaved({})
            return true
          }
          return false
        }
        return false
      }
      if (state.fileHandle?.createWritable) {
        const writable = await state.fileHandle.createWritable()
        await writable.write(state.content)
        await writable.close()
        markSaved({})
        return true
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err)
      }
    }
    return false
  }, [state.fileHandle, state.content, markSaved])

  // Save the active document to a user-chosen location, re-pointing the file
  // entry to the new path.
  const saveActiveFileAs = useCallback(async () => {
    try {
      if (isDesktop) {
        const result = await window.electronAPI.saveFileDialog({ defaultName: state.fileName })
        if (!result.success) return false
        const saveResult = await window.electronAPI.saveFile({ filePath: result.filePath, content: state.content })
        if (!saveResult.success) return false
        const name = result.filePath.split(/[\\/]/).pop()
        upsertFile({
          path: result.filePath,
          name,
          content: state.content,
          savedContent: state.content,
          isModified: false,
          fileHandle: result.filePath,
          loaded: true
        })
        if (result.filePath !== state.currentPath) {
          removeFile(state.currentPath)
        }
        return true
      }

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: state.fileName,
          types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } }]
        })
        const writable = await handle.createWritable()
        await writable.write(state.content)
        await writable.close()
        upsertFile({
          path: handle.name,
          name: handle.name,
          content: state.content,
          savedContent: state.content,
          isModified: false,
          fileHandle: handle,
          loaded: true
        })
        if (handle.name !== state.currentPath) {
          removeFile(state.currentPath)
        }
        return true
      }

      // Download fallback
      const blob = new Blob([state.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = state.fileName
      a.click()
      URL.revokeObjectURL(url)
      markSaved({})
      return true
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err)
      }
    }
    return false
  }, [state.content, state.fileName, state.currentPath, upsertFile, removeFile, markSaved])

  return {
    state,
    currentFile,
    isModified,
    isModifiedRef,
    isMarkdownFile,
    setContent,
    upsertFile,
    activateFile,
    renameFile,
    removeFile,
    markSaved,
    replaceFiles,
    saveFileToDisk,
    saveActiveFile,
    saveActiveFileAs
  }
}
