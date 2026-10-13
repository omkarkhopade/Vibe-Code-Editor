import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import type { WebContainer } from "@webcontainer/api";
import { transformToWebContainerFormat } from "./transformer";
function paths(tree: TemplateFolder, prefix = ""): string[] {
  return tree.items.flatMap(item => "folderName" in item ? paths(item, prefix + item.folderName + "/") : [prefix + item.filename + (item.fileExtension ? "." + item.fileExtension : "")]);
}
export async function syncSource(instance: WebContainer, previous: TemplateFolder | null, next: TemplateFolder) {
  const retained = new Set(paths(next));
  // Remove only previously mounted source files, never dependencies or arbitrary runtime paths.
  for (const file of previous ? paths(previous) : []) if (!retained.has(file)) await instance.fs.rm(file, { force: true });
  await instance.mount(transformToWebContainerFormat(next));
}
