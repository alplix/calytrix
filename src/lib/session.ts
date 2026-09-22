import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ATHENA_COOKIE_NAME, athenaLoginUrl, calytrixOrigin, resolveAthenaUser, type AthenaUser } from "@/lib/athena";

export { athenaLoginUrl } from "@/lib/athena";
export type { AthenaUser } from "@/lib/athena";

/**
 * Resolves the caller's Athena identity from the shared `tv` SSO cookie by
 * asking `https://athena.org.tr/api/me`. Returns null when the visitor is not
 * signed in to Athena at all (no cookie, or Athena says `signed_in: false`).
 */
export async function getAthenaUser(): Promise<AthenaUser | null> {
  const cookieStore = await cookies();
  const tv = cookieStore.get(ATHENA_COOKIE_NAME)?.value;
  if (!tv) return null;
  return resolveAthenaUser(tv);
}

/**
 * Best-effort absolute origin for this Calytrix deployment, used to build the
 * `next` return URL for Athena's sign-in page. Prefers `AUTH_URL` (required in
 * production) and falls back to the incoming request's own host in dev.
 */
export async function getCalytrixOrigin(): Promise<string> {
  if (process.env.AUTH_URL) return calytrixOrigin();
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return calytrixOrigin(`${proto}://${host}`);
}

/** Builds the Athena sign-in URL that returns to `path` on this deployment (e.g. `/dashboard`). */
export async function athenaLoginUrlForPath(path: string): Promise<string> {
  const origin = await getCalytrixOrigin();
  return athenaLoginUrl(`${origin}${path}`);
}

export interface GithubConnection {
  login: string;
  accessToken: string;
}

/** Reads the caller's connected GitHub authorization, if any, from the database. */
export async function getGithubConnection(athenaUserId: number): Promise<GithubConnection | null> {
  const user = await prisma.user.findUnique({
    where: { id: athenaUserId },
    select: { githubLogin: true, githubAccessToken: true },
  });
  if (!user?.githubAccessToken || !user.githubLogin) return null;
  return { login: user.githubLogin, accessToken: user.githubAccessToken };
}

export type DashboardAccess =
  | { status: "signed-out" }
  | { status: "github-not-connected"; athenaUser: AthenaUser }
  | { status: "ready"; athenaUser: AthenaUser; githubLogin: string; accessToken: string };

/**
 * The three states every protected dashboard page/API route can be in:
 * no Athena identity, Athena identity but no GitHub authorization yet, or
 * both (ready to call GitHub on the user's behalf).
 */
export async function resolveDashboardAccess(): Promise<DashboardAccess> {
  const athenaUser = await getAthenaUser();
  if (!athenaUser) return { status: "signed-out" };

  const connection = await getGithubConnection(athenaUser.id);
  if (!connection) return { status: "github-not-connected", athenaUser };

  return {
    status: "ready",
    athenaUser,
    githubLogin: connection.login,
    accessToken: connection.accessToken,
  };
}
