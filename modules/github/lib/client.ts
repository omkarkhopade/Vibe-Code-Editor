import { ApiError } from "@/lib/api-error";
export async function githubRead(path: string, token: string, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch("https://api.github.com" + path, { redirect: "error", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", Authorization: `Bearer ${token}` } });
  } catch { throw new ApiError(signal.aborted ? 499 : 503, signal.aborted ? "Request cancelled" : "Could not reach GitHub. Try again later."); }
  if (response.status === 401) throw new ApiError(401, "GitHub rejected the stored credentials. Reconnect GitHub in Settings.");
  if (response.status === 429 || (response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")))) throw new ApiError(429, "GitHub API rate limit reached. Try again later.");
  if (response.status === 403) throw new ApiError(403, "GitHub denied access. Check repository permissions and organization authorization.");
  if (response.status === 404) throw new ApiError(404, "Repository not found or not accessible to this GitHub connection.");
  if (!response.ok) throw new ApiError(502, "GitHub is unavailable. Try again later.");
  return response;
}
