import { NextResponse } from "next/server";
import { requireAuth, errorResponse } from "@/lib/api-helpers";
import { listPullRequests } from "@/lib/github";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/repos/[owner]/[repo]/pulls">
) {
  try {
    const { accessToken } = await requireAuth();
    const { owner, repo } = await ctx.params;
    const pulls = await listPullRequests(accessToken, owner, repo);
    return NextResponse.json({ pulls });
  } catch (error) {
    return errorResponse(error);
  }
}
