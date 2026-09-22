import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGithubOAuthState, verifyGithubOAuthState } from "@/lib/oauth-state";

describe("github OAuth state signing", () => {
  const originalSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
    vi.useRealTimers();
  });

  it("round-trips a freshly created state for the given Athena user id", () => {
    const state = createGithubOAuthState(42);
    const payload = verifyGithubOAuthState(state);
    expect(payload).not.toBeNull();
    expect(payload?.athenaUserId).toBe(42);
    expect(typeof payload?.nonce).toBe("string");
  });

  it("rejects a state signed with a different secret", () => {
    const state = createGithubOAuthState(1);
    process.env.AUTH_SECRET = "a-different-secret";
    expect(verifyGithubOAuthState(state)).toBeNull();
  });

  it("rejects a tampered payload even if the signature format looks valid", () => {
    const state = createGithubOAuthState(1);
    const [, signature] = state.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ athenaUserId: 999, nonce: "x", issuedAt: Date.now() })).toString(
      "base64url"
    );
    expect(verifyGithubOAuthState(`${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("rejects an expired state (older than the 10 minute TTL)", () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const state = createGithubOAuthState(7);

    vi.setSystemTime(now + 11 * 60 * 1000);
    expect(verifyGithubOAuthState(state)).toBeNull();

    vi.setSystemTime(now + 9 * 60 * 1000);
    expect(verifyGithubOAuthState(state)).not.toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    expect(verifyGithubOAuthState(null)).toBeNull();
    expect(verifyGithubOAuthState(undefined)).toBeNull();
    expect(verifyGithubOAuthState("")).toBeNull();
    expect(verifyGithubOAuthState("not-a-valid-state")).toBeNull();
    expect(verifyGithubOAuthState("only-one-part.")).toBeNull();
  });
});
