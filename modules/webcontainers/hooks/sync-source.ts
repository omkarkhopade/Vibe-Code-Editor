import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import type { WebContainer } from "@webcontainer/api";
import { transformToWebContainerFormat } from "./transformer";
function files(tree: TemplateFolder, prefix = "", result = new Map<string, string>(), directories: string[] = []) {
  for (const item of tree.items) {
    if ("folderName" in item) {
      const directory = prefix + item.folderName;
      directories.push(directory);
      files(item, directory + "/", result, directories);
    } else result.set(prefix + item.filename + (item.fileExtension ? "." + item.fileExtension : ""), item.content);
  }
  return { contents: result, directories };
}
export async function syncSource(instance: WebContainer, previous: TemplateFolder | null, next: TemplateFolder) {
  if (!previous) { await instance.mount(transformToWebContainerFormat(next)); return; }
  const before = files(previous), after = files(next);
  // Touch only changed source files. writeFile notifies dev-server file watchers;
  // unchanged package manifests/dependencies are left alone while typing.
  for (const file of before.contents.keys()) if (!after.contents.has(file)) await instance.fs.rm(file, { force: true });
  const oldDirectories = new Set(before.directories);
  for (const directory of after.directories) if (!oldDirectories.has(directory)) await instance.fs.mkdir(directory, { recursive: true });
  for (const [file, content] of after.contents) if (before.contents.get(file) !== content) await instance.fs.writeFile(file, content);
}
