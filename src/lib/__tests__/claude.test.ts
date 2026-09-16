import { describe, expect, it } from "vitest";
import { parseFindings } from "@/lib/claude";
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
