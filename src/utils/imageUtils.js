// Check if running in Electron desktop
export const isDesktop = window.electronAPI?.isElectron === true

// Convert file to WebP blob
export const convertToWebP = (file) => {
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

// Convert blob to data URL
export const blobToDataURL = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

// Save image file - Desktop version saves directly, browser version uses download
export const saveImageFile = async (blob, imageName) => {
  if (isDesktop) {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      // Typed arrays transfer efficiently over IPC (structured clone)
      const result = await window.electronAPI.saveImage({
        imageData: new Uint8Array(arrayBuffer),
        fileName: imageName
      })
      if (result.success) {
        return result.path
      }
      return null
    } catch (err) {
      console.error('Failed to save image via Electron:', err)
      return null
    }
  }

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
      return imageName
    } catch (err) {
      if (err.name === 'AbortError') {
        return null
      }
      throw err
    }
  }

  // Download fallback
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = imageName
  a.click()
  URL.revokeObjectURL(url)
  return imageName
}

// Open local image file dialog and return file info
export const openLocalImage = async () => {
  if (isDesktop) {
    try {
      const result = await window.electronAPI.openImageDialog()
      if (result.success) {
        return {
          path: result.filePath,
          name: result.fileName
        }
      }
      return null
    } catch (err) {
      console.error('Failed to open image via Electron:', err)
      return null
    }
  }

  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Images',
          accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']
          }
        }]
      })
      const file = await handle.getFile()
      return {
        path: file.name,
        name: file.name,
        file
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return null
      }
      throw err
    }
  }

  // Fallback: use input element
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (file) {
        resolve({
          path: file.name,
          name: file.name,
          file
        })
      } else {
        resolve(null)
      }
    }
    input.click()
  })
}
