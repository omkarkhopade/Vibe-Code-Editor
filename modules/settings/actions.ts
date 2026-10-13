"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/playground-access";
import { revalidatePath } from "next/cache";
export async function updateProfile(input: unknown) {
  const id = await requireUserId();
  const data = z.object({ name: z.string().trim().min(1).max(100) }).parse(input);
  await db.user.update({ where: { id }, data });
  revalidatePath("/settings"); revalidatePath("/dashboard");
  return { success: true };
}
