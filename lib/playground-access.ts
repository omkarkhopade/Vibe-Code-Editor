import { currentUser } from "@/modules/auth/actions";
import { db } from "@/lib/db";
import { isPlaygroundId } from "@/modules/playground/lib/validation";
export async function requireUserId() {
  const user = await currentUser();
  if (!user?.id) throw new Error("Authentication required");
  return user.id;
}
export async function requirePlaygroundOwner(id: string) {
  if (!isPlaygroundId(id)) throw new Error("Invalid playground ID");
  const userId = await requireUserId();
  const playground = await db.playground.findUnique({ where: { id, userId }, select: { id: true } });
  if (!playground) throw new Error("Playground not found");
  return userId;
}
