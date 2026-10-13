import type { Template } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { isSafeName, isTemplateFolder } from "@/modules/playground/lib/validation";
import type { TemplateFolder, TemplateFile } from "@/modules/playground/lib/path-to-json";

const MAX_FILES = 200;
const MAX_BYTES = 4 * 1024 * 1024;
const ignored = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", ".cache"]);
const binary = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|eot|mp[34]|wasm|lock)$/i;
interface Entry { path: string; mode: string; type: string; sha: string; size?: number }

export function parseRepository(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, "Enter a GitHub repository URL"); }
  const parts = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash || parts.length !== 2) {
    throw new ApiError(400, "Use https://github.com/owner/repository and enter the branch separately");
  }
  const [owner, rawRepo] = parts;
  const repo = rawRepo.replace(/\.git$/, "");
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(owner) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(repo) || !isSafeName(repo)) throw new ApiError(400, "Invalid repository name");
  return { owner, repo };
}

export async function importRepository(repository: string, ref: string | undefined, token: string | undefined, signal: AbortSignal) {
  const { owner, repo } = parseRepository(repository);
  const prefix = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  let effectiveToken = token;
  const combined = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
  async function github(endpoint: string) {
    let response = await fetch(`https://api.github.com${prefix}${endpoint}`, {
      signal: combined, redirect: "error", cache: "no-store",
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}) },
    });
    if (response.status === 401 && effectiveToken) {
      effectiveToken = undefined;
      // Revoked credentials must not prevent a public snapshot import. Retry without credentials only at the same fixed API host.
      response = await fetch(`https://api.github.com${prefix}${endpoint}`, { signal: combined, redirect: "error", cache: "no-store", headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
      if (response.status === 404) throw new ApiError(401, "GitHub credentials were rejected and this repository is not public. Reconnect GitHub in Settings.");
    }
    if (response.status === 404) throw new ApiError(404, "Repository or branch not found, or your GitHub account cannot access it");
    if (response.status === 401) throw new ApiError(401, "GitHub rejected the stored credentials. Reconnect GitHub in Settings.");
    if (response.status === 429 || (response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")))) throw new ApiError(429, "GitHub API rate limit reached. Try again later.");
    if (response.status === 403) throw new ApiError(403, "GitHub denied access. Check repository permissions and organization authorization.");
    if (!response.ok) throw new ApiError(502, "GitHub is unavailable. Please try again later.");
    // Bound responses independently of Content-Length, including chunked responses.
    const reader = response.body?.getReader();
    if (!reader) throw new ApiError(502, "GitHub returned an empty response");
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024) { await reader.cancel(); throw new ApiError(413, "Repository metadata exceeds the import limit"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new ApiError(502, "GitHub returned invalid data"); }
  }
  const metadata = await github("");
  const branch = ref || metadata.default_branch;
  if (typeof branch !== "string" || !branch || branch.length > 200) throw new ApiError(400, "Invalid repository branch");
  // Resolve once to a commit so a moving branch cannot mix source versions.
  const commit = await github(`/commits/${encodeURIComponent(branch)}`);
  const treeSha = commit.commit?.tree?.sha;
  if (typeof treeSha !== "string" || !/^[a-f0-9]{40,64}$/.test(treeSha)) throw new ApiError(502, "Invalid repository tree");
  const tree = await github(`/git/trees/${treeSha}?recursive=1`);
  if (tree.truncated) throw new ApiError(413, "Repository tree is too large to import safely");
  if (!Array.isArray(tree.tree)) throw new ApiError(502, "Invalid repository tree");
  let skipped = 0; let bytes = 0;
  const entries: Entry[] = [];
  for (const item of tree.tree as Entry[]) {
    if (typeof item.path !== "string") throw new ApiError(502, "Invalid repository path");
    const parts = item.path.split("/");
    if (parts.length > 30 || parts.some(part => !isSafeName(part))) throw new ApiError(422, "Repository contains unsupported paths");
    if (item.type === "tree") continue;
    if (item.type !== "blob" || !["100644", "100755"].includes(item.mode) || parts.some(part => ignored.has(part) || /^\.env(?:\.|$)/i.test(part)) || /\.(pem|key|p12|pfx)$/i.test(item.path) || /(^|\/)(\.npmrc|\.yarnrc|id_rsa|id_ed25519)$/.test(item.path) || binary.test(item.path)) { skipped++; continue; }
    if (!Number.isSafeInteger(item.size) || item.size! < 0 || item.size! > 1024 * 1024) throw new ApiError(413, "A repository file exceeds the 1 MB limit");
    bytes += item.size!;
    if (bytes > MAX_BYTES || entries.length >= MAX_FILES) throw new ApiError(413, "Import supports up to 200 text files and 4 MB of source");
    if (!/^[a-f0-9]{40,64}$/.test(item.sha)) throw new ApiError(502, "Invalid repository file reference");
    entries.push(item);
  }
  if (!entries.some(entry => entry.path === "package.json")) throw new ApiError(422, "Choose a Node.js repository with package.json at its root");
  const files = new Map<string, string>();
  let offset = 0;
  async function worker() {
    while (offset < entries.length) {
      const entry = entries[offset++];
      const blob = await github(`/git/blobs/${entry.sha}`);
      if (blob.encoding !== "base64" || typeof blob.content !== "string") throw new ApiError(422, "Unsupported GitHub file encoding");
      const data = Buffer.from(blob.content, "base64");
      if (data.length !== entry.size) throw new ApiError(502, "Repository file size changed unexpectedly");
      if (data.includes(0)) { skipped++; continue; }
      try { files.set(entry.path, new TextDecoder("utf-8", { fatal: true }).decode(data)); }
      catch { skipped++; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
  let manifest;
  try { manifest = JSON.parse(files.get("package.json") || ""); } catch { throw new ApiError(422, "Root package.json must be valid UTF-8 JSON"); }
  if (!manifest || typeof manifest !== "object" || ![manifest.scripts?.dev, manifest.scripts?.start].some(script => typeof script === "string" && script.trim())) throw new ApiError(422, "Node.js project needs a dev or start npm script");
  const root: TemplateFolder = { folderName: repo, items: [] };
  for (const [filePath, content] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const parts = filePath.split("/"); const name = parts.pop()!; let folder = root;
    for (const part of parts) {
      let child = folder.items.find(item => "folderName" in item && item.folderName === part) as TemplateFolder | undefined;
      if (!child) { child = { folderName: part, items: [] }; folder.items.push(child); }
      folder = child;
    }
    const dot = name.lastIndexOf(".");
    const file: TemplateFile = { filename: dot > 0 ? name.slice(0, dot) : name, fileExtension: dot > 0 ? name.slice(dot + 1) : "", content };
    folder.items.push(file);
  }
  if (!isTemplateFolder(root)) throw new ApiError(422, "Repository cannot be represented safely in the editor");
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const template: Template = dependencies.next ? "NEXTJS" : dependencies.react ? "REACT" : dependencies.vue ? "VUE" : dependencies.hono ? "HONO" : dependencies["@angular/core"] ? "ANGULAR" : "EXPRESS";
  return { root, template, title: repo, source: `${owner}/${repo}`, commit: commit.sha, files: files.size, skipped };
}
