import { useState, useCallback, useMemo } from 'react'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { extractYAML } from '../../utils/yaml'
import { t } from '../../utils/i18n'
import './Translation.css'

marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (err) {
        console.error('Highlight error:', err)
      }
    }
    return hljs.highlightAuto(code).value
  }
})

const TRANSLATION_ENGINES = [
  { id: 'google', name: 'Google Translate', free: true },
  { id: 'mymemory', name: 'MyMemory', free: true },
  { id: 'deepl', name: 'DeepL Free', free: true },
  { id: 'libretranslate', name: 'LibreTranslate', free: true },
  { id: 'llm', name: 'Custom LLM', free: false }
]

const LANGUAGES = [
  { code: 'zh-CN', nameKey: 'chineseSimplified' },
  { code: 'zh-TW', nameKey: 'chineseTraditional' },
  { code: 'en', nameKey: 'english' },
  { code: 'ja', nameKey: 'japanese' },
  { code: 'ko', nameKey: 'korean' },
  { code: 'fr', nameKey: 'french' },
  { code: 'de', nameKey: 'german' }
]

function Translation({ content, lang, llmConfig }) {
  const [translatedContent, setTranslatedContent] = useState('')
  const [engine, setEngine] = useState('google')
  const [targetLang, setTargetLang] = useState('zh-CN')
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState('')

  const filterYAML = useCallback((text) => {
    const { yaml, body, hasYAML } = extractYAML(text)
    return { yaml, body, hasYAML }
  }, [])

  // Google Translate Free API (using unofficial endpoint)
  const translateWithGoogle = useCallback(async (text, targetLangCode) => {
    const maxChunkSize = 5000
    const chunks = []
    
    // Split text into chunks to avoid URL length limits
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize))
    }

    const results = []
    
    for (const chunk of chunks) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(chunk)}`
        
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error('Google translation request failed')
        }
        
        const data = await response.json()
        
        if (data && data[0]) {
          results.push(data[0].map(item => item[0]).join(''))
        } else {
          throw new Error('Invalid response from Google Translate')
        }
      } catch (err) {
        clearTimeout(timeoutId)
        
        if (err.name === 'AbortError') {
          throw new Error(t('translationTimeout', lang))
        }
        
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
          throw new Error(t('networkError', lang))
        }
        
        throw err
      }
    }
    
    return results.join('')
  }, [lang])

  // MyMemory API (free with 5000 chars/day limit)
  const translateWithMyMemory = useCallback(async (text, targetLangCode) => {
    const maxChunkSize = 500
    const chunks = []
    
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize))
    }

    const results = []
    
    // Convert language codes to MyMemory format
    const normalizeLangCode = (code) => {
      // MyMemory uses RFC3066 format like 'zh-CN', 'en', 'ja'
      // But needs lowercase for the API
      const langMap = {
        'zh-CN': 'zh-CN',
        'zh-TW': 'zh-TW',
        'en': 'en',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'de': 'de'
      }
      return langMap[code] || code.toLowerCase()
    }
    
    const targetLang = normalizeLangCode(targetLangCode)
    
    for (const chunk of chunks) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        // MyMemory requires langpair with source|target format
        // Use 'autodetect|target' for auto-detection
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=autodetect|${targetLang}`
        
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error('MyMemory translation request failed')
        }
        
        const data = await response.json()
        
        if (data.responseStatus === 200) {
          results.push(data.responseData.translatedText)
        } else {
          throw new Error(data.responseDetails || 'MyMemory translation failed')
        }
      } catch (err) {
        clearTimeout(timeoutId)
        
        if (err.name === 'AbortError') {
          throw new Error(t('translationTimeout', lang))
        }
        
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
          throw new Error(t('networkError', lang))
        }
        
        throw err
      }
    }
    
    return results.join('')
  }, [lang])

  // DeepL Free API (500,000 chars/month)
  const translateWithDeepL = useCallback(async (text, targetLangCode) => {
    const { deeplApiKey } = llmConfig || {}
    
    if (!deeplApiKey) {
      throw new Error(t('configureDeepLKey', lang))
    }

    // DeepL uses different language codes
    const deeplLangCodes = {
      'zh-CN': 'ZH',
      'zh-TW': 'ZH',
      'en': 'EN',
      'ja': 'JA',
      'ko': 'KO',
      'fr': 'FR',
      'de': 'DE'
    }

    const targetLang = deeplLangCodes[targetLangCode] || targetLangCode.toUpperCase()
    const maxChunkSize = 5000
    const chunks = []
    
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize))
    }

    const results = []
    
    for (const chunk of chunks) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `DeepL-Auth-Key ${deeplApiKey}`
          },
          body: JSON.stringify({
            text: [chunk],
            target_lang: targetLang
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `DeepL API request failed: ${response.statusText}`)
        }

        const data = await response.json()
        
        if (data.translations && data.translations[0]) {
          results.push(data.translations[0].text)
        } else {
          throw new Error('Invalid response from DeepL')
        }
      } catch (err) {
        clearTimeout(timeoutId)
        
        if (err.name === 'AbortError') {
          throw new Error(t('translationTimeout', lang))
        }
        
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
          throw new Error(t('networkError', lang))
        }
        
        throw err
      }
    }
    
    return results.join('')
  }, [llmConfig, lang])

  // LibreTranslate API (open source, self-hostable)
  const translateWithLibreTranslate = useCallback(async (text, targetLangCode) => {
    const { libretranslateEndpoint } = llmConfig || {}
    const endpoint = libretranslateEndpoint || 'https://libretranslate.com'

    const maxChunkSize = 5000
    const chunks = []
    
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize))
    }

    const results = []
    
    for (const chunk of chunks) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const response = await fetch(`${endpoint}/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: chunk,
            source: 'auto',
            target: targetLangCode.split('-')[0] // LibreTranslate uses short codes like 'zh', 'en', etc.
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`LibreTranslate API request failed: ${response.statusText}`)
        }

        const data = await response.json()
        
        if (data.translatedText) {
          results.push(data.translatedText)
        } else {
          throw new Error('Invalid response from LibreTranslate')
        }
      } catch (err) {
        clearTimeout(timeoutId)
        
        if (err.name === 'AbortError') {
          throw new Error(t('translationTimeout', lang))
        }
        
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
          throw new Error(t('networkError', lang))
        }
        
        throw err
      }
    }
    
    return results.join('')
  }, [llmConfig, lang])

  // LLM Translation (requires API key, uses OpenAI format)
  const translateWithLLM = useCallback(async (text, targetLangCode) => {
    const { apiKey, model, translationPrompt } = llmConfig || {}
    // Trim URL to remove trailing spaces
    const apiUrl = llmConfig?.apiUrl?.trim()
    
    if (!apiKey) {
      throw new Error(t('configureLlmKey', lang))
    }

    const langNames = {
      'zh-CN': 'Simplified Chinese',
      'zh-TW': 'Traditional Chinese',
      'en': 'English',
      'ja': 'Japanese',
      'ko': 'Korean',
      'fr': 'French',
      'de': 'German'
    }

    const targetLanguage = langNames[targetLangCode] || targetLangCode
    const selectedModel = model || 'gpt-3.5-turbo'

    // Use custom prompt if provided, otherwise use default
    const defaultPrompt = 'You are a professional translator. Translate the following markdown content to {{targetLanguage}}. Keep all markdown formatting, code blocks, and links intact. Only translate the text content. Do not add any explanations.'
    const promptTemplate = translationPrompt || defaultPrompt
    const systemPrompt = promptTemplate.replace(/\{\{targetLanguage\}\}/g, targetLanguage)

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 120 second timeout

    const requestBody = {
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 16384
    }
    
    console.log('LLM API request:', {
      url: apiUrl || 'https://api.openai.com/v1/chat/completions',
      model: selectedModel,
      textLength: text.length
    })

    try {
      const response = await fetch(apiUrl || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = `LLM API request failed (${response.status})`
        try {
          const errorData = await response.json()
          // Handle different error formats from various OpenAI-compatible APIs
          // OpenAI format: {error: {message: "..."}}
          // SiliconFlow format: {code: 20012, message: "...", data: "..."}
          // Simple string format: "Invalid token"
          if (errorData.error?.message) {
            errorMessage = errorData.error.message
          } else if (errorData.message) {
            errorMessage = errorData.message
          } else if (typeof errorData === 'string') {
            errorMessage = errorData
          }
        } catch {
          // Ignore JSON parse error, use statusText as fallback
          errorMessage = `${errorMessage}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('LLM API raw response:', data)
      
      if (data.error) {
        throw new Error(data.error.message || 'LLM API returned an error')
      }
      
      // Check if choices array exists and has content
      if (!data.choices || data.choices.length === 0) {
        console.error('LLM API no choices:', data)
        throw new Error(t('llmResponseEmpty', lang))
      }
      
      const choice = data.choices[0]
      console.log('LLM API choice:', choice)
      
      const message = choice.message || choice.delta
      console.log('LLM API message:', message)
      
      const content = message?.content
      console.log('LLM API content:', content)
      
      // Some models return content as null when they use reasoning
      if (content === null || content === undefined || content === '') {
        // Check if there's reasoning_content (for thinking models)
        if (message?.reasoning_content) {
          console.warn('Model returned reasoning_content but empty content')
        }
        console.error('LLM API content is empty, full message:', message)
        throw new Error(t('llmResponseEmpty', lang))
      }
      
      return content
    } catch (err) {
      clearTimeout(timeoutId)
      
      if (err.name === 'AbortError') {
        throw new Error(t('translationTimeout', lang))
      }
      
      if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
        throw new Error(t('networkError', lang))
      }
      
      throw err
    }
  }, [llmConfig, lang])

  const handleTranslate = useCallback(async () => {
    setIsTranslating(true)
    setError('')

    try {
      const { yaml, body, hasYAML } = filterYAML(content)

      if (!body.trim()) {
        setError(t('noContentToTranslate', lang))
        return
      }

      let translated = ''

      switch (engine) {
        case 'google':
          translated = await translateWithGoogle(body, targetLang)
          break
        case 'mymemory':
          translated = await translateWithMyMemory(body, targetLang)
          break
        case 'deepl':
          translated = await translateWithDeepL(body, targetLang)
          break
        case 'libretranslate':
          translated = await translateWithLibreTranslate(body, targetLang)
          break
        case 'llm':
          translated = await translateWithLLM(body, targetLang)
          break
        default:
          translated = await translateWithGoogle(body, targetLang)
      }

      const finalContent = hasYAML ? `${yaml}\n\n${translated}` : translated
      setTranslatedContent(finalContent)
    } catch (err) {
      setError(`${t('translationFailed', lang)}: ${err.message}`)
    } finally {
      setIsTranslating(false)
    }
  }, [content, engine, targetLang, filterYAML, translateWithGoogle, translateWithMyMemory, translateWithDeepL, translateWithLibreTranslate, translateWithLLM, lang])

  // Clean up translation artifacts
  const cleanTranslation = useCallback((text) => {
    if (!text) return ''
    
    // Remove any YAML front matter from translated content
    const { body } = extractYAML(text)
    let cleaned = body || text
    
    // Fix common translation issues with markdown symbols
    // Some translators add spaces or change symbols
    cleaned = cleaned
      .replace(/\*\*\s+/g, '**')  // Fix bold with extra space
      .replace(/\s+\*\*/g, '**')
      .replace(/\*\s+/g, '*')     // Fix italic with extra space
      .replace(/\s+\*/g, '*')
      .replace(/#\s+#/g, '##')    // Fix headers
      .replace(/`{3,}/g, '```')   // Normalize code blocks
      .trim()
    
    return cleaned
  }, [])

  const renderedHtml = useMemo(() => {
    if (!translatedContent) return ''
    const cleaned = cleanTranslation(translatedContent)
    return marked.parse(cleaned)
  }, [translatedContent, cleanTranslation])

  return (
    <div className="translation-container">
      <div className="translation-controls">
        <select
          value={engine}
          onChange={(e) => {
            setEngine(e.target.value)
            setIsTranslating(false)
            setError('')
          }}
          className="translation-select"
        >
          <optgroup label={lang === 'zh-CN' ? '免费 API' : 'Free APIs'}>
            {TRANSLATION_ENGINES.filter(e => e.free).map(eng => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={lang === 'zh-CN' ? '自定义' : 'Custom'}>
            {TRANSLATION_ENGINES.filter(e => !e.free).map(eng => (
              <option key={eng.id} value={eng.id}>
                {t('llmTranslate', lang)}
              </option>
            ))}
          </optgroup>
        </select>
        <select
          value={targetLang}
          onChange={(e) => {
            setTargetLang(e.target.value)
            setIsTranslating(false)
            setError('')
          }}
          className="translation-select"
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>
              {t(l.nameKey, lang)}
            </option>
          ))}
        </select>
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className="translation-btn"
        >
          {isTranslating ? t('translating', lang) : t('translate', lang)}
        </button>
      </div>
      {error && <div className="translation-error">{error}</div>}
      <div className="translation-output markdown-body">
        {translatedContent ? (
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        ) : ''}
      </div>
    </div>
  )
}

export default Translation
