import type { TemplateFolder } from "./path-to-json";
export function isPlaygroundId(value: unknown): value is string {
  return typeof value === "string" && /^c[a-z0-9]{24}$/.test(value);
}
export function isSafeName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 255 &&
    value !== "." && value !== ".." && !/[\\/\x00-\x1f:]/.test(value) &&
    !["__proto__", "constructor", "prototype"].includes(value);
}
export function isTemplateFolder(value: unknown): value is TemplateFolder {
  let count = 0;
  let bytes = 0;
  function visit(node: unknown, depth: number): boolean {
    if (!node || typeof node !== "object" || depth > 30 || ++count > 5000) return false;
    const item = node as Record<string, unknown>;
    if ("folderName" in item) {
      if (!isSafeName(item.folderName) || !Array.isArray(item.items)) return false;
      const names = new Set<string>();
      return item.items.every(child => {
        if (!visit(child, depth + 1)) return false;
        const name = "folderName" in child ? child.folderName : child.filename + (child.fileExtension ? "." + child.fileExtension : "");
        if (names.has(name)) return false;
        names.add(name);
        return true;
      });
    }
    if (!isSafeName(item.filename) || typeof item.fileExtension !== "string" ||
        (item.fileExtension !== "" && !isSafeName(item.fileExtension)) || typeof item.content !== "string") return false;
    bytes += new TextEncoder().encode(item.content).length;
    return bytes <= 4 * 1024 * 1024;
  }
  return !!value && typeof value === "object" && "folderName" in value && visit(value, 0);
}
