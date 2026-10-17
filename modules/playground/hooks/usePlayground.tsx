import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { TemplateFolder } from "../lib/path-to-json";
import { isTemplateFolder } from "../lib/validation";
import { loadSource, saveSource, type SourceMetadata } from "../lib/source-client";
type PlaygroundData = SourceMetadata;
export const usePlayground = (id: string) => {
  const [playgroundData, setPlaygroundData] = useState<PlaygroundData | null>(null);
  const [templateData, setTemplateData] = useState<TemplateFolder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef<string | null>(null);
  const savePending = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const loadPlayground = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setIsLoading(true); setError(null); setPlaygroundData(null); setTemplateData(null);
    try {
      if (!id) throw new Error("Missing playground ID");
      const loaded = await loadSource(id, controller.signal);
      const data = loaded.metadata;
      if (controller.signal.aborted) return;
      if (!data) throw new Error("Playground not found");
      let template: unknown = loaded.template;
      if (template === null) {
        const response = await fetch("/api/template/" + encodeURIComponent(id), { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Failed to load template");
        template = body.templateJson;
      }
      if (controller.signal.aborted) return;
      if (!isTemplateFolder(template)) throw new Error("Saved template is invalid. Your saved data has not been overwritten.");
      revision.current = data.revision;
      setPlaygroundData(data); setTemplateData(template);
      toast.success("Template loaded successfully");
    } catch (failure) {
      if (controller.signal.aborted) return;
      const message = failure instanceof Error ? failure.message : "Failed to load playground data";
      setError(message); toast.error(message);
    } finally { if (!controller.signal.aborted) setIsLoading(false); }
  }, [id]);
  const saveTemplateData = useCallback(async (data: TemplateFolder) => {
    if (savePending.current) throw new Error("A save is already in progress. Please retry.");
    savePending.current = true;
    const loadAtSave = pending.current;
    try { const saved = await saveSource(id, data, revision.current, loadAtSave?.signal); if (pending.current !== loadAtSave || loadAtSave?.signal.aborted) throw new Error("The original project was saved, but navigation changed. Reload the current project before continuing."); revision.current = saved.revision; setTemplateData(data); toast.success("Changes saved successfully"); }
    catch (failure) { toast.error(failure instanceof Error ? failure.message : "Failed to save changes"); throw failure; }
    finally { savePending.current = false; }
  }, [id]);
  useEffect(() => {
    const timer = setTimeout(() => { void loadPlayground(); }, 0);
    return () => { clearTimeout(timer); pending.current?.abort(); };
  }, [loadPlayground]);
  return { playgroundData, templateData, isLoading, error, loadPlayground, saveTemplateData };
};
