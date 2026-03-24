import { useState, useCallback, useRef, useEffect } from 'react'
import './FileManager.css'

function FileTreeNode({ 
  node, 
  depth, 
  currentFile, 
  renamingFile, 
  newName, 
  files,
  expandedFolders,
  renameInputRef,
  lang,
  onFileSelect, 
  onFileDelete, 
  onStartRename, 
  onRename, 
  onCancelRename, 
  onKeyDown,
  onNewNameChange,
  toggleFolder
}) {
  const isExpanded = expandedFolders.has(node.path)
  const isCurrentFile = currentFile === node.path
  const isRenaming = renamingFile === node.path
  const fileObj = files.find(f => f.path === node.path)
  const hasUnsavedChanges = fileObj && fileObj.isModified

  return (
    <div>
      <div
        className={`file-item ${isCurrentFile ? 'active' : ''} ${hasUnsavedChanges ? 'modified' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (node.isFolder) {
            toggleFolder(node.path)
          } else {
            onFileSelect(node.path)
          }
        }}
      >
        {node.isFolder && (
          <>
            <span className={`folder-arrow ${isExpanded ? 'expanded' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="#888">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </svg>
            </span>
            <span className="folder-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="#f8d775">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
            </span>
          </>
        )}
        {!node.isFolder && (
          <span className="file-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#888">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
          </span>
        )}
        
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            className="rename-input"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onBlur={() => onRename(fileObj || { path: node.path, name: node.name })}
            onKeyDown={(e) => onKeyDown(e, fileObj || { path: node.path, name: node.name })}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-name">{node.name}</span>
        )}
        
        {hasUnsavedChanges && !isRenaming && (
          <span className="modified-indicator" title={lang === 'zh-CN' ? '未保存' : 'Unsaved'}>
            ●
          </span>
        )}
        
        {!isRenaming && (
          <div className="file-actions">
            <button
              className="action-btn"
              onClick={(e) => onStartRename(fileObj || { path: node.path, name: node.name }, e)}
              title={lang === 'zh-CN' ? '重命名' : 'Rename'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#aaa">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
            </button>
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation()
                onFileDelete(node.path)
              }}
              title={lang === 'zh-CN' ? '删除' : 'Delete'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#aaa">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {node.isFolder && isExpanded && node.children && Object.values(node.children).map(child => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          currentFile={currentFile}
          renamingFile={renamingFile}
          newName={newName}
          files={files}
          expandedFolders={expandedFolders}
          renameInputRef={renameInputRef}
          lang={lang}
          onFileSelect={onFileSelect}
          onFileDelete={onFileDelete}
          onStartRename={onStartRename}
          onRename={onRename}
          onCancelRename={onCancelRename}
          onKeyDown={onKeyDown}
          onNewNameChange={onNewNameChange}
          toggleFolder={toggleFolder}
        />
      ))}
    </div>
  )
}

function FileManager({ files, currentFile, onFileSelect, onFileRename, onFileDelete, onNewFile, onOpenFile, onOpenFolder, onCollapseChange, folderTree, lang, isLoading }) {
  const [collapsed, setCollapsed] = useState(false)
  const [renamingFile, setRenamingFile] = useState(null)
  const [newName, setNewName] = useState('')
  const [expandedFolders, setExpandedFolders] = useState(new Set(['/']))
  const renameInputRef = useRef(null)

  const handleCollapse = useCallback(() => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    if (onCollapseChange) {
      onCollapseChange(newCollapsed)
    }
  }, [collapsed, onCollapseChange])

  useEffect(() => {
    if (renamingFile && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingFile])

  const handleStartRename = useCallback((file, e) => {
    e.stopPropagation()
    setRenamingFile(file.path)
    setNewName(file.name)
  }, [])

  const handleRename = useCallback((file) => {
    if (newName.trim() && newName !== file.name) {
      onFileRename(file.path, newName.trim())
    }
    setRenamingFile(null)
    setNewName('')
  }, [newName, onFileRename])

  const handleCancelRename = useCallback(() => {
    setRenamingFile(null)
    setNewName('')
  }, [])

  const handleKeyDown = useCallback((e, file) => {
    if (e.key === 'Enter') {
      handleRename(file)
    } else if (e.key === 'Escape') {
      handleCancelRename()
    }
  }, [handleRename, handleCancelRename])

  const toggleFolder = useCallback((path) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // Build tree from files list (for non-folder mode)
  const buildTreeFromFiles = useCallback((files) => {
    const tree = {}
    
    files.forEach(file => {
      const parts = file.path.split('/').filter(Boolean)
      let current = tree
      
      parts.forEach((part, index) => {
        const pathKey = parts.slice(0, index + 1).join('/')
        if (!current[part]) {
          current[part] = {
            name: part,
            path: pathKey,
            isFolder: index < parts.length - 1,
            children: {},
            file: index === parts.length - 1 ? file : null
          }
        }
        current = current[part].children
      })
    })
    
    return tree
  }, [])

  // Use folderTree if available, otherwise build from files
  const tree = folderTree || buildTreeFromFiles(files)
  const hasFolder = !!folderTree

  return (
    <div className={`file-manager ${collapsed ? 'collapsed' : ''}`}>
      {collapsed ? (
        <div className="collapsed-header" onClick={handleCollapse} title={lang === 'zh-CN' ? '展开文件管理器' : 'Expand File Manager'}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#888">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
        </div>
      ) : (
        <>
          <div className="panel-header">
            <div className="header-content" onClick={handleCollapse}>
              <span className="collapse-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#888">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </span>
              <span className="header-title">{lang === 'zh-CN' ? '文件' : 'Files'}</span>
            </div>
            <div className="header-actions">
              <button
                className="header-btn"
                onClick={onOpenFolder}
                title={lang === 'zh-CN' ? '打开文件夹' : 'Open Folder'}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#888">
                  <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zM4 6V4h7l2 2h7v2H4z"/>
                </svg>
              </button>
              <button
                className="header-btn"
                onClick={onNewFile}
                title={lang === 'zh-CN' ? '新建文件' : 'New File'}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#888">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z" />
                </svg>
              </button>
              <button
                className="header-btn"
                onClick={onOpenFile}
                title={lang === 'zh-CN' ? '打开文件' : 'Open File'}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#888">
                  <path d="M11 16h2V8h-2v8zm3-14H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div className="file-list">
            {isLoading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>{lang === 'zh-CN' ? '加载中...' : 'Loading...'}</p>
              </div>
            ) : !hasFolder && files.length === 0 ? (
              <div className="empty-state">
                <p>{lang === 'zh-CN' ? '暂无文件' : 'No files'}</p>
                <div className="empty-actions">
                  <button className="open-btn" onClick={onOpenFolder}>
                    {lang === 'zh-CN' ? '打开文件夹' : 'Open Folder'}
                  </button>
                  <button className="open-btn secondary" onClick={onOpenFile}>
                    {lang === 'zh-CN' ? '打开文件' : 'Open File'}
                  </button>
                </div>
              </div>
            ) : (
              Object.values(tree).map(node => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  currentFile={currentFile}
                  renamingFile={renamingFile}
                  newName={newName}
                  files={files}
                  expandedFolders={expandedFolders}
                  renameInputRef={renameInputRef}
                  lang={lang}
                  onFileSelect={onFileSelect}
                  onFileDelete={onFileDelete}
                  onStartRename={handleStartRename}
                  onRename={handleRename}
                  onCancelRename={handleCancelRename}
                  onKeyDown={handleKeyDown}
                  onNewNameChange={setNewName}
                  toggleFolder={toggleFolder}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default FileManager
