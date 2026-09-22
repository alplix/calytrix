import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  getAthenaUser: vi.fn(),
  getCalytrixOrigin: vi.fn().mockResolvedValue("https://calytrix.athena.org.tr"),
  athenaLoginUrlForPath: vi
    .fn()
    .mockImplementation(
      async (path: string) =>
        `https://athena.org.tr/giris?next=${encodeURIComponent(`https://calytrix.athena.org.tr${path}`)}`
    ),
}));

vi.mock("@/lib/oauth-state", () => ({
  createGithubOAuthState: vi.fn().mockReturnValue("signed-state"),
}));

vi.mock("@/lib/github-oauth", () => ({
  githubAuthorizeUrl: vi.fn(),
}));

import { getAthenaUser } from "@/lib/session";
import { createGithubOAuthState } from "@/lib/oauth-state";
import { githubAuthorizeUrl } from "@/lib/github-oauth";
import { GET } from "@/app/api/auth/github/connect/route";

describe("GET /api/auth/github/connect", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to Athena sign-in when there is no Athena session yet", async () => {
    vi.mocked(getAthenaUser).mockResolvedValue(null);

    const res = await GET();

    expect(res.headers.get("location")).toContain("athena.org.tr/giris");
    expect(createGithubOAuthState).not.toHaveBeenCalled();
  });

  it("signs a state for the caller's Athena id and redirects to GitHub's authorize endpoint", async () => {
    vi.mocked(getAthenaUser).mockResolvedValue({ id: 42, username: "alp", email: null });
    vi.mocked(githubAuthorizeUrl).mockReturnValue("https://github.com/login/oauth/authorize?state=signed-state");

    const res = await GET();

    expect(createGithubOAuthState).toHaveBeenCalledWith(42);
    expect(githubAuthorizeUrl).toHaveBeenCalledWith("signed-state");
    expect(res.headers.get("location")).toBe("https://github.com/login/oauth/authorize?state=signed-state");
  });
});
