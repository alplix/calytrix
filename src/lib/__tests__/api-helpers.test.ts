import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  getAthenaUser: vi.fn(),
  getGithubConnection: vi.fn(),
}));

import { getAthenaUser, getGithubConnection } from "@/lib/session";
import { errorResponse, requireAuth } from "@/lib/api-helpers";
import { AppError } from "@/lib/errors";

describe("requireAuth", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("throws UNAUTHORIZED when there is no Athena identity", async () => {
    vi.mocked(getAthenaUser).mockResolvedValue(null);
    await expect(requireAuth()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getGithubConnection).not.toHaveBeenCalled();
  });

  it("throws GITHUB_AUTH_ERROR when Athena identity exists but GitHub is not connected", async () => {
    vi.mocked(getAthenaUser).mockResolvedValue({ id: 3, username: "alp", email: null });
    vi.mocked(getGithubConnection).mockResolvedValue(null);
    await expect(requireAuth()).rejects.toMatchObject({ code: "GITHUB_AUTH_ERROR" });
  });

  it("returns the Athena user id and GitHub access token when both are present", async () => {
    vi.mocked(getAthenaUser).mockResolvedValue({ id: 3, username: "alp", email: null });
    vi.mocked(getGithubConnection).mockResolvedValue({ login: "alplix", accessToken: "gho_token" });

    const result = await requireAuth();
    expect(result).toEqual({ userId: 3, accessToken: "gho_token" });
  });
});

describe("errorResponse", () => {
  it("maps an AppError to its status and code", async () => {
    const res = errorResponse(new AppError("GITHUB_AUTH_ERROR"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("GITHUB_AUTH_ERROR");
  });

  it("maps an unknown error to a generic 500 without leaking details", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("internal secret detail"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("UNKNOWN");
    expect(JSON.stringify(body)).not.toContain("internal secret detail");
    consoleSpy.mockRestore();
  });
});
