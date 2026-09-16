import { NextResponse } from "next/server";
import { requireAuth, errorResponse } from "@/lib/api-helpers";
import { getPullRequest } from "@/lib/github";
import { getLatestReviewForPullRequest } from "@/lib/review";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/repos/[owner]/[repo]/pulls/[number]">
) {
  try {
    const { accessToken } = await requireAuth();
    const { owner, repo, number } = await ctx.params;
    const pullNumber = Number(number);

    const [pullRequest, review] = await Promise.all([
      getPullRequest(accessToken, owner, repo, pullNumber),
      getLatestReviewForPullRequest(owner, repo, pullNumber),
    ]);

    return NextResponse.json({ pullRequest, review });
  } catch (error) {
    return errorResponse(error);
  }
}
