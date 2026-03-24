const DEFAULT_CONFIG = {
  endpoint: 'http://127.0.0.1:36677',
  uploadPath: '/upload',
  headers: {}
}

export class PicGoService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
  }

  async upload(file) {
    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch(`${this.config.endpoint}${this.config.uploadPath}`, {
        method: 'POST',
        headers: {
          ...this.config.headers
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success && result.result) {
        return {
          success: true,
          url: Array.isArray(result.result) ? result.result[0] : result.result
        }
      }

      throw new Error(result.message || 'Upload failed')
    } catch (error) {
      console.error('PicGo upload error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async uploadMultiple(files) {
    const results = []
    for (const file of files) {
      const result = await this.upload(file)
      results.push({ file: file.name, ...result })
    }
    return results
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.config.endpoint}/upload`, {
        method: 'POST',
        body: new FormData()
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export const picgoService = new PicGoService()

export function loadPicGoConfig() {
  const config = localStorage.getItem('tiny-md-picgo-config')
  if (config) {
    try {
      return JSON.parse(config)
    } catch {
      return DEFAULT_CONFIG
    }
  }
  return DEFAULT_CONFIG
}

export function savePicGoConfig(config) {
  localStorage.setItem('tiny-md-picgo-config', JSON.stringify(config))
  picgoService.updateConfig(config)
}
