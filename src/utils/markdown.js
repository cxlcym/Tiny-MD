import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import java from 'highlight.js/lib/languages/java'
import kotlin from 'highlight.js/lib/languages/kotlin'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import sql from 'highlight.js/lib/languages/sql'
import markdown from 'highlight.js/lib/languages/markdown'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import DOMPurify from 'dompurify'
import { extractYAML } from './yaml'

const LANGUAGES = {
  javascript,
  typescript,
  xml,
  css,
  scss,
  json,
  yaml,
  bash,
  python,
  c,
  cpp,
  csharp,
  java,
  kotlin,
  go,
  rust,
  php,
  ruby,
  sql,
  markdown,
  diff,
  dockerfile,
}

for (const [name, lang] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, lang)
}

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        } catch (err) {
          console.error('Highlight error:', err)
        }
      }
      try {
        return hljs.highlightAuto(code).value
      } catch {
        return ''
      }
    },
  }),
  {
    breaks: true,
    gfm: true,
  }
)

export { hljs }

export function extractMarkdownBody(content) {
  const { body, hasYAML } = extractYAML(content)
  return hasYAML ? body : content
}

function renderMathExpressions(markdownText) {
  const codeBlocks = []
  let safeText = markdownText.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`
    codeBlocks.push(match)
    return token
  })

  safeText = safeText.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return match
    }
  })

  safeText = safeText.replace(/(?<!\\)\$([^\n$]+?)(?<!\\)\$/g, (match, expr) => {
    if (!expr.trim()) return match
    try {
      return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })
    } catch {
      return match
    }
  })

  return safeText.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, idx) => codeBlocks[Number(idx)])
}

const MAX_PREVIEW_CHARS = 150 * 1024

export function renderMarkdown(body = '') {
  const isTruncated = body.length > MAX_PREVIEW_CHARS
  const slice = isTruncated ? body.slice(0, MAX_PREVIEW_CHARS) : body
  const withMath = renderMathExpressions(slice)
  const rawHtml = marked.parse(withMath)
  const notice = isTruncated
    ? '<blockquote class="large-doc-notice">Large document preview mode: displaying first 150KB for smooth editing performance.</blockquote>'
    : ''

  return DOMPurify.sanitize(rawHtml + notice, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  })
}

export function sanitizeCustomCss(css = '') {
  return String(css).replace(/<\/style/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
}
