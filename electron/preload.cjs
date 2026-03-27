const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveImage: (data) => ipcRenderer.invoke('save-image', data),
  saveFileDialog: (data) => ipcRenderer.invoke('save-file-dialog', data),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  readDirectory: (data) => ipcRenderer.invoke('read-directory', data),
  readFile: (data) => ipcRenderer.invoke('read-file', data),
  writeFile: (data) => ipcRenderer.invoke('write-file', data),
  deleteFile: (data) => ipcRenderer.invoke('delete-file', data),
  renameFile: (data) => ipcRenderer.invoke('rename-file', data),
  isElectron: true
})
