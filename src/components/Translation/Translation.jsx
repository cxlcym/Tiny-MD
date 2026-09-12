import { useState, useCallback, useMemo } from 'react'
import { extractYAML } from '../../utils/yaml'
import { t } from '../../utils/i18n'
import { extractMarkdownBody, renderMarkdown } from '../../utils/markdown'
import { useTranslationEngines } from '../../hooks/useTranslationEngines'
import './Translation.css'

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

  const engines = useTranslationEngines(llmConfig, lang)

  const handleTranslate = useCallback(async () => {
    setIsTranslating(true)
    setError('')

    try {
      const { yaml, body, hasYAML } = extractYAML(content)

      if (!body.trim()) {
        setError(t('noContentToTranslate', lang))
        return
      }

      const translate = engines[engine] || engines.google
      const translated = await translate(body, targetLang)

      const finalContent = hasYAML ? `${yaml}\n\n${translated}` : translated
      setTranslatedContent(finalContent)
    } catch (err) {
      setError(`${t('translationFailed', lang)}: ${err.message}`)
    } finally {
      setIsTranslating(false)
    }
  }, [content, engine, targetLang, engines, lang])

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
    return renderMarkdown(extractMarkdownBody(cleanTranslation(translatedContent)))
  }, [translatedContent, cleanTranslation])

  return (
    <div className="translation-container">
      <div className="translation-controls">
        <select
          value={engine}
          onChange={(e) => {
            setEngine(e.target.value)
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
