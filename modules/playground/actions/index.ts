"use server";
import { db } from "@/lib/db";
import type { TemplateFolder } from "../lib/path-to-json";
import { isTemplateFolder } from "../lib/validation";
import { requirePlaygroundOwner } from "@/lib/playground-access";
import { sourceRevision } from "../lib/revision";
export async function getPlaygroundById(id: string) {
  const userId = await requirePlaygroundOwner(id);
  const project = await db.playground.findUnique({ where: { id, userId }, select: { id: true, title: true, templateFiles: { select: { content: true } } } });
  return project ? { ...project, revision: sourceRevision(project.templateFiles[0]?.content) } : null;
}
export async function SaveUpdatedCode(playgroundId: string, data: TemplateFolder, expectedRevision: string | null) {
  const userId = await requirePlaygroundOwner(playgroundId);
  if (!isTemplateFolder(data)) throw new Error("Invalid template structure or project exceeds 4 MB");
  if (expectedRevision !== null && (typeof expectedRevision !== "string" || !/^[a-f0-9]{64}$/.test(expectedRevision))) throw new Error("Reload the project before saving");
  const content = JSON.stringify(data);
  const current = await db.templateFile.findUnique({ where: { playgroundId }, select: { content: true } });
  if (sourceRevision(current?.content) !== expectedRevision) throw new Error("This project changed in another tab. Copy your unsaved edits, then reload before saving.");
  // The source comparison is part of the write, so competing requests cannot overwrite one another.
  if (current) {
    const result = await db.templateFile.updateMany({ where: { playgroundId, content: current.content, playground: { userId } }, data: { content } });
    if (result.count !== 1) throw new Error("Project changed or was deleted. Copy your edits before reloading.");
  } else {
    // Nested create validates the parent relation and the unique playgroundId prevents racing first saves.
    await db.playground.update({ where: { id: playgroundId, userId }, data: { templateFiles: { create: { content } } } });
  }
  return { revision: sourceRevision(content) };
}
