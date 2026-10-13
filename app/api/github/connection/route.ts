import { currentUser } from "@/modules/auth/actions";
import { db } from "@/lib/db";
import { ApiError, errorResponse } from "@/lib/api-error";
import { githubRead } from "@/modules/github/lib/client";
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user?.id) throw new ApiError(401, "Authentication required");
    const account = await db.account.findFirst({ where: { userId: user.id, provider: "github" }, select: { access_token: true, expires_at: true } });
    let status = "disconnected"; let login: string | undefined;
    if (account) {
      status = "reauthorization_required";
      if (account.access_token && (!account.expires_at || account.expires_at * 1000 > Date.now())) {
        try { const response = await githubRead("/user", account.access_token, request.signal); const profile = await response.json(); login = profile.login; status = "connected"; }
        catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; }
      }
    }
    return Response.json({ status, login }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
