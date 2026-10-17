import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { ApiError, errorResponse } from "@/lib/api-error";
import { readJsonBody } from "@/lib/json-body";
import { isPlaygroundId } from "@/modules/playground/lib/validation";
import { sourceRevision } from "@/modules/playground/lib/revision";
import { packSource, unpackSource, MAX_PACKED_CHARS, SOURCE_PREFIX } from "@/modules/playground/lib/source-codec";
import { beginUpload, appendUpload, takeUpload, abortUpload, CHUNK_CHARS } from "@/modules/playground/lib/source-upload";
import { SaveUpdatedCode } from "@/modules/playground/actions";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("begin"), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/).nullable(), totalLength: z.number().int().positive().max(MAX_PACKED_CHARS) }),
  z.object({ operation: z.literal("chunk"), uploadId: z.string().uuid(), index: z.number().int().min(0).max(Math.ceil(MAX_PACKED_CHARS / CHUNK_CHARS) - 1), chunk: z.string().min(1).max(CHUNK_CHARS).regex(/^[A-Za-z0-9+/:=\-]+$/) }),
  z.object({ operation: z.literal("commit"), uploadId: z.string().uuid() }),
  z.object({ operation: z.literal("abort"), uploadId: z.string().uuid() }),
]);
async function owner(id: string) {
  if (!isPlaygroundId(id)) throw new ApiError(400, "Invalid playground ID");
  const user = await currentUser();
  if (!user?.id) throw new ApiError(401, "Authentication required");
  const project = await db.playground.findUnique({ where: { id, userId: user.id }, select: { id: true, title: true } });
  if (!project) throw new ApiError(404, "Playground not found");
  return { userId: user.id, project };
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { project } = await owner(id);
    const query = new URL(request.url).searchParams;
    const index = Number(query.get("chunk") ?? 0);
    if (!Number.isInteger(index) || index < 0 || index >= Math.ceil(MAX_PACKED_CHARS / CHUNK_CHARS)) throw new ApiError(400, "Invalid chunk index");
    const stored = await db.templateFile.findUnique({ where: { playgroundId: id }, select: { content: true } });
    const revision = sourceRevision(stored?.content);
    if (query.has("revision") && query.get("revision") !== revision) throw new ApiError(409, "Project changed while loading. Reload to get a consistent version.");
    const packed = stored ? (stored.content.startsWith(SOURCE_PREFIX) ? stored.content : packSource(unpackSource(stored.content))) : null;
    if (packed && packed.length > MAX_PACKED_CHARS) throw new ApiError(413, "Saved source exceeds the storage limit");
    const chunk = packed?.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS) ?? null;
    if (packed && !chunk) throw new ApiError(400, "Chunk index out of range");
    return Response.json({ id: project.id, title: project.title, revision, chunk, totalChunks: packed ? Math.ceil(packed.length / CHUNK_CHARS) : 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Invalid request origin");
    const { id } = await params;
    const { userId } = await owner(id);
    const parsed = schema.safeParse(await readJsonBody(request, CHUNK_CHARS + 2048));
    if (!parsed.success) throw new ApiError(400, "Invalid upload request");
    const input = parsed.data;
    if (input.operation === "begin") return Response.json(await beginUpload(userId, id, input.expectedRevision, input.totalLength));
    if (input.operation === "chunk") { await appendUpload(userId, id, input.uploadId, input.index, input.chunk); return Response.json({ success: true }); }
    if (input.operation === "abort") { await abortUpload(userId, id, input.uploadId); return Response.json({ success: true }); }
    const uploaded = await takeUpload(userId, id, input.uploadId);
    let tree;
    try { tree = unpackSource(uploaded.content); } catch { throw new ApiError(400, "Invalid source upload. Your saved project was not changed."); }
    try { return Response.json(await SaveUpdatedCode(id, tree, uploaded.expectedRevision)); }
    catch (error) {
      if (error instanceof Error && /another tab|changed or was deleted/.test(error.message)) throw new ApiError(409, error.message);
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
