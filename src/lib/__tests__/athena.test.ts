import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetAthenaMeCacheForTests, athenaLoginUrl, resolveAthenaUser } from "@/lib/athena";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("resolveAthenaUser", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetAthenaMeCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("returns null when Athena reports signed_in: false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { signed_in: false }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await resolveAthenaUser("cookie-a");
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://athena.org.tr/api/me");
    expect(init.headers.Cookie).toBe("tv=cookie-a");
  });

  it("returns the Athena user when signed in", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { signed_in: true, id: 7, username: "alp", email: "a@b.com" })) as unknown as typeof fetch;

    const result = await resolveAthenaUser("cookie-b");
    expect(result).toEqual({ id: 7, username: "alp", email: "a@b.com" });
  });

  it("treats a network failure as not signed in, without throwing", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    await expect(resolveAthenaUser("cookie-c")).resolves.toBeNull();
  });

  it("caches a result for the same cookie value and does not refetch within the TTL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { signed_in: true, id: 1, username: "alp", email: null }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await resolveAthenaUser("same-cookie");
    await resolveAthenaUser("same-cookie");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never returns a cached result for a different cookie value (no cross-user leakage)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { signed_in: true, id: 1, username: "alice", email: null }))
      .mockResolvedValueOnce(jsonResponse(200, { signed_in: true, id: 2, username: "bob", email: null }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const alice = await resolveAthenaUser("alice-cookie");
    const bob = await resolveAthenaUser("bob-cookie");

    expect(alice?.username).toBe("alice");
    expect(bob?.username).toBe("bob");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetches once the 60 second cache TTL has passed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { signed_in: true, id: 1, username: "alp", email: null }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await resolveAthenaUser("cookie-ttl");
    vi.advanceTimersByTime(61_000);
    await resolveAthenaUser("cookie-ttl");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("athenaLoginUrl", () => {
  it("builds the sign-in URL with an encoded return URL", () => {
    const url = athenaLoginUrl("https://calytrix.athena.org.tr/dashboard");
    expect(url).toBe(
      "https://athena.org.tr/giris?next=https%3A%2F%2Fcalytrix.athena.org.tr%2Fdashboard"
    );
  });
});
