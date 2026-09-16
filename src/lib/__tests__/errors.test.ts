import { describe, expect, it } from "vitest";
import { AppError, toAppError } from "@/lib/errors";

describe("toAppError", () => {
  it("passes AppError instances through unchanged", () => {
    const original = new AppError("DIFF_EMPTY");
    expect(toAppError(original)).toBe(original);
  });

  it("maps a 404 GitHub response to GITHUB_NOT_FOUND", () => {
    const error = toAppError({ status: 404 });
    expect(error.code).toBe("GITHUB_NOT_FOUND");
    expect(error.status).toBe(404);
  });

  it("maps a 401 to GITHUB_AUTH_ERROR", () => {
    const error = toAppError({ status: 401 });
    expect(error.code).toBe("GITHUB_AUTH_ERROR");
  });

  it("maps a rate-limited 403 to GITHUB_RATE_LIMIT", () => {
    const error = toAppError({
      status: 403,
      response: { headers: { "x-ratelimit-remaining": "0" } },
    });
    expect(error.code).toBe("GITHUB_RATE_LIMIT");
  });

  it("maps a non-rate-limit 403 to GITHUB_AUTH_ERROR", () => {
    const error = toAppError({ status: 403, response: { headers: {} } });
    expect(error.code).toBe("GITHUB_AUTH_ERROR");
  });

  it("falls back to the provided default code for unknown errors", () => {
    const error = toAppError(new Error("boom"), "CLAUDE_API_ERROR");
    expect(error.code).toBe("CLAUDE_API_ERROR");
  });

  it("never leaks the original error message to the user-facing message", () => {
    const error = toAppError(new Error("raw internal secret detail"));
    expect(error.message).not.toContain("raw internal secret detail");
  });
});
