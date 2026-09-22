import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/athena", async () => {
  const actual = await vi.importActual<typeof import("@/lib/athena")>("@/lib/athena");
  return {
    ...actual,
    resolveAthenaUser: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { cookies } from "next/headers";
import { resolveAthenaUser } from "@/lib/athena";
import { prisma } from "@/lib/prisma";
import { getAthenaUser, getGithubConnection, resolveDashboardAccess } from "@/lib/session";

function mockCookieStore(tv: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === "tv" && tv !== undefined ? { name, value: tv } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("getAthenaUser", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the request has no tv cookie at all", async () => {
    mockCookieStore(undefined);
    const result = await getAthenaUser();
    expect(result).toBeNull();
    expect(resolveAthenaUser).not.toHaveBeenCalled();
  });

  it("returns null when Athena reports the visitor is not signed in", async () => {
    mockCookieStore("some-cookie-value");
    vi.mocked(resolveAthenaUser).mockResolvedValue(null);

    const result = await getAthenaUser();
    expect(result).toBeNull();
    expect(resolveAthenaUser).toHaveBeenCalledWith("some-cookie-value");
  });

  it("returns the Athena user when signed in", async () => {
    mockCookieStore("some-cookie-value");
    vi.mocked(resolveAthenaUser).mockResolvedValue({ id: 5, username: "alp", email: null });

    const result = await getAthenaUser();
    expect(result).toEqual({ id: 5, username: "alp", email: null });
  });
});

describe("getGithubConnection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the user has never connected GitHub", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const result = await getGithubConnection(5);
    expect(result).toBeNull();
  });

  it("returns null when a row exists but the GitHub fields are empty", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      githubLogin: null,
      githubAccessToken: null,
    } as never);
    const result = await getGithubConnection(5);
    expect(result).toBeNull();
  });

  it("returns the login and access token when connected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      githubLogin: "alplix",
      githubAccessToken: "gho_token",
    } as never);
    const result = await getGithubConnection(5);
    expect(result).toEqual({ login: "alplix", accessToken: "gho_token" });
  });
});

describe("resolveDashboardAccess", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is "signed-out" when there is no Athena identity', async () => {
    mockCookieStore(undefined);
    const access = await resolveDashboardAccess();
    expect(access).toEqual({ status: "signed-out" });
  });

  it('is "github-not-connected" when Athena identity exists but GitHub does not', async () => {
    mockCookieStore("cookie");
    vi.mocked(resolveAthenaUser).mockResolvedValue({ id: 9, username: "alp", email: null });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const access = await resolveDashboardAccess();
    expect(access.status).toBe("github-not-connected");
    if (access.status === "github-not-connected") {
      expect(access.athenaUser.id).toBe(9);
    }
  });

  it('is "ready" with both identity and access token when GitHub is connected', async () => {
    mockCookieStore("cookie");
    vi.mocked(resolveAthenaUser).mockResolvedValue({ id: 9, username: "alp", email: null });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      githubLogin: "alplix",
      githubAccessToken: "gho_token",
    } as never);

    const access = await resolveDashboardAccess();
    expect(access).toEqual({
      status: "ready",
      athenaUser: { id: 9, username: "alp", email: null },
      githubLogin: "alplix",
      accessToken: "gho_token",
    });
  });
});
