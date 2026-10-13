import { ApiError } from "./api-error";
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Expected JSON");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing request body");
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new ApiError(413, "Request is too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "Invalid JSON"); }
}
