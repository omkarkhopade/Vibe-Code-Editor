import { useState, useCallback, useRef, useEffect } from "react";
import type * as Monaco from "monaco-editor";
type Editor = Monaco.editor.IStandaloneCodeEditor;
export const useAISuggestions = () => {
  const [state, setState] = useState({ suggestion: null as string | null, error: null as string | null, isLoading: false, position: null as { line: number; column: number } | null, decoration: [] as string[], isEnabled: true });
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const toggleEnabled = useCallback(() => { pending.current?.abort(); setState(prev => ({ ...prev, isEnabled: !prev.isEnabled, error: null, isLoading: false, suggestion: null, position: null })); }, []);
  const fetchSuggestion = useCallback(async (type: string, editor: Editor) => {
    if (!state.isEnabled || !editor || pending.current) return;
    const model = editor.getModel(); const cursor = editor.getPosition();
    if (!model || !cursor) return;
    const version = model.getVersionId();
    const controller = new AbortController(); pending.current = controller;
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch("/api/code-completion", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileContent: model.getValue(), cursorLine: cursor.lineNumber - 1, cursorColumn: cursor.column - 1, suggestionType: type, fileName: model.uri.path.split("/").pop() }) });
      if (!response.ok) {
        throw new Error(response.status === 429 ? "AI is busy. Try again shortly." : "AI completion unavailable. Check Settings and try again.");
      }
      const data = await response.json();
      const current = editor.getPosition();
      if (!controller.signal.aborted && editor.getModel() === model && model.getVersionId() === version && current?.equals(cursor) && typeof data.suggestion === "string") {
        setState(prev => ({ ...prev, suggestion: data.suggestion, position: { line: cursor.lineNumber, column: cursor.column } }));
      }
    } catch (error) {
      if (!controller.signal.aborted) setState(prev => ({ ...prev, error: error instanceof Error ? error.message : "AI completion unavailable." }));
    }
    finally { if (pending.current === controller) pending.current = null; if (!controller.signal.aborted) setState(prev => ({ ...prev, isLoading: false })); }
  }, [state.isEnabled]);
  const clearSuggestion = useCallback((editor?: Editor) => {
    pending.current?.abort(); pending.current = null;
    if (editor && state.decoration.length) editor.deltaDecorations(state.decoration, []);
    setState(prev => ({ ...prev, suggestion: null, position: null, decoration: [], error: null, isLoading: false }));
  }, [state.decoration]);
  const acceptSuggestion = useCallback((editor: Editor, monaco: typeof Monaco) => {
    if (!state.suggestion || !state.position) return;
    const { line, column } = state.position;
    editor.executeEdits("ai-suggestion", [{ range: new monaco.Range(line, column, line, column), text: state.suggestion, forceMoveMarkers: true }]);
    clearSuggestion(editor);
  }, [state.suggestion, state.position, clearSuggestion]);
  return { ...state, toggleEnabled, fetchSuggestion, acceptSuggestion, clearSuggestion, rejectSuggestion: clearSuggestion };
};
