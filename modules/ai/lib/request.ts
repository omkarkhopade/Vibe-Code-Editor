import { currentUser } from "@/modules/auth/actions";
import { ApiError } from "@/lib/api-error";
const requests = new Map<string, { start: number; count: number }>();
export async function readAIRequest(request: Request): Promise<unknown> {
  const user = await currentUser();
  if (!user?.id) throw new ApiError(401, "Authentication required");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Invalid request origin");
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Expected JSON");
  const now = Date.now();
  for (const [key, value] of requests) if (now - value.start >= 60000) requests.delete(key);
  const entry = requests.get(user.id) || { start: now, count: 0 };
  if (entry.count >= 10 || requests.size >= 10000) throw new ApiError(429, "Too many AI requests. Please wait a minute.");
  entry.count++; requests.set(user.id, entry);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing request body");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 128 * 1024) { await reader.cancel(); throw new ApiError(413, "AI request is too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "Invalid JSON"); }
}
