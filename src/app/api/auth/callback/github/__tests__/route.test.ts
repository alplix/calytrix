import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  getAthenaUser: vi.fn(),
  getCalytrixOrigin: vi.fn().mockResolvedValue("https://calytrix.athena.org.tr"),
  athenaLoginUrlForPath: vi
    .fn()
    .mockImplementation(async (path: string) => `https://athena.org.tr/giris?next=${encodeURIComponent(`https://calytrix.athena.org.tr${path}`)}`),
}));

vi.mock("@/lib/oauth-state", () => ({
  verifyGithubOAuthState: vi.fn(),
}));

vi.mock("@/lib/github-oauth", () => ({
  exchangeGithubCode: vi.fn(),
  fetchGithubIdentity: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: vi.fn(),
    },
  },
}));

import { getAthenaUser } from "@/lib/session";
import { verifyGithubOAuthState } from "@/lib/oauth-state";
import { exchangeGithubCode, fetchGithubIdentity } from "@/lib/github-oauth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/auth/callback/github/route";

function callbackRequest(query: string) {
  return new Request(`https://calytrix.athena.org.tr/api/auth/callback/github${query}`);
}

describe("GET /api/auth/callback/github", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing/invalid state signature without touching GitHub or the database", async () => {
    vi.mocked(verifyGithubOAuthState).mockReturnValue(null);

    const res = await GET(callbackRequest("?code=abc&state=bad"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("github_error=invalid_state");
    expect(exchangeGithubCode).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("rejects an expired state the same way (verifyGithubOAuthState already returned null)", async () => {
    vi.mocked(verifyGithubOAuthState).mockReturnValue(null);

    const res = await GET(callbackRequest("?code=abc&state=expired"));

    expect(res.headers.get("location")).toContain("github_error=invalid_state");
    expect(exchangeGithubCode).not.toHaveBeenCalled();
  });

  it("refuses to attach the GitHub grant if the Athena session no longer matches the state's user id", async () => {
    vi.mocked(verifyGithubOAuthState).mockReturnValue({ athenaUserId: 1, nonce: "n", issuedAt: Date.now() });
    vi.mocked(getAthenaUser).mockResolvedValue({ id: 2, username: "someone-else", email: null });

    const res = await GET(callbackRequest("?code=abc&state=good"));

    expect(res.headers.get("location")).toContain("github_error=invalid_state");
    expect(exchangeGithubCode).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("redirects to Athena sign-in if the Athena session disappeared entirely", async () => {
    vi.mocked(verifyGithubOAuthState).mockReturnValue({ athenaUserId: 1, nonce: "n", issuedAt: Date.now() });
    vi.mocked(getAthenaUser).mockResolvedValue(null);

    const res = await GET(callbackRequest("?code=abc&state=good"));

    expect(res.headers.get("location")).toContain("athena.org.tr/giris");
    expect(exchangeGithubCode).not.toHaveBeenCalled();
  });

  it("on a valid callback, exchanges the code and saves the token against the correct Athena user id", async () => {
    vi.mocked(verifyGithubOAuthState).mockReturnValue({ athenaUserId: 42, nonce: "n", issuedAt: Date.now() });
    vi.mocked(getAthenaUser).mockResolvedValue({ id: 42, username: "alp", email: null });
    vi.mocked(exchangeGithubCode).mockResolvedValue({
      access_token: "gho_realtoken",
      scope: "read:user,repo",
      token_type: "bearer",
    });
    vi.mocked(fetchGithubIdentity).mockResolvedValue({ id: 987, login: "alplix" });
    vi.mocked(prisma.user.upsert).mockResolvedValue({} as never);

    const res = await GET(callbackRequest("?code=real-code&state=good-state"));

    expect(exchangeGithubCode).toHaveBeenCalledWith("real-code");
    expect(fetchGithubIdentity).toHaveBeenCalledWith("gho_realtoken");
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        update: expect.objectContaining({
          githubLogin: "alplix",
          githubUserId: BigInt(987),
          githubAccessToken: "gho_realtoken",
        }),
        create: expect.objectContaining({
          id: 42,
          githubLogin: "alplix",
          githubUserId: BigInt(987),
          githubAccessToken: "gho_realtoken",
        }),
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://calytrix.athena.org.tr/dashboard");
  });

  it("redirects with an error and does not throw if the GitHub token exchange fails", async () => {
    vi.mocked(verifyGithubOAuthState).mockReturnValue({ athenaUserId: 42, nonce: "n", issuedAt: Date.now() });
    vi.mocked(getAthenaUser).mockResolvedValue({ id: 42, username: "alp", email: null });
    vi.mocked(exchangeGithubCode).mockRejectedValue(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(callbackRequest("?code=bad-code&state=good-state"));

    expect(res.headers.get("location")).toContain("github_error=connect_failed");
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
