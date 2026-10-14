"use client";
import { usePreferences } from "@/modules/settings/lib/use-preferences";
import type * as MonacoTypes from "monaco-editor";


import { useRef, useEffect } from "react"
import Editor, { loader, type Monaco } from "@monaco-editor/react"
import { TemplateFile } from "../lib/path-to-json"
import { configureMonaco, defaultEditorOptions, getEditorLanguage } from "../lib/editor-config"


loader.config({ paths: { vs: "/monaco/vs" } });

interface PlaygroundEditorProps {
  filePath: string | undefined
  activeFile: TemplateFile | undefined
  content: string
  onContentChange: (value: string) => void
  suggestion: string | null
  suggestionLoading: boolean
  suggestionError?: string | null
  suggestionPosition: { line: number; column: number } | null
  onAcceptSuggestion: (editor: MonacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => void
  onRejectSuggestion: (editor: MonacoTypes.editor.IStandaloneCodeEditor) => void
  onTriggerSuggestion: (type: string, editor: MonacoTypes.editor.IStandaloneCodeEditor) => void
}

export const PlaygroundEditor = ({
  activeFile,
  filePath,
  content,
  onContentChange,
  suggestion,
  suggestionLoading,
  suggestionError,
  suggestionPosition,
  onRejectSuggestion,
  onTriggerSuggestion,
}: PlaygroundEditorProps) => {
  const { preferences } = usePreferences();
  const editorRef = useRef<MonacoTypes.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const resourcesRef = useRef<MonacoTypes.IDisposable[]>([])
  const changeListenersRef = useRef(new Set<() => void>())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const acceptingRef = useRef(false)
  const latestRef = useRef({ suggestion, suggestionLoading, suggestionPosition, onRejectSuggestion, onTriggerSuggestion })

  useEffect(() => {
    latestRef.current = { suggestion, suggestionLoading, suggestionPosition, onRejectSuggestion, onTriggerSuggestion }
  }, [suggestion, suggestionLoading, suggestionPosition, onRejectSuggestion, onTriggerSuggestion])

  useEffect(() => {
    for (const listener of changeListenersRef.current) listener()
  }, [suggestion, suggestionPosition])

  const handleEditorDidMount = (editor: MonacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    configureMonaco(monaco)
    editor.updateOptions({ ...defaultEditorOptions, fontSize: preferences.fontSize, tabSize: preferences.tabSize, wordWrap: preferences.wordWrap, detectIndentation: false })

    // Register once per editor. Reading current props avoids stale keyboard handlers
    // and disposing a provider while Monaco is consuming its completions.
    resourcesRef.current.push(monaco.languages.registerInlineCompletionsProvider('*', {
      onDidChangeInlineCompletions: (listener: (hint: MonacoTypes.languages.IInlineCompletionChangeHint | void) => void) => {
        const notify = () => listener(undefined)
        changeListenersRef.current.add(notify)
        return { dispose: () => { changeListenersRef.current.delete(notify) } }
      },
      provideInlineCompletions(model: MonacoTypes.editor.ITextModel, position: MonacoTypes.Position) {
        const current = latestRef.current
        const at = current.suggestionPosition
        if (model !== editor.getModel() || acceptingRef.current || !current.suggestion || !at ||
            position.lineNumber !== at.line || position.column !== at.column) return { items: [] }
        return { items: [{ insertText: current.suggestion.replace(/\r/g, ''),
          range: new monaco.Range(at.line, at.column, at.line, at.column) }] }
      },
      disposeInlineCompletions() {},
    }))

    const reject = () => {
      latestRef.current = { ...latestRef.current, suggestion: null, suggestionPosition: null }
      latestRef.current.onRejectSuggestion(editor)
      editor.trigger('ai', 'editor.action.inlineSuggest.hide', null)
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      latestRef.current.onTriggerSuggestion('completion', editor)
    })
    editor.addCommand(monaco.KeyCode.Tab, () => {
      const current = latestRef.current
      const at = current.suggestionPosition
      const position = editor.getPosition()
      if (!current.suggestion || !at || position?.lineNumber !== at.line || position.column !== at.column) {
        editor.trigger('keyboard', 'tab', null)
        return
      }
      acceptingRef.current = true
      try {
        const text = current.suggestion.replace(/\r/g, '')
        editor.pushUndoStop()
        editor.executeEdits('ai-suggestion-accept', [{ range: new monaco.Range(at.line, at.column, at.line, at.column), text, forceMoveMarkers: true }])
        const lines = text.split('\n')
        editor.setPosition({ lineNumber: at.line + lines.length - 1,
          column: lines.length === 1 ? at.column + text.length : lines[lines.length - 1].length + 1 })
        editor.pushUndoStop()
        reject()
      } finally { acceptingRef.current = false }
    }, 'editorTextFocus && !editorReadonly && !suggestWidgetVisible')
    editor.addCommand(monaco.KeyCode.Escape, () => {
      if (latestRef.current.suggestion) reject()
    }, 'editorTextFocus && inlineSuggestionVisible')

    resourcesRef.current.push(editor.onDidChangeCursorPosition(({ position }) => {
      if (acceptingRef.current) return
      const at = latestRef.current.suggestionPosition
      if (at && (position.lineNumber !== at.line || position.column !== at.column)) reject()
    }))
    resourcesRef.current.push(editor.onDidChangeModelContent(() => {
      if (acceptingRef.current) return
      if (latestRef.current.suggestion) reject()
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (!latestRef.current.suggestion && !latestRef.current.suggestionLoading) {
          latestRef.current.onTriggerSuggestion('completion', editor)
        }
      }, 300)
    }))
    resourcesRef.current.push(editor.onDidChangeModel(() => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (latestRef.current.suggestion) reject()
    }))
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    for (const resource of resourcesRef.current) resource.dispose()
    resourcesRef.current = []
    changeListenersRef.current.clear()
  }, [])

  return (
    <div className="h-full relative">
      {suggestionError && !suggestionLoading && <div role="status" className="absolute top-2 right-2 z-10 max-w-xs rounded border bg-background px-2 py-1 text-xs text-muted-foreground">{suggestionError}</div>}
      {/* Loading indicator */}
      {suggestionLoading && (
        <div className="absolute top-2 right-2 z-10 bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-xs text-red-700 dark:text-red-300 flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          AI thinking...
        </div>
      )}

      {/* Active suggestion indicator */}
      {suggestion && !suggestionLoading && (
        <div className="absolute top-2 right-2 z-10 bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Press Tab to accept
        </div>
      )}

      <Editor
        path={filePath}
        height="100%"
        value={content}
        onChange={(value) => onContentChange(value || "")}
        onMount={handleEditorDidMount}
        language={activeFile ? getEditorLanguage(activeFile.fileExtension || "") : "plaintext"}
        options={{ ...defaultEditorOptions, fontSize: preferences.fontSize, tabSize: preferences.tabSize, wordWrap: preferences.wordWrap }}
      />
    </div>
  )
}
