import { z } from "zod";
import { currentUser } from "@/modules/auth/actions";
import { db } from "@/lib/db";
import { ApiError, errorResponse } from "@/lib/api-error";
import { readJsonBody } from "@/lib/json-body";
import { importRepository } from "@/modules/github/lib/import-repository";

export const runtime = "nodejs";
const schema = z.object({ repository: z.string().max(300), ref: z.string().trim().max(200).optional() });
const imports = new Map<string, number>();
export async function POST(request: Request) {
  let userId: string | undefined;
  let admitted = false;
  try {
    userId = (await currentUser())?.id;
    if (!userId) throw new ApiError(401, "Sign in to import a repository");
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Invalid request origin");
    const now = Date.now();
    for (const [key, time] of imports) if (now - time > 120000) imports.delete(key);
    if (imports.has(userId) || imports.size >= 100) throw new ApiError(429, "Please wait before importing another repository");
    const input = schema.safeParse(await readJsonBody(request, 4096));
    if (!input.success) throw new ApiError(400, "Invalid repository import request");
    imports.set(userId, now); admitted = true;
    const account = await db.account.findFirst({ where: { userId, provider: "github" }, select: { access_token: true } });
    const imported = await importRepository(input.data.repository, input.data.ref, account?.access_token || undefined, request.signal);
    if (request.signal.aborted) throw new ApiError(499, "Import cancelled");
    const playground = await db.playground.create({ data: {
      title: imported.title,
      description: `Imported from ${imported.source} at ${String(imported.commit).slice(0, 12)}`,
      template: imported.template,
      userId,
      templateFiles: { create: { content: JSON.stringify(imported.root) } },
    }, select: { id: true } });
    return Response.json({ id: playground.id, files: imported.files, skipped: imported.skipped }, { status: 201 });
  } catch (error) {
    // Failed requests may be retried; successful imports have a short per-user cooldown.
    if (admitted && userId) imports.delete(userId);
    return errorResponse(error);
  }
}
