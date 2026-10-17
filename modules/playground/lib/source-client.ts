import type { TemplateFolder } from "./path-to-json";
import { isTemplateFolder } from "./validation";
const prefix = "vibecode:gzip:v1:";
const chunkSize = 1024 * 1024;
const maxPacked = 14 * 1024 * 1024;
export interface SourceMetadata { id: string; title: string; revision: string | null; chunk: string | null; totalChunks: number }
async function readResponse(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Source transfer failed. Your editor changes are still available.");
  return body;
}
async function encode(tree: TemplateFolder) {
  if (!isTemplateFolder(tree)) throw new Error("Invalid template structure or project exceeds 4 MB");
  const compressed = await new Response(new Blob([JSON.stringify(tree)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  const bytes = new Uint8Array(compressed);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  const result = prefix + btoa(binary);
  if (result.length > maxPacked) throw new Error("Project metadata exceeds the storage limit. Your edits have not been discarded.");
  return result;
}
async function decode(packed: string): Promise<unknown> {
  if (!packed.startsWith(prefix) || packed.length > maxPacked) throw new Error("Invalid source response");
  const bytes = Uint8Array.from(atob(packed.slice(prefix.length)), character => character.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
    if (size > 40 * 1024 * 1024) { await reader.cancel(); throw new Error("Source response exceeds the limit"); } chunks.push(value);
  } } finally { reader.releaseLock(); }
  const combined = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(combined));
}
export async function loadSource(id: string, signal: AbortSignal) {
  const url = `/api/playground/${encodeURIComponent(id)}/source`;
  const first: SourceMetadata = await readResponse(await fetch(url, { signal, cache: "no-store" }));
  if (!Number.isInteger(first.totalChunks) || first.totalChunks < 0 || first.totalChunks > Math.ceil(maxPacked / chunkSize)) throw new Error("Invalid source response");
  if (!first.totalChunks) return { metadata: first, template: null };
  const chunks = [first.chunk || ""];
  for (let index = 1; index < first.totalChunks; index++) {
    const part: SourceMetadata = await readResponse(await fetch(`${url}?chunk=${index}&revision=${encodeURIComponent(first.revision || "")}`, { signal, cache: "no-store" }));
    if (part.revision !== first.revision || part.totalChunks !== first.totalChunks || typeof part.chunk !== "string") throw new Error("Project changed while loading. Reload before editing.");
    chunks.push(part.chunk);
  }
  return { metadata: first, template: await decode(chunks.join("")) };
}
export async function saveSource(id: string, tree: TemplateFolder, expectedRevision: string | null, signal?: AbortSignal) {
  const packed = await encode(tree);
  const url = `/api/playground/${encodeURIComponent(id)}/source`;
  const post = async (body: unknown, requestSignal = signal) => readResponse(await fetch(url, { method: "POST", signal: requestSignal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const { uploadId, totalChunks } = await post({ operation: "begin", expectedRevision, totalLength: packed.length });
  try {
    if (totalChunks !== Math.ceil(packed.length / chunkSize) || typeof uploadId !== "string") throw new Error("Invalid upload response");
    for (let index = 0; index < totalChunks; index++) await post({ operation: "chunk", uploadId, index, chunk: packed.slice(index * chunkSize, (index + 1) * chunkSize) });
    const committed = await post({ operation: "commit", uploadId });
    if (typeof committed.revision !== "string" || !/^[a-f0-9]{64}$/.test(committed.revision)) throw new Error("Invalid save response. Reload to verify the saved version.");
    return { revision: committed.revision };
  } catch (error) {
    // Best effort cleanup uses an independent signal if navigation cancelled the save.
    try { await post({ operation: "abort", uploadId }, AbortSignal.timeout(5000)); } catch { /* Expiry also bounds abandoned uploads. */ }
    throw error;
  }
}
