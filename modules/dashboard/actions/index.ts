"use server";
import { db } from "@/lib/db";
import { requireUserId, requirePlaygroundOwner } from "@/lib/playground-access";
import { revalidatePath } from "next/cache";
import { z } from "zod";
const fields = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(2000).default("") });
const creation = fields.extend({ template: z.enum(["REACT", "NEXTJS", "EXPRESS", "VUE", "HONO", "ANGULAR"]) });
export async function toggleStarMarked(playgroundId: string, isChecked: boolean) {
  const userId = await requirePlaygroundOwner(playgroundId);
  if (typeof isChecked !== "boolean") throw new Error("Invalid star state");
  if (isChecked) await db.starMark.upsert({ where: { userId_playgroundId: { userId, playgroundId } }, update: { isMarked: true }, create: { userId, playgroundId, isMarked: true } });
  else await db.starMark.deleteMany({ where: { userId, playgroundId } });
  revalidatePath("/dashboard");
  return { success: true, isMarked: isChecked };
}
export async function getAllPlaygroundForUser() {
  const userId = await requireUserId();
  return db.playground.findMany({ where: { userId }, include: { user: { select: { id: true, name: true, image: true } }, Starmark: { where: { userId }, select: { isMarked: true } } }, orderBy: { updatedAt: "desc" } });
}
export async function createPlayground(data: { title: string; template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR"; description?: string }) {
  const userId = await requireUserId();
  const values = creation.parse(data);
  return db.playground.create({ data: { ...values, userId } });
}
export async function deleteProjectById(id: string) {
  const userId = await requirePlaygroundOwner(id);
  await db.playground.delete({ where: { id, userId } });
  revalidatePath("/dashboard");
}
export async function editProjectById(id: string, data: { title: string; description: string }) {
  const userId = await requirePlaygroundOwner(id);
  await db.playground.update({ where: { id, userId }, data: fields.parse(data) });
  revalidatePath("/dashboard");
}
export async function duplicateProjectById(id: string) {
  const userId = await requirePlaygroundOwner(id);
  const original = await db.playground.findUnique({ where: { id, userId }, include: { templateFiles: { select: { content: true } } } });
  if (!original) throw new Error("Playground not found");
  const result = await db.playground.create({ data: { title: original.title + " (Copy)", description: original.description, template: original.template, userId, templateFiles: { create: original.templateFiles.map(({ content }) => ({ content })) } } });
  revalidatePath("/dashboard");
  return result;
}
