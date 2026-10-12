"use server";
import { db } from "@/lib/db";
import type { TemplateFolder } from "../lib/path-to-json";
import { isTemplateFolder } from "../lib/validation";
import { requirePlaygroundOwner } from "@/lib/playground-access";
export async function getPlaygroundById(id: string) {
  const userId = await requirePlaygroundOwner(id);
  return db.playground.findUnique({ where: { id, userId }, select: { id: true, title: true, templateFiles: { select: { content: true } } } });
}
export async function SaveUpdatedCode(playgroundId: string, data: TemplateFolder) {
  await requirePlaygroundOwner(playgroundId);
  if (!isTemplateFolder(data)) throw new Error("Invalid template structure or project exceeds 4 MB");
  const content = JSON.stringify(data);
  // A failed write must reject so the editor never marks unsaved work as saved.
  return db.templateFile.upsert({ where: { playgroundId }, update: { content }, create: { playgroundId, content } });
}
