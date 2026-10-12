import type { FileSystemTree } from "@webcontainer/api";
import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import { isTemplateFolder } from "@/modules/playground/lib/validation";
export function transformToWebContainerFormat(template: TemplateFolder): FileSystemTree {
  if (!isTemplateFolder(template)) throw new Error("Invalid template structure");
  function directory(folder: TemplateFolder): FileSystemTree {
    return Object.fromEntries(folder.items.map(item => "folderName" in item
      ? [item.folderName, { directory: directory(item) }]
      : [item.filename + (item.fileExtension ? "." + item.fileExtension : ""), { file: { contents: item.content } }]));
  }
  return directory(template);
}
