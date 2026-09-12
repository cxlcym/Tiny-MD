const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs').promises

let mainWindow = null
let forceClose = false

const MD_EXTENSIONS = new Set(['.md', '.markdown'])
// Text files are also openable via the "All Files" dialog filter, so they must
// remain writable once opened
const WRITABLE_EXTENSIONS = new Set([...MD_EXTENSIONS, '.txt'])
const IMAGE_MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon'
}

// IPC handlers accept paths from the renderer, which also renders untrusted
// markdown. Restrict file operations to Markdown files so an XSS cannot read,
// overwrite or delete arbitrary files.
function assertMarkdownPath(p) {
  if (typeof p !== 'string' || !MD_EXTENSIONS.has(path.extname(p).toLowerCase())) {
    throw new Error('Only Markdown files are allowed')
  }
  return p
}

function assertWritableTextPath(p) {
  if (typeof p !== 'string' || !WRITABLE_EXTENSIONS.has(path.extname(p).toLowerCase())) {
    throw new Error('Only text files are allowed')
  }
  return p
}

function assertImagePath(p) {
  if (typeof p !== 'string' || !(path.extname(p).toLowerCase() in IMAGE_MIME_TYPES)) {
    throw new Error('Only image files are allowed')
  }
  return p
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false
    },
    show: false,
    backgroundColor: '#1e1e1e',
    title: 'Tiny MD',
    autoHideMenuBar: true
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Let the renderer confirm closing when there are unsaved changes
  mainWindow.on('close', (event) => {
    if (forceClose) return
    event.preventDefault()
    try {
      mainWindow.webContents.send('app-close-requested')
    } catch {
      forceClose = true
      mainWindow.close()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }
}

ipcMain.on('confirm-close', (_event, { force }) => {
  if (!mainWindow) return
  if (force) {
    forceClose = true
    mainWindow.close()
  }
})

ipcMain.handle('save-image', async (event, { imageData, fileName }) => {
  if (!mainWindow) return { success: false, error: 'Window closed' }

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: fileName,
    filters: [
      { name: 'WebP Image', extensions: ['webp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true }
  }

  const buffer = Buffer.from(imageData)
  await fs.writeFile(result.filePath, buffer)
  return { success: true, path: result.filePath }
})

ipcMain.handle('open-image-dialog', async () => {
  if (!mainWindow) return { success: false, error: 'Window closed' }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }

  const filePath = result.filePaths[0]
  return {
    success: true,
    filePath,
    fileName: path.basename(filePath)
  }
})

ipcMain.handle('save-file-dialog', async (event, { defaultName }) => {
  if (!mainWindow) return { success: false, error: 'Window closed' }

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true }
  }

  return { success: true, filePath: result.filePath }
})

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  await fs.writeFile(assertWritableTextPath(filePath), content, 'utf-8')
  return { success: true }
})

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return { success: false, error: 'Window closed' }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }

  const filePath = result.filePaths[0]
  const content = await fs.readFile(filePath, 'utf-8')

  return {
    success: true,
    filePath,
    fileName: path.basename(filePath),
    content
  }
})

ipcMain.handle('open-folder-dialog', async () => {
  if (!mainWindow) return { success: false, error: 'Window closed' }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }

  return { success: true, folderPath: result.filePaths[0] }
})

// Recursively walk a directory and return Markdown entries without content
// (content is loaded lazily when a file is selected). Depth-limited as a
// safeguard against symlink loops and pathological trees.
async function readDirectoryRecursive(dirPath, depth = 0) {
  if (depth > 8) return {}

  const entries = {}
  const items = await fs.readdir(dirPath, { withFileTypes: true })

  for (const item of items) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue
    if (item.isDirectory()) {
      entries[item.name] = {
        name: item.name,
        path: item.name,
        isFolder: true,
        children: await readDirectoryRecursive(path.join(dirPath, item.name), depth + 1)
      }
    } else if (MD_EXTENSIONS.has(path.extname(item.name).toLowerCase())) {
      entries[item.name] = {
        name: item.name,
        path: item.name,
        isFolder: false
      }
    }
  }

  return entries
}

ipcMain.handle('read-directory', async (event, { dirPath }) => {
  const entries = await readDirectoryRecursive(dirPath)
  return { success: true, entries }
})

ipcMain.handle('read-file', async (event, { filePath }) => {
  const content = await fs.readFile(assertMarkdownPath(filePath), 'utf-8')
  return { success: true, content }
})

ipcMain.handle('write-file', async (event, { filePath, content }) => {
  await fs.writeFile(assertMarkdownPath(filePath), content, 'utf-8')
  return { success: true }
})

ipcMain.handle('delete-file', async (event, { filePath }) => {
  await fs.unlink(assertMarkdownPath(filePath))
  return { success: true }
})

ipcMain.handle('rename-file', async (event, { oldPath, newPath }) => {
  await fs.rename(assertMarkdownPath(oldPath), assertMarkdownPath(newPath))
  return { success: true }
})

ipcMain.handle('read-image', async (event, { filePath }) => {
  try {
    const safePath = assertImagePath(filePath)
    const buffer = await fs.readFile(safePath)
    const mimeType = IMAGE_MIME_TYPES[path.extname(safePath).toLowerCase()]
    const data = buffer.toString('base64')

    return { success: true, data, mimeType }
  } catch (err) {
    console.error('Failed to read image:', filePath, err)
    return { success: false, error: err.message }
  }
})

app.whenReady().then(createWindow)

// Quit flows (app.quit(), Cmd+Q) bypass the unsaved-changes confirmation
app.on('before-quit', () => {
  forceClose = true
})

app.on('window-all-closed', () => {
  mainWindow = null
  app.quit()
})
