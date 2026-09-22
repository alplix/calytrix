/**
 * Direct GitHub OAuth calls for the "Connect GitHub" flow — deliberately not
 * next-auth. Scopes/callback: see AGENTS instructions for this feature and
 * src/app/api/auth/github/{connect,callback}.
 */

// Minimal scopes: `read:user` for profile, `repo` for reading pull request
// diffs (private repos need it; GitHub has no read-only PR-diff scope).
export const GITHUB_OAUTH_SCOPE = "read:user repo";

/**
 * The GitHub OAuth App's callback URL is fixed and must never change without
 * reconfiguring the App on GitHub's side.
 */
export function githubCallbackUrl(): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return `${base}/api/auth/callback/github`;
}

export function githubAuthorizeUrl(state: string): string {
  const clientId = process.env.AUTH_GITHUB_ID;
  if (!clientId) throw new Error("AUTH_GITHUB_ID is not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: githubCallbackUrl(),
    scope: GITHUB_OAUTH_SCOPE,
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export interface GithubTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

/** Exchanges an OAuth `code` for an access token. Never sent to the client. */
export async function exchangeGithubCode(code: string): Promise<GithubTokenResponse> {
  const clientId = process.env.AUTH_GITHUB_ID;
  const clientSecret = process.env.AUTH_GITHUB_SECRET;
  if (!clientId || !clientSecret) throw new Error("GitHub OAuth is not configured");

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: githubCallbackUrl(),
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | (GithubTokenResponse & { error?: string; error_description?: string })
    | null;

  if (!res.ok || !data || data.error || !data.access_token) {
    throw new Error(data?.error_description ?? data?.error ?? "GitHub token exchange failed");
  }
  return data;
}

export interface GithubIdentity {
  id: number;
  login: string;
}

export async function fetchGithubIdentity(accessToken: string): Promise<GithubIdentity> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error("Failed to fetch GitHub user");
  const data = (await res.json()) as { id: number; login: string };
  return { id: data.id, login: data.login };
}
