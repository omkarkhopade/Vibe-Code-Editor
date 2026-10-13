import { readNDJSON } from "./ndjson";
import { ApiError } from "@/lib/api-error";
let active = false;
export function ollamaConfig() {
  const base = process.env.OLLAMA_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:11434");
  if (!base) throw new ApiError(503, "AI backend is not configured");
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new ApiError(503, "Invalid AI configuration");
  const timeout = Number(process.env.OLLAMA_TIMEOUT_MS || 180000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 600000) throw new ApiError(503, "Invalid AI timeout configuration");
  return { base: base.replace(/\/$/, ""), model: process.env.OLLAMA_MODEL || "gpt-oss:20b", timeout };
}
export async function listModels(signal: AbortSignal) {
  const config = ollamaConfig();
  const response = await fetch(config.base + "/api/tags", { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]), cache: "no-store" });
  if (!response.ok) throw new ApiError(503, "AI service is unavailable");
  const data = await response.json();
  if (!Array.isArray(data.models)) throw new ApiError(502, "Invalid model catalog");
  const allowed = process.env.OLLAMA_ALLOWED_MODELS?.split(",").map(name => name.trim()).filter(Boolean);
  const names: string[] = data.models.flatMap((model: { name?: unknown }) => model && typeof model.name === "string" && model.name.length > 0 && model.name.length <= 200 ? [model.name] : []);
  return { defaultModel: config.model, models: [...new Set(names)].filter(name => !allowed || allowed.includes(name)).sort() };
}
export async function checkModel(signal: AbortSignal, selectedModel?: string) {
  const config = ollamaConfig();
  const model = selectedModel ?? config.model;
  const catalog = await listModels(signal);
  if (!catalog.models.includes(model)) throw new ApiError(selectedModel ? 400 : 503, "Selected AI model is not available or permitted");
  return { ...config, model };
}
export async function generateText(prompt: string, signal: AbortSignal, system?: string, onToken?: (token: string) => void, selectedModel?: string, preserveWhitespace = false): Promise<string> {
  if (active) throw new ApiError(429, "AI is busy. Please try again shortly.");
  active = true;
  try {
    const combined = AbortSignal.any([signal, AbortSignal.timeout(ollamaConfig().timeout)]);
    const config = await checkModel(combined, selectedModel);
    const response = await fetch(config.base + "/api/generate", {
      method: "POST", signal: combined, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, prompt, system, stream: !!onToken, ...(config.model.startsWith("gpt-oss:") ? { think: "low" } : {}), keep_alive: "2m", options: { temperature: 0.3, num_predict: 1024, num_ctx: 4096 } }),
    });
    if (!response.ok) throw new ApiError(503, "AI generation failed. Please try again later.");
    if (onToken) {
      if (!response.body) throw new ApiError(502, "AI returned an empty stream");
      let result = ""; let complete = false;
      await readNDJSON(response.body, value => {
        if (!value || typeof value !== "object") throw new ApiError(502, "Invalid AI stream");
        const part = value as { response?: unknown; done?: boolean; error?: unknown };
        if (part.error) throw new ApiError(502, "AI generation failed");
        if (typeof part.response === "string") { result += part.response; onToken(part.response); }
        if (part.done) complete = true;
      });
      if (!complete || !result.trim()) throw new ApiError(502, "AI stream ended without a complete response");
      return preserveWhitespace ? result : result.trim();
    }
    const data = await response.json();
    if (typeof data.response !== "string" || !data.response.trim()) throw new ApiError(502, "AI returned an empty response");
    return preserveWhitespace ? data.response : data.response.trim();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted) throw new ApiError(499, "Request cancelled");
    if (error instanceof Error && error.name === "TimeoutError") throw new ApiError(504, "AI request timed out. The model may still be loading.");
    throw new ApiError(503, "AI service is unavailable");
  } finally { active = false; }
}
