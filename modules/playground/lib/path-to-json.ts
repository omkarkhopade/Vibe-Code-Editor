import fs from "node:fs/promises";
import path from "node:path";
export interface TemplateFile { filename: string; fileExtension: string; content: string }
export interface TemplateFolder { folderName: string; items: (TemplateFile | TemplateFolder)[] }
export type TemplateItem = TemplateFile | TemplateFolder;
interface ScanOptions { ignoreFiles?: string[]; ignoreFolders?: string[]; ignorePatterns?: RegExp[]; maxFileSize?: number }
export async function scanTemplateDirectory(templatePath: string, options: ScanOptions = {}): Promise<TemplateFolder> {
  if (!templatePath) throw new Error("Template path is required");
  const root = await fs.realpath(templatePath);
  const ignoredFiles = new Set(["package-lock.json", "yarn.lock", ".DS_Store", "thumbs.db", ".gitignore", ".npmrc", ".yarnrc", ...options.ignoreFiles || []]);
  const ignoredFolders = new Set(["node_modules", ".git", ".vscode", ".idea", "dist", "build", "coverage", ".next", ...options.ignoreFolders || []]);
  const patterns = [/^\.env(?:\.|$)/, /\.(?:pem|key)$/i, /^\..+\.swp$/, /^\.#/, /~$/, ...options.ignorePatterns || []];
  let bytes = 0; let count = 0;
  async function scan(directory: string, depth: number): Promise<TemplateFolder> {
    if (depth > 30) throw new Error("Template exceeds maximum depth");
    const real = await fs.realpath(directory);
    const relative = path.relative(root, real);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Template path escapes root");
    const entries = await fs.readdir(real, { withFileTypes: true });
    const items: TemplateItem[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) continue;
      if (patterns.some(pattern => { pattern.lastIndex = 0; return pattern.test(entry.name); })) continue;
      const location = path.join(real, entry.name);
      if (entry.isDirectory()) {
        if (ignoredFolders.has(entry.name)) continue;
        if (++count > 5000) throw new Error("Template exceeds entry limit");
        items.push(await scan(location, depth + 1));
      } else if (entry.isFile()) {
        if (ignoredFiles.has(entry.name)) continue;
        if (++count > 5000) throw new Error("Template exceeds entry limit");
        const stat = await fs.lstat(location);
        if (!stat.isFile()) throw new Error("Template file changed during scan");
        bytes += stat.size;
        if (stat.size > (options.maxFileSize ?? 1024 * 1024) || bytes > 4 * 1024 * 1024) throw new Error("Template exceeds size limit");
        const parsed = path.parse(entry.name);
        const content = await fs.readFile(location, "utf8");
        items.push({ filename: parsed.name, fileExtension: parsed.ext.replace(/^\./, ""), content });
      }
    }
    return { folderName: path.basename(real), items };
  }
  return scan(root, 0);
}
// Offline utilities only. Request handlers never write generated JSON to disk.
export async function saveTemplateStructureToJson(templatePath: string, outputPath: string, options?: ScanOptions): Promise<void> {
  const structure = await scanTemplateDirectory(templatePath, options);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(structure, null, 2), "utf8");
}
export async function readTemplateStructureFromJson(filePath: string): Promise<TemplateFolder> {
  const { isTemplateFolder } = await import("./validation");
  const value: unknown = JSON.parse(await fs.readFile(filePath, "utf8"));
  if (!isTemplateFolder(value)) throw new Error("Invalid template structure");
  return value;
}
