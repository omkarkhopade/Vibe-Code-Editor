import { gzipSync, gunzipSync } from "node:zlib";
import { isTemplateFolder } from "./validation";
import type { TemplateFolder, TemplateItem } from "./path-to-json";

export const SOURCE_PREFIX = "vibecode:gzip:v1:";
export const MAX_PACKED_CHARS = 14 * 1024 * 1024;
export const MAX_JSON_BYTES = 40 * 1024 * 1024;
export function canonicalSource(tree: TemplateFolder): TemplateFolder {
  const visit = (item: TemplateItem): TemplateItem => "folderName" in item
    ? { folderName: item.folderName, items: item.items.map(visit) }
    : { filename: item.filename, fileExtension: item.fileExtension, content: item.content };
  return { folderName: tree.folderName, items: tree.items.map(visit) };
}
export function packSource(tree: TemplateFolder): string {
  if (!isTemplateFolder(tree)) throw new Error("Invalid template structure or project exceeds 4 MB");
  const json = JSON.stringify(canonicalSource(tree));
  if (Buffer.byteLength(json) > MAX_JSON_BYTES) throw new Error("Project metadata exceeds the storage limit");
  const packed = SOURCE_PREFIX + gzipSync(json).toString("base64");
  if (packed.length > MAX_PACKED_CHARS) throw new Error("Project exceeds the storage limit");
  return packed;
}
export function unpackSource(content: string): TemplateFolder {
  let json: string;
  if (content.startsWith(SOURCE_PREFIX)) {
    if (content.length > MAX_PACKED_CHARS) throw new Error("Project exceeds the storage limit");
    const encoded = content.slice(SOURCE_PREFIX.length);
    if (encoded.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(encoded) || Buffer.from(encoded, "base64").toString("base64") !== encoded) throw new Error("Invalid source encoding");
    json = gunzipSync(Buffer.from(encoded, "base64"), { maxOutputLength: MAX_JSON_BYTES }).toString("utf8");
  } else {
    if (Buffer.byteLength(content) > MAX_JSON_BYTES) throw new Error("Project exceeds the storage limit");
    json = content;
  }
  const value: unknown = JSON.parse(json);
  if (!isTemplateFolder(value)) throw new Error("Invalid template structure or project exceeds 4 MB");
  return canonicalSource(value);
}
