import { NextResponse } from "next/server";
import { getAthenaUser, getCalytrixOrigin, athenaLoginUrlForPath } from "@/lib/session";
import { verifyGithubOAuthState } from "@/lib/oauth-state";
import { exchangeGithubCode, fetchGithubIdentity } from "@/lib/github-oauth";
import { prisma } from "@/lib/prisma";

/**
 * Step 2 of "Connect GitHub". This path is fixed by the GitHub OAuth App's
 * callback URL configuration — do not rename/move it.
 *
 * Replaces next-auth's `[...nextauth]` route handler: verifies the signed
 * `state`, exchanges GitHub's `code` for a real access token, and stores it
 * against the Athena user's row.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = await getCalytrixOrigin();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const payload = verifyGithubOAuthState(state);
  if (!payload || !code) {
    return NextResponse.redirect(new URL("/dashboard?github_error=invalid_state", origin));
  }

  const athenaUser = await getAthenaUser();
  if (!athenaUser) {
    return NextResponse.redirect(await athenaLoginUrlForPath("/dashboard"));
  }
  if (athenaUser.id !== payload.athenaUserId) {
    // The Athena session changed between step 1 and step 2 — refuse rather
    // than attaching this GitHub grant to the wrong Athena account.
    return NextResponse.redirect(new URL("/dashboard?github_error=invalid_state", origin));
  }

  try {
    const token = await exchangeGithubCode(code);
    const identity = await fetchGithubIdentity(token.access_token);

    await prisma.user.upsert({
      where: { id: athenaUser.id },
      update: {
        athenaUsername: athenaUser.username,
        githubLogin: identity.login,
        githubUserId: BigInt(identity.id),
        githubAccessToken: token.access_token,
        githubTokenScope: token.scope,
        githubConnectedAt: new Date(),
      },
      create: {
        id: athenaUser.id,
        athenaUsername: athenaUser.username,
        githubLogin: identity.login,
        githubUserId: BigInt(identity.id),
        githubAccessToken: token.access_token,
        githubTokenScope: token.scope,
        githubConnectedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/dashboard?github_error=connect_failed", origin));
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
