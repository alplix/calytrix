import { NextResponse } from "next/server";
import { getAthenaUser, getCalytrixOrigin, athenaLoginUrlForPath } from "@/lib/session";
import { createGithubOAuthState } from "@/lib/oauth-state";
import { githubAuthorizeUrl } from "@/lib/github-oauth";

/**
 * Step 1 of "Connect GitHub": requires an existing Athena session, then hands
 * off to GitHub's real OAuth authorize endpoint (no next-auth involved).
 */
export async function GET() {
  const athenaUser = await getAthenaUser();
  if (!athenaUser) {
    return NextResponse.redirect(await athenaLoginUrlForPath("/dashboard"));
  }

  const state = createGithubOAuthState(athenaUser.id);
  try {
    return NextResponse.redirect(githubAuthorizeUrl(state));
  } catch {
    const origin = await getCalytrixOrigin();
    return NextResponse.redirect(new URL("/dashboard?github_error=not_configured", origin));
  }
}
