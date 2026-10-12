import { currentUser } from "@/modules/auth/actions";
import { db } from "@/lib/db";
import { checkModel } from "@/modules/ai/lib/ollama";
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("ready") !== "1") return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  try {
    if (!(await currentUser())?.id) return Response.json({ error: "Authentication required" }, { status: 401 });
    const [database, ai] = await Promise.allSettled([
      db.$runCommandRaw({ ping: 1, maxTimeMS: 5000 }),
      checkModel(AbortSignal.timeout(5000)),
    ]);
    const ready = database.status === "fulfilled" && ai.status === "fulfilled";
    return Response.json({ status: ready ? "ready" : "unavailable", database: database.status === "fulfilled", ai: ai.status === "fulfilled" }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ status: "unavailable" }, { status: 503 }); }
}
