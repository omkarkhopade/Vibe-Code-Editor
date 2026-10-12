import type { TemplateFile, TemplateFolder } from "./path-to-json";
export function findFilePath(file: TemplateFile, folder: TemplateFolder, pathSoFar: string[] = []): string | null {
  if ("id" in file && typeof file.id === "string") return file.id;
  const matches: string[] = []; let identity: string | null = null;
  function visit(current: TemplateFolder, parents: string[]) {
    for (const item of current.items) {
      if ("folderName" in item) visit(item, [...parents, item.folderName]);
      else {
        const path = [...parents, item.filename + (item.fileExtension ? "." + item.fileExtension : "")].join("/");
        if (item === file) identity = path;
        if (item.filename === file.filename && item.fileExtension === file.fileExtension && item.content === file.content) matches.push(path);
      }
    }
  }
  visit(folder, pathSoFar);
  return identity ?? (matches.length === 1 ? matches[0] : null);
}
export function generateFileId(file: TemplateFile, root: TemplateFolder): string {
  const path = findFilePath(file, root);
  if (!path) throw new Error("File path is missing or ambiguous");
  return path;
}
export function updateFilesByPath(folder: TemplateFolder, updates: ReadonlyMap<string, string>, parent = ""): TemplateFolder {
  return { ...folder, items: folder.items.map(item => {
    if ("folderName" in item) return updateFilesByPath(item, updates, parent + item.folderName + "/");
    const key = parent + item.filename + (item.fileExtension ? "." + item.fileExtension : "");
    return updates.has(key) ? { ...item, content: updates.get(key)! } : item;
  }) };
}
