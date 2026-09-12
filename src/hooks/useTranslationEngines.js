import { useCallback } from 'react'
import { t } from '../utils/i18n'

const DEFAULT_LLM_PROMPT = 'You are a professional translator. Translate the following markdown content to {{targetLanguage}}. Keep all markdown formatting, code blocks, and links intact. Only translate the text content. Do not add any explanations.'

const LANG_NAMES = {
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German'
}

function chunkText(text, size) {
  const chunks = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizeError(err, lang) {
  if (err.name === 'AbortError') return new Error(t('translationTimeout', lang))
  if (err.message === 'Failed to fetch' || /NetworkError/.test(err.message)) {
    return new Error(t('networkError', lang))
  }
  return err
}

export function useTranslationEngines(config, lang) {
  const { apiKey, apiUrl, model, translationPrompt, deeplApiKey, libretranslateEndpoint } = config || {}

  const translateWithGoogle = useCallback(async (text, targetLangCode) => {
    const results = []
    for (const chunk of chunkText(text, 5000)) {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(chunk)}`
        const response = await fetchWithTimeout(url)
        if (!response.ok) throw new Error('Google translation request failed')
        const data = await response.json()
        if (!data?.[0]) throw new Error('Invalid response from Google Translate')
        results.push(data[0].map(item => item[0]).join(''))
      } catch (err) {
        throw normalizeError(err, lang)
      }
    }
    return results.join('')
  }, [lang])

  const translateWithMyMemory = useCallback(async (text, targetLangCode) => {
    const results = []
    for (const chunk of chunkText(text, 500)) {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=autodetect|${targetLangCode}`
        const response = await fetchWithTimeout(url)
        if (!response.ok) throw new Error('MyMemory translation request failed')
        const data = await response.json()
        if (data.responseStatus === 200) {
          results.push(data.responseData.translatedText)
        } else {
          throw new Error(data.responseDetails || 'MyMemory translation failed')
        }
      } catch (err) {
        throw normalizeError(err, lang)
      }
    }
    return results.join('')
  }, [lang])

  const translateWithDeepL = useCallback(async (text, targetLangCode) => {
    if (!deeplApiKey) throw new Error(t('configureDeepLKey', lang))

    const deeplLangCodes = { 'zh-CN': 'ZH', 'zh-TW': 'ZH', en: 'EN', ja: 'JA', ko: 'KO', fr: 'FR', de: 'DE' }
    const targetLang = deeplLangCodes[targetLangCode] || targetLangCode.toUpperCase()

    const results = []
    for (const chunk of chunkText(text, 5000)) {
      try {
        const response = await fetchWithTimeout('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `DeepL-Auth-Key ${deeplApiKey}`
          },
          body: JSON.stringify({ text: [chunk], target_lang: targetLang })
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `DeepL API request failed: ${response.statusText}`)
        }
        const data = await response.json()
        if (data.translations?.[0]) {
          results.push(data.translations[0].text)
        } else {
          throw new Error('Invalid response from DeepL')
        }
      } catch (err) {
        throw normalizeError(err, lang)
      }
    }
    return results.join('')
  }, [deeplApiKey, lang])

  const translateWithLibreTranslate = useCallback(async (text, targetLangCode) => {
    const endpoint = libretranslateEndpoint || 'https://libretranslate.com'
    const results = []
    for (const chunk of chunkText(text, 5000)) {
      try {
        const response = await fetchWithTimeout(`${endpoint}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: chunk,
            source: 'auto',
            target: targetLangCode.split('-')[0]
          })
        })
        if (!response.ok) throw new Error(`LibreTranslate API request failed: ${response.statusText}`)
        const data = await response.json()
        if (data.translatedText) {
          results.push(data.translatedText)
        } else {
          throw new Error('Invalid response from LibreTranslate')
        }
      } catch (err) {
        throw normalizeError(err, lang)
      }
    }
    return results.join('')
  }, [libretranslateEndpoint, lang])

  const translateWithLLM = useCallback(async (text, targetLangCode) => {
    if (!apiKey) throw new Error(t('configureLlmKey', lang))

    const targetLanguage = LANG_NAMES[targetLangCode] || targetLangCode
    const selectedModel = model || 'gpt-3.5-turbo'
    const systemPrompt = (translationPrompt || DEFAULT_LLM_PROMPT).replace(/\{\{targetLanguage\}\}/g, targetLanguage)
    const endpoint = apiUrl?.trim() || 'https://api.openai.com/v1/chat/completions'

    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0.3,
          max_tokens: 16384
        })
      }, 120000)

      if (!response.ok) {
        let errorMessage = `LLM API request failed (${response.status})`
        try {
          const errorData = await response.json()
          // OpenAI: {error:{message}}, SiliconFlow: {message}, plain string
          if (errorData.error?.message) {
            errorMessage = errorData.error.message
          } else if (errorData.message) {
            errorMessage = errorData.message
          } else if (typeof errorData === 'string') {
            errorMessage = errorData
          }
        } catch {
          errorMessage = `${errorMessage}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      if (data.error) throw new Error(data.error.message || 'LLM API returned an error')
      if (!data.choices || data.choices.length === 0) {
        throw new Error(t('llmResponseEmpty', lang))
      }

      const message = data.choices[0].message || data.choices[0].delta
      const content = message?.content
      if (!content) throw new Error(t('llmResponseEmpty', lang))
      return content
    } catch (err) {
      throw normalizeError(err, lang)
    }
  }, [apiKey, apiUrl, model, translationPrompt, lang])

  return {
    google: translateWithGoogle,
    mymemory: translateWithMyMemory,
    deepl: translateWithDeepL,
    libretranslate: translateWithLibreTranslate,
    llm: translateWithLLM
  }
}
