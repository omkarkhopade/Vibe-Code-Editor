import { readJsonBody } from "@/lib/json-body";
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
  return readJsonBody(request, 128 * 1024);
}
