import { currentUser } from "@/modules/auth/actions";
import { listModels } from "@/modules/ai/lib/ollama";
import { ApiError, errorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    if (!(await currentUser())?.id) throw new ApiError(401, "Authentication required");
    return Response.json(await listModels(request.signal), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
