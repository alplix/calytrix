import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractFindingsArray, parseFindings, reviewPullRequestDiff } from "@/lib/tilvar";
import { AppError } from "@/lib/errors";

function validFinding(overrides: Record<string, unknown> = {}) {
  return {
    severity: "high",
    category: "security",
    file: "src/api/user.ts",
    line: 42,
    title: "Unvalidated user input",
    description: "User input reaches the query unchecked.",
    why: "This allows injection attacks.",
    suggestion: "Validate and parameterize the query.",
    ...overrides,
  };
}

describe("parseFindings", () => {
  it("accepts a well-formed findings array", () => {
    const result = parseFindings([validFinding()]);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("high");
  });

  it("accepts an empty array (no issues found)", () => {
    expect(parseFindings([])).toEqual([]);
  });

  it("defaults a missing line to null", () => {
    const finding = validFinding();
    delete (finding as { line?: unknown }).line;
    const result = parseFindings([finding]);
    expect(result[0].line).toBeNull();
  });

  it("drops individually malformed items instead of discarding the whole review", () => {
    const result = parseFindings([
      validFinding({ title: "Good finding" }),
      validFinding({ severity: "not-a-severity" }),
      { totally: "wrong shape" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Good finding");
  });

  it("throws CLAUDE_INVALID_RESPONSE when the top-level value is not an array", () => {
    expect(() => parseFindings({ findings: "oops" })).toThrow(AppError);
    expect(() => parseFindings(null)).toThrow(AppError);
  });
});

describe("extractFindingsArray", () => {
  it("parses a bare JSON array reply", () => {
    const reply = JSON.stringify([validFinding()]);
    expect(extractFindingsArray(reply)).toEqual([validFinding()]);
  });

  it("parses a reply wrapped in a ```json fenced code block", () => {
    const reply = "```json\n" + JSON.stringify([validFinding()]) + "\n```";
    expect(extractFindingsArray(reply)).toEqual([validFinding()]);
  });

  it("parses a reply wrapped in a bare ``` fenced code block", () => {
    const reply = "```\n" + JSON.stringify([validFinding()]) + "\n```";
    expect(extractFindingsArray(reply)).toEqual([validFinding()]);
  });

  it("parses a JSON array with surrounding prose", () => {
    const reply = `Sure, here is the review:\n${JSON.stringify([validFinding()])}\nHope that helps!`;
    expect(extractFindingsArray(reply)).toEqual([validFinding()]);
  });

  it("returns an empty array for unparseable garbage instead of throwing", () => {
    expect(extractFindingsArray("I found no issues in this diff.")).toEqual([]);
    expect(extractFindingsArray("[this is not valid json")).toEqual([]);
    expect(extractFindingsArray("")).toEqual([]);
  });

  it("returns an empty array when the JSON parses but isn't an array", () => {
    expect(extractFindingsArray('{"findings": []}')).toEqual([]);
  });
});

describe("reviewPullRequestDiff", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.TILVAR_API_KEY;
  const originalMaxChars = process.env.TILVAR_API_MAX_CHARS;

  beforeEach(() => {
    process.env.TILVAR_API_KEY = "test-key";
    delete process.env.TILVAR_API_MAX_CHARS;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TILVAR_API_KEY;
    else process.env.TILVAR_API_KEY = originalKey;
    if (originalMaxChars === undefined) delete process.env.TILVAR_API_MAX_CHARS;
    else process.env.TILVAR_API_MAX_CHARS = originalMaxChars;
    vi.restoreAllMocks();
  });

  function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => headers[name] ?? null },
      json: async () => body,
    } as unknown as Response;
  }

  it("throws when TILVAR_API_KEY is not configured", async () => {
    delete process.env.TILVAR_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      reviewPullRequestDiff({ title: "t", body: null, diffText: "diff" })
    ).rejects.toThrow(AppError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses a successful Tilvar response into findings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { reply: JSON.stringify([validFinding()]), kind: "chat" })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await reviewPullRequestDiff({ title: "t", body: "d", diffText: "diff" });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(validFinding().title);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://tilvar.athena.org.tr/api/chat");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const sentBody = JSON.parse(init.body);
    expect(sentBody.messages).toHaveLength(1);
    expect(sentBody.messages[0].role).toBe("user");
    expect(sentBody.web).toBe(false);
    expect(sentBody.think).toBe(false);
  });

  it("parses a response wrapped in a ```json code block", async () => {
    const fenced = "```json\n" + JSON.stringify([validFinding()]) + "\n```";
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { reply: fenced, kind: "chat" })) as unknown as typeof fetch;

    const result = await reviewPullRequestDiff({ title: "t", body: null, diffText: "diff" });
    expect(result).toHaveLength(1);
  });

  it("returns an empty array (no throw) when the model reply can't be parsed", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { reply: "I don't see any problems!", kind: "chat" })) as unknown as typeof fetch;

    const result = await reviewPullRequestDiff({ title: "t", body: null, diffText: "diff" });
    expect(result).toEqual([]);
  });

  it("retries once after a 429 with Retry-After, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { detail: "rate limited" }, { "Retry-After": "0" })
      )
      .mockResolvedValueOnce(jsonResponse(200, { reply: "[]", kind: "chat" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await reviewPullRequestDiff({ title: "t", body: null, diffText: "diff" });

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws AppError if the retry after a 429 also fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { detail: "rate limited" }, { "Retry-After": "0" }))
      .mockResolvedValueOnce(jsonResponse(429, { detail: "rate limited" }, { "Retry-After": "0" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      reviewPullRequestDiff({ title: "t", body: null, diffText: "diff" })
    ).rejects.toThrow(AppError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws AppError on a non-retryable error status (e.g. 401)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { detail: "invalid key" })) as unknown as typeof fetch;

    await expect(
      reviewPullRequestDiff({ title: "t", body: null, diffText: "diff" })
    ).rejects.toThrow(AppError);
  });

  it("truncates an oversized diff to fit under TILVAR_API_MAX_CHARS", async () => {
    process.env.TILVAR_API_MAX_CHARS = "3000";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { reply: "[]", kind: "chat" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const hugeDiff = "x".repeat(10_000);
    await reviewPullRequestDiff({ title: "t", body: null, diffText: hugeDiff });

    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body);
    const content = sentBody.messages[0].content as string;
    expect(content.length).toBeLessThan(3000);
    expect(content).toContain("... (diff truncated)");
  });
});
