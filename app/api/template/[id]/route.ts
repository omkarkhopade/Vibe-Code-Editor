import { scanTemplateDirectory } from "@/modules/playground/lib/path-to-json";
import { isPlaygroundId, isTemplateFolder } from "@/modules/playground/lib/validation";
import { db } from "@/lib/db";
import { templatePaths } from "@/lib/template";
import { ApiError, errorResponse } from "@/lib/api-error";
import { currentUser } from "@/modules/auth/actions";
import path from "node:path";
import fs from "node:fs/promises";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isPlaygroundId(id)) throw new ApiError(400, "Invalid playground ID");
    const user = await currentUser();
    if (!user?.id) throw new ApiError(401, "Sign in to load this playground");
    const playground = await db.playground.findUnique({ where: { id, userId: user.id }, select: { template: true } });
    if (!playground) throw new ApiError(404, "Playground not found");
    if (!Object.hasOwn(templatePaths, playground.template)) throw new ApiError(422, "Invalid template");
    const root = await fs.realpath(path.join(process.cwd(), "vibecode-starters"));
    const input = await fs.realpath(path.join(process.cwd(), "vibecode-starters", templatePaths[playground.template]));
    const relative = path.relative(root, input);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new ApiError(422, "Invalid template path");
    const result = await scanTemplateDirectory(input);
    if (!isTemplateFolder(result)) throw new ApiError(422, "Invalid template structure");
    return Response.json({ success: true, templateJson: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
