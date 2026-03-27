const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs').promises

let mainWindow = null

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

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

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
  await fs.writeFile(filePath, content, 'utf-8')
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

ipcMain.handle('read-directory', async (event, { dirPath }) => {
  const entries = {}
  const items = await fs.readdir(dirPath, { withFileTypes: true })

  for (const item of items) {
    if (item.name.startsWith('.')) continue

    if (item.isDirectory()) {
      entries[item.name] = {
        name: item.name,
        path: item.name,
        isFolder: true,
        children: {}
      }
    } else if (item.name.endsWith('.md') || item.name.endsWith('.markdown')) {
      const content = await fs.readFile(path.join(dirPath, item.name), 'utf-8')
      entries[item.name] = {
        name: item.name,
        path: item.name,
        isFolder: false,
        content,
        savedContent: content,
        isModified: false
      }
    }
  }

  return { success: true, entries }
})

ipcMain.handle('read-file', async (event, { filePath }) => {
  const content = await fs.readFile(filePath, 'utf-8')
  return { success: true, content }
})

ipcMain.handle('write-file', async (event, { filePath, content }) => {
  await fs.writeFile(filePath, content, 'utf-8')
  return { success: true }
})

ipcMain.handle('delete-file', async (event, { filePath }) => {
  await fs.unlink(filePath)
  return { success: true }
})

ipcMain.handle('rename-file', async (event, { oldPath, newPath }) => {
  await fs.rename(oldPath, newPath)
  return { success: true }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  mainWindow = null
  app.quit()
})
