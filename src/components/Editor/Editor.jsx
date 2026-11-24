import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import { linter } from '@codemirror/lint'
import './Editor.css'

function wrapSelection(view, before, after, fallbackText) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to) || fallbackText
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  })
  return true
}

export function lintMarkdownDoc(docText, getLineStart) {
  if (docText.length > 100 * 1024) return []

  const diagnostics = []
  const lines = docText.split('\n')
  let inCodeFence = false

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence
      return
    }
    if (inCodeFence || !trimmed) return

    const lineStart = getLineStart(lineIndex + 1)
    const strippedLine = line.replace(/`[^`]+`/g, (m) => ' '.repeat(m.length))

    const boldCount = (strippedLine.match(/\*\*/g) || []).length
    if (boldCount % 2 !== 0) {
      const lastBold = strippedLine.lastIndexOf('**')
      if (lastBold !== -1) {
        diagnostics.push({
          from: lineStart + lastBold,
          to: lineStart + lastBold + 2,
          severity: 'info',
          message: 'Unclosed bold marker **',
        })
      }
    }

    const lineForItalic = strippedLine.replace(/^(\s*)\*(\s+)/, '$1 $2')
    let singleStarCount = 0
    for (let i = 0; i < lineForItalic.length; i++) {
      if (lineForItalic[i] === '*' && lineForItalic[i - 1] !== '*' && lineForItalic[i + 1] !== '*') {
        singleStarCount++
      }
    }
    if (singleStarCount % 2 !== 0) {
      const lastItalic = lineForItalic.lastIndexOf('*')
      if (lastItalic !== -1 && lineForItalic[lastItalic - 1] !== '*' && lineForItalic[lastItalic + 1] !== '*') {
        diagnostics.push({
          from: lineStart + lastItalic,
          to: lineStart + lastItalic + 1,
          severity: 'info',
          message: 'Unclosed italic marker *',
        })
      }
    }

    const emptyLinkMatch = strippedLine.match(/\]\(\)/g)
    if (emptyLinkMatch) {
      const pos = strippedLine.indexOf('](')
      diagnostics.push({
        from: lineStart + pos,
        to: lineStart + pos + 3,
        severity: 'warning',
        message: 'Empty link URL',
      })
    }
  })

  return diagnostics
}

const markdownLinter = linter((view) => {
  return lintMarkdownDoc(view.state.doc.toString(), (n) => view.state.doc.line(n).from)
}, { delay: 750 })

const Editor = forwardRef(({ value, onChange, onCursorChange, onScroll, theme }, ref) => {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const themeRef = useRef(theme)
  const lastEmittedRef = useRef(value)
  const changeTimerRef = useRef(null)

  const handlersRef = useRef({ onChange, onCursorChange, onScroll })
  useEffect(() => {
    handlersRef.current = { onChange, onCursorChange, onScroll }
  })

  useEffect(() => {
    themeRef.current = theme
    if (editorRef.current) {
      editorRef.current.className = `editor-container cm-theme-${theme}`
    }
  }, [theme])

  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
    getState: () => viewRef.current?.state,
    dispatch: (transaction) => viewRef.current?.dispatch(transaction),
    focus: () => viewRef.current?.focus(),
    insertAtCursor: (text) => {
      const view = viewRef.current
      if (view && view.state) {
        const { from } = view.state.selection.main
        view.dispatch({
          changes: { from, to: from, insert: text },
          selection: { anchor: from + text.length },
        })
        view.focus()
        return true
      }
      return false
    },
    insertAtPos: (text, pos) => {
      const view = viewRef.current
      if (view && view.state) {
        const insertPos = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({
          changes: { from: insertPos, to: insertPos, insert: text },
          selection: { anchor: insertPos + text.length },
        })
        view.focus()
        return true
      }
      return false
    },
    getCursorPos: () => {
      const view = viewRef.current
      if (view && view.state) {
        return view.state.selection.main.head
      }
      return -1
    },
  }))

  useEffect(() => {
    if (!editorRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdownLinter,
        keymap.of([
          { key: 'Mod-b', run: (v) => wrapSelection(v, '**', '**', 'bold') },
          { key: 'Mod-i', run: (v) => wrapSelection(v, '*', '*', 'italic') },
          { key: 'Mod-k', run: (v) => wrapSelection(v, '[', '](url)', 'link text') },
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            if (update.state.doc.length > 50 * 1024) {
              if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
              changeTimerRef.current = setTimeout(() => {
                const next = update.state.doc.toString()
                lastEmittedRef.current = next
                handlersRef.current.onChange(next)
              }, 120)
            } else {
              const next = update.state.doc.toString()
              lastEmittedRef.current = next
              handlersRef.current.onChange(next)
            }
          }
          if (update.selectionSet || update.docChanged) {
            const pos = update.state.selection.main.head
            const line = update.state.doc.lineAt(pos)
            handlersRef.current.onCursorChange(line.number, pos - line.from + 1)
          }
        }),
        EditorView.baseTheme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" },
          '.cm-content': { padding: '10px 0' },
          '.cm-line': { padding: '0 10px' },
        }),
        EditorView.theme({
          '&': { backgroundColor: 'var(--cm-bg)', color: 'var(--cm-text)' },
          '.cm-content': { caretColor: 'var(--cm-cursor)' },
          '.cm-gutters': { backgroundColor: 'var(--cm-gutter-bg)', color: 'var(--cm-gutter-text)', borderRight: '1px solid var(--cm-gutter-border)' },
          '.cm-activeLineGutter': { backgroundColor: 'var(--cm-active-line-bg)' },
          '.cm-activeLine': { backgroundColor: 'var(--cm-active-line-bg)' },
          '.cm-selectionBackground': { backgroundColor: 'var(--cm-selection-bg)' },
          '&.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--cm-selection-bg)' },
        }),
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    const scroller = view.scrollDOM
    const handleScroll = () => {
      const { onScroll: scrollHandler } = handlersRef.current
      if (scrollHandler) {
        const { scrollTop, scrollHeight, clientHeight } = scroller
        scrollHandler({ scrollTop, scrollHeight, clientHeight })
      }
    }
    scroller.addEventListener('scroll', handleScroll)

    return () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current)
      scroller.removeEventListener('scroll', handleScroll)
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (viewRef.current && value !== lastEmittedRef.current) {
      const currentContent = viewRef.current.state.doc.toString()
      if (currentContent !== value) {
        lastEmittedRef.current = value
        viewRef.current.dispatch({
          changes: { from: 0, to: currentContent.length, insert: value },
        })
      }
    }
  }, [value])

  return <div className={`editor-container cm-theme-${theme}`} ref={editorRef} />
})

Editor.displayName = 'Editor'

export default Editor
