/**
 * Edge-safe pieces of the Athena SSO integration: no Prisma, no `next/headers`.
 * This module is imported from `src/proxy.ts` (which runs on the Edge runtime
 * and must not pull in Node-only dependencies) as well as from
 * `src/lib/session.ts` (which runs on the Node runtime). Keep it that way.
 */

export const ATHENA_COOKIE_NAME = "tv";

export const ATHENA_BASE_URL = process.env.ATHENA_BASE_URL ?? "https://athena.org.tr";

/**
 * Calytrix's own public origin, e.g. "https://calytrix.athena.org.tr". Always prefer `AUTH_URL`
 * over anything derived from the request: behind the Cloudflare Tunnel, `cloudflared` connects to
 * this app over plain `http://localhost:8772`, so a request's own `Host`/`nextUrl.origin` resolves
 * to `localhost:8772`, not the public hostname -- using that to build a redirect would send the
 * browser to an address it cannot reach. `requestOrigin` is only a fallback for local dev, where
 * `AUTH_URL` may be unset.
 */
export function calytrixOrigin(requestOrigin?: string): string {
  return process.env.AUTH_URL ?? requestOrigin ?? "http://localhost:3000";
}

/** How long a positive/negative `/api/me` lookup is cached, keyed by the full cookie value. */
const ATHENA_ME_CACHE_TTL_MS = 60_000;

export interface AthenaUser {
  id: number;
  username: string;
  email: string | null;
}

interface AthenaMeCacheEntry {
  value: AthenaUser | null;
  expiresAt: number;
}

interface AthenaMeResponse {
  signed_in: boolean;
  id?: number;
  username?: string;
  email?: string | null;
}

// Shared across requests within this server process. Keyed by the *entire*
// `tv` cookie value (never by username or any derived value) so a cache hit
// can never resolve to a different user than the one who sent that cookie.
const athenaMeCache = new Map<string, AthenaMeCacheEntry>();

function parseAthenaMeResponse(data: unknown): AthenaUser | null {
  if (!data || typeof data !== "object") return null;
  const res = data as AthenaMeResponse;
  if (!res.signed_in || typeof res.id !== "number" || typeof res.username !== "string") {
    return null;
  }
  return { id: res.id, username: res.username, email: res.email ?? null };
}

/**
 * Resolves an Athena identity from the raw `tv` cookie value by calling
 * `GET https://athena.org.tr/api/me`. Results (including "not signed in") are
 * cached in-process for `ATHENA_ME_CACHE_TTL_MS`, keyed by the cookie value.
 */
export async function resolveAthenaUser(cookieValue: string): Promise<AthenaUser | null> {
  const now = Date.now();
  const cached = athenaMeCache.get(cookieValue);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let value: AthenaUser | null = null;
  try {
    const res = await fetch(`${ATHENA_BASE_URL}/api/me`, {
      headers: { Cookie: `${ATHENA_COOKIE_NAME}=${cookieValue}` },
      cache: "no-store",
    });
    if (res.ok) {
      value = parseAthenaMeResponse(await res.json());
    }
  } catch {
    // Network/parse failure: treat as "not signed in" rather than throwing, so
    // a transient Athena outage degrades to the sign-in screen instead of a 500.
    value = null;
  }

  athenaMeCache.set(cookieValue, { value, expiresAt: now + ATHENA_ME_CACHE_TTL_MS });
  return value;
}

/** Clears the in-process `/api/me` cache. Test-only. */
export function __resetAthenaMeCacheForTests(): void {
  athenaMeCache.clear();
}

/**
 * Builds the Athena sign-in URL that redirects back to `returnUrl` (an
 * absolute Calytrix URL) once the user is signed in.
 */
export function athenaLoginUrl(returnUrl: string): string {
  return `${ATHENA_BASE_URL}/giris?next=${encodeURIComponent(returnUrl)}`;
}
