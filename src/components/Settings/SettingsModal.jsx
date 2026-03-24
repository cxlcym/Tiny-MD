import { useState, useCallback } from 'react'
import { t } from '../../utils/i18n'
import './SettingsModal.css'

function SettingsModal({ config, onSave, onClose, lang }) {
  const [localConfig, setLocalConfig] = useState({
    ...config,
    llmModel: config.llmModel || 'gpt-3.5-turbo',
    cloudflareR2: config.cloudflareR2 || {
      accountId: '',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
      publicUrl: ''
    },
    awsS3: config.awsS3 || {
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
      region: 'us-east-1',
      endpoint: ''
    }
  })

  const [testStatus, setTestStatus] = useState(null) // null, 'testing', 'success', 'failed'
  const [testMessage, setTestMessage] = useState('')

  const handleSave = useCallback(() => {
    onSave(localConfig)
    onClose()
  }, [localConfig, onSave, onClose])

  const updateConfig = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }))
  }

  const updateCloudflareR2 = (key, value) => {
    setLocalConfig(prev => ({
      ...prev,
      cloudflareR2: { ...prev.cloudflareR2, [key]: value }
    }))
  }

  const updateAwsS3 = (key, value) => {
    setLocalConfig(prev => ({
      ...prev,
      awsS3: { ...prev.awsS3, [key]: value }
    }))
  }

  const handleTestConnection = useCallback(async () => {
    const { llmApiKey, llmApiUrl, llmModel } = localConfig
    
    if (!llmApiKey || !llmApiUrl) {
      setTestStatus('failed')
      setTestMessage(lang === 'zh-CN' ? '请填写 API Key 和 API URL' : 'Please fill in API Key and API URL')
      return
    }

    setTestStatus('testing')
    setTestMessage(t('testing', lang))

    try {
      const response = await fetch(llmApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmApiKey}`
        },
        body: JSON.stringify({
          model: llmModel || 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: 'Say "Hello"' }
          ],
          max_tokens: 10
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.choices && data.choices.length > 0) {
          setTestStatus('success')
          setTestMessage(t('connectionSuccess', lang))
        } else {
          setTestStatus('failed')
          setTestMessage(t('connectionFailed', lang))
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        setTestStatus('failed')
        setTestMessage(errorData.error?.message || t('connectionFailed', lang))
      }
    } catch (error) {
      setTestStatus('failed')
      setTestMessage(error.message || t('connectionFailed', lang))
    }
  }, [localConfig, lang])

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t('settingsTitle', lang)}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          {/* Language Setting */}
          <div className="settings-section">
            <h3>{t('language', lang)}</h3>
            <div className="setting-row">
              <select
                value={localConfig.language}
                onChange={(e) => updateConfig('language', e.target.value)}
                className="setting-select"
              >
                <option value="en">English</option>
                <option value="zh-CN">简体中文</option>
              </select>
            </div>
          </div>

          {/* Theme Setting */}
          <div className="settings-section">
            <h3>{t('theme', lang)}</h3>
            <div className="setting-row">
              <div className="theme-options">
                <button
                  className={`theme-btn ${localConfig.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => updateConfig('theme', 'dark')}
                >
                  <span className="theme-preview dark-preview"></span>
                  <span>{t('darkTheme', lang)}</span>
                </button>
                <button
                  className={`theme-btn ${localConfig.theme === 'light' ? 'active' : ''}`}
                  onClick={() => updateConfig('theme', 'light')}
                >
                  <span className="theme-preview light-preview"></span>
                  <span>{t('lightTheme', lang)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Image Bed Configuration */}
          <div className="settings-section">
            <h3>{t('imageBedConfig', lang)}</h3>
            
            <div className="setting-row">
              <label>{t('imageBedType', lang)}</label>
              <select
                value={localConfig.imageBed || 'picgo'}
                onChange={(e) => updateConfig('imageBed', e.target.value)}
                className="setting-select"
              >
                <option value="picgo">{t('picgoService', lang)}</option>
                <option value="cloudflare-r2">{t('cloudflareR2', lang)}</option>
                <option value="aws-s3">{t('awsS3', lang)}</option>
              </select>
            </div>

            {/* PicGo Configuration */}
            {(localConfig.imageBed || 'picgo') === 'picgo' && (
              <>
                <div className="setting-row">
                  <label>{t('endpoint', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.picgoEndpoint}
                    onChange={(e) => updateConfig('picgoEndpoint', e.target.value)}
                    placeholder="http://127.0.0.1:36677"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('uploadPath', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.picgoUploadPath}
                    onChange={(e) => updateConfig('picgoUploadPath', e.target.value)}
                    placeholder="/upload"
                    className="setting-input"
                  />
                </div>
              </>
            )}

            {/* Cloudflare R2 Configuration */}
            {localConfig.imageBed === 'cloudflare-r2' && (
              <>
                <div className="setting-row">
                  <label>{t('accountId', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.cloudflareR2.accountId}
                    onChange={(e) => updateCloudflareR2('accountId', e.target.value)}
                    placeholder="xxxxxxxxxx"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('accessKeyId', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.cloudflareR2.accessKeyId}
                    onChange={(e) => updateCloudflareR2('accessKeyId', e.target.value)}
                    placeholder="xxxxxxxxxx"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('secretAccessKey', lang)}</label>
                  <input
                    type="password"
                    value={localConfig.cloudflareR2.secretAccessKey}
                    onChange={(e) => updateCloudflareR2('secretAccessKey', e.target.value)}
                    placeholder="xxxxxxxxxx"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('bucketName', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.cloudflareR2.bucketName}
                    onChange={(e) => updateCloudflareR2('bucketName', e.target.value)}
                    placeholder="my-bucket"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('publicUrl', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.cloudflareR2.publicUrl}
                    onChange={(e) => updateCloudflareR2('publicUrl', e.target.value)}
                    placeholder="https://pub-xxx.r2.dev"
                    className="setting-input"
                  />
                </div>
              </>
            )}

            {/* AWS S3 Configuration */}
            {localConfig.imageBed === 'aws-s3' && (
              <>
                <div className="setting-row">
                  <label>{t('accessKeyId', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.awsS3.accessKeyId}
                    onChange={(e) => updateAwsS3('accessKeyId', e.target.value)}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('secretAccessKey', lang)}</label>
                  <input
                    type="password"
                    value={localConfig.awsS3.secretAccessKey}
                    onChange={(e) => updateAwsS3('secretAccessKey', e.target.value)}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('bucketName', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.awsS3.bucketName}
                    onChange={(e) => updateAwsS3('bucketName', e.target.value)}
                    placeholder="my-bucket"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('region', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.awsS3.region}
                    onChange={(e) => updateAwsS3('region', e.target.value)}
                    placeholder="us-east-1"
                    className="setting-input"
                  />
                </div>
                <div className="setting-row">
                  <label>{t('endpoint', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.awsS3.endpoint}
                    onChange={(e) => updateAwsS3('endpoint', e.target.value)}
                    placeholder="https://s3.amazonaws.com"
                    className="setting-input"
                  />
                </div>
              </>
            )}
          </div>

          {/* LLM Configuration */}
          <div className="settings-section">
            <h3>{t('llmConfig', lang)}</h3>
            <div className="setting-row">
              <label>{t('apiKey', lang)}</label>
              <input
                type="password"
                value={localConfig.llmApiKey}
                onChange={(e) => updateConfig('llmApiKey', e.target.value)}
                placeholder="sk-..."
                className="setting-input"
              />
            </div>
            <div className="setting-row">
              <label>{t('apiUrl', lang)}</label>
              <input
                type="text"
                value={localConfig.llmApiUrl}
                onChange={(e) => updateConfig('llmApiUrl', e.target.value)}
                placeholder="https://api.openai.com/v1/chat/completions"
                className="setting-input"
              />
            </div>
            <div className="setting-row">
              <label>{t('modelName', lang)}</label>
              <input
                type="text"
                value={localConfig.llmModel || ''}
                onChange={(e) => updateConfig('llmModel', e.target.value)}
                placeholder="gpt-3.5-turbo"
                className="setting-input"
              />
            </div>
            <div className="setting-row">
              <label>{t('translationPrompt', lang)}</label>
              <textarea
                value={localConfig.llmTranslationPrompt || ''}
                onChange={(e) => updateConfig('llmTranslationPrompt', e.target.value)}
                placeholder="You are a professional translator. Translate the following markdown content to {{targetLanguage}}. Keep all markdown formatting, code blocks, and links intact. Only translate the text content. Do not add any explanations."
                className="setting-textarea"
                rows={4}
              />
              <p className="setting-hint">{t('translationPromptHint', lang)}</p>
            </div>
            <div className="setting-row">
              <button 
                className={`test-btn ${testStatus || ''}`}
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing' ? t('testing', lang) : t('testConnection', lang)}
              </button>
              {testMessage && (
                <span className={`test-message ${testStatus}`}>
                  {testMessage}
                </span>
              )}
            </div>
          </div>

          {/* Translation APIs Configuration */}
          <div className="settings-section">
            <h3>{t('translationApisConfig', lang)}</h3>
            <div className="setting-row">
              <label>{t('deeplApiKey', lang)}</label>
              <input
                type="password"
                value={localConfig.deeplApiKey || ''}
                onChange={(e) => updateConfig('deeplApiKey', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                className="setting-input"
              />
              <p className="setting-hint">{t('deeplApiKeyHint', lang)}</p>
            </div>
            <div className="setting-row">
              <label>{t('libretranslateEndpoint', lang)}</label>
              <input
                type="text"
                value={localConfig.libretranslateEndpoint || ''}
                onChange={(e) => updateConfig('libretranslateEndpoint', e.target.value)}
                placeholder="https://libretranslate.com"
                className="setting-input"
              />
              <p className="setting-hint">{t('libretranslateEndpointHint', lang)}</p>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="cancel-btn" onClick={onClose}>
            {t('cancel', lang)}
          </button>
          <button className="save-btn" onClick={handleSave}>
            {t('saveConfig', lang)}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
