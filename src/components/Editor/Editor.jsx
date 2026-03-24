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

// Markdown syntax error linter
const markdownLinter = linter((view) => {
  const diagnostics = []
  const doc = view.state.doc.toString()
  const lines = doc.split('\n')

  lines.forEach((line, lineIndex) => {
    if (!line.trim()) return
    
    const lineStart = view.state.doc.line(lineIndex + 1).from

    // Check for unclosed bold
    const boldCount = (line.match(/\*\*/g) || []).length
    if (boldCount % 2 !== 0) {
      const lastBold = line.lastIndexOf('**')
      if (lastBold !== -1) {
        diagnostics.push({
          from: lineStart + lastBold,
          to: lineStart + lastBold + 2,
          severity: 'error',
          message: 'Unclosed bold marker **'
        })
      }
    }

    // Check for unclosed italic (single *)
    let singleStarCount = 0
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '*' && line[i-1] !== '*' && line[i+1] !== '*') {
        singleStarCount++
      }
    }
    if (singleStarCount % 2 !== 0) {
      const lastItalic = line.lastIndexOf('*')
      if (lastItalic !== -1 && line[lastItalic - 1] !== '*' && line[lastItalic + 1] !== '*') {
        diagnostics.push({
          from: lineStart + lastItalic,
          to: lineStart + lastItalic + 1,
          severity: 'error',
          message: 'Unclosed italic marker *'
        })
      }
    }

    // Check for unclosed link syntax
    const openBracket = (line.match(/\[/g) || []).length
    const closeBracket = (line.match(/\]/g) || []).length
    if (openBracket !== closeBracket) {
      const lastOpenBracket = line.lastIndexOf('[')
      if (lastOpenBracket !== -1) {
        diagnostics.push({
          from: lineStart + lastOpenBracket,
          to: lineStart + lastOpenBracket + 1,
          severity: 'error',
          message: 'Unclosed link/image bracket'
        })
      }
    }

    // Check for empty links
    const emptyLinkMatch = line.match(/\]\(\)/g)
    if (emptyLinkMatch) {
      const pos = line.indexOf('](')
      diagnostics.push({
        from: lineStart + pos,
        to: lineStart + pos + 3,
        severity: 'warning',
        message: 'Empty link URL'
      })
    }
  })

  return diagnostics
})

const Editor = forwardRef(({ value, onChange, onCursorChange, onScroll, theme }, ref) => {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const themeRef = useRef(theme)

  // Update theme ref when theme changes
  useEffect(() => {
    themeRef.current = theme
    if (editorRef.current) {
      editorRef.current.className = `editor-container cm-theme-${theme}`
    }
  }, [theme])

  // Expose editor view to parent
  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
    getState: () => viewRef.current?.state,
    dispatch: (transaction) => viewRef.current?.dispatch(transaction),
    focus: () => viewRef.current?.focus()
  }))

  // Initialize editor once
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
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString())
          }
          const pos = update.state.selection.main.head
          const line = update.state.doc.lineAt(pos)
          onCursorChange(line.number, pos - line.from + 1)
        }),
        EditorView.baseTheme({
          '&': {
            height: '100%',
            fontSize: '14px'
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace"
          },
          '.cm-content': {
            padding: '10px 0'
          },
          '.cm-line': {
            padding: '0 10px'
          }
        }),
        EditorView.theme({
          '&': {
            backgroundColor: 'var(--cm-bg)',
            color: 'var(--cm-text)'
          },
          '.cm-content': {
            caretColor: 'var(--cm-cursor)'
          },
          '.cm-gutters': {
            backgroundColor: 'var(--cm-gutter-bg)',
            color: 'var(--cm-gutter-text)',
            borderRight: '1px solid var(--cm-gutter-border)'
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'var(--cm-active-line-bg)'
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--cm-active-line-bg)'
          },
          '.cm-selectionBackground': {
            backgroundColor: 'var(--cm-selection-bg)'
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: 'var(--cm-selection-bg)'
          }
        })
      ]
    })

    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    viewRef.current = view

    // Add scroll listener to the scroller element for real-time sync
    const scroller = view.scrollDOM
    const handleScroll = () => {
      if (onScroll) {
        const { scrollTop, scrollHeight, clientHeight } = scroller
        onScroll({ scrollTop, scrollHeight, clientHeight })
      }
    }
    scroller.addEventListener('scroll', handleScroll)

    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      view.destroy()
      viewRef.current = null
    }
  }, []) // Empty deps - initialize once only

  // Sync value changes to editor
  useEffect(() => {
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString()
      if (currentContent !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: value
          }
        })
      }
    }
  }, [value])

  return (
    <div className={`editor-container cm-theme-${theme}`} ref={editorRef} />
  )
})

Editor.displayName = 'Editor'

export default Editor
