import { currentUser } from "@/modules/auth/actions";
import { db } from "@/lib/db";
import { ApiError, errorResponse } from "@/lib/api-error";
import { githubRead } from "@/modules/github/lib/client";
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user?.id) throw new ApiError(401, "Authentication required");
    const account = await db.account.findFirst({ where: { userId: user.id, provider: "github" }, select: { access_token: true } });
    if (!account?.access_token) throw new ApiError(409, "Connect GitHub in Settings to list your repositories. Public URLs can be imported directly.");
    const page = Number(new URL(request.url).searchParams.get("page") || 1);
    if (!Number.isInteger(page) || page < 1 || page > 100) throw new ApiError(400, "Invalid repository page");
    const response = await githubRead(`/user/repos?per_page=30&page=${page}&sort=updated`, account.access_token, request.signal);
    const repositories = await response.json();
    if (!Array.isArray(repositories)) throw new ApiError(502, "Invalid repository list");
    return Response.json({ repositories: repositories.map(repo => ({ name: repo.full_name, url: repo.html_url, branch: repo.default_branch, private: repo.private })), hasNext: (response.headers.get("link") || "").includes('rel="next"') }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
