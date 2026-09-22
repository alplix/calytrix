import crypto from "node:crypto";

/**
 * Signed, short-lived `state` value for the "Connect GitHub" OAuth flow
 * (src/app/api/auth/github/connect and src/app/api/auth/callback/github).
 *
 * The GitHub OAuth App's callback URL is fixed at
 * `https://calytrix.athena.org.tr/api/auth/callback/github` and cannot encode
 * anything itself, so we carry the Athena user id (and a nonce, and an issue
 * time) through GitHub's opaque `state` round-trip, HMAC-signed with
 * AUTH_SECRET so it can't be forged or replayed for a different user.
 */

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface GithubOAuthStatePayload {
  athenaUserId: number;
  nonce: string;
  issuedAt: number;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createGithubOAuthState(athenaUserId: number): string {
  const payload: GithubOAuthStatePayload = {
    athenaUserId,
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt: Date.now(),
  };
  const json = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${json}.${sign(json)}`;
}

/** Verifies signature, shape, and expiry. Returns null on any failure — never throws. */
export function verifyGithubOAuthState(state: string | null | undefined): GithubOAuthStatePayload | null {
  if (!state) return null;

  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const json = state.slice(0, dot);
  const signature = state.slice(dot + 1);
  if (!json || !signature) return null;

  let expectedSignature: string;
  try {
    expectedSignature = sign(json);
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload: GithubOAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload.athenaUserId !== "number" ||
    typeof payload.nonce !== "string" ||
    typeof payload.issuedAt !== "number"
  ) {
    return null;
  }

  if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;

  return payload;
}
