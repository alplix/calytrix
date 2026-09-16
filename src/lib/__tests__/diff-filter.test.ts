import { describe, expect, it } from "vitest";
import { isExcludedFile, prepareDiffForReview } from "@/lib/diff-filter";
import type { GithubDiffFile } from "@/lib/types";

describe("isExcludedFile", () => {
  it("excludes known lockfiles", () => {
    expect(isExcludedFile("package-lock.json")).toBe(true);
    expect(isExcludedFile("frontend/yarn.lock")).toBe(true);
    expect(isExcludedFile("Cargo.lock")).toBe(true);
  });

  it("excludes generated/minified/vendor paths", () => {
    expect(isExcludedFile("dist/bundle.js")).toBe(true);
    expect(isExcludedFile("public/app.min.js")).toBe(true);
    expect(isExcludedFile("vendor/lib.rb")).toBe(true);
    expect(isExcludedFile("assets/app.js.map")).toBe(true);
  });

  it("does not exclude regular source files", () => {
    expect(isExcludedFile("src/lib/github.ts")).toBe(false);
    expect(isExcludedFile("app/page.tsx")).toBe(false);
  });
});

function makeFile(overrides: Partial<GithubDiffFile>): GithubDiffFile {
  return {
    filename: "src/index.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: "@@ -1 +1 @@\n-old\n+new",
    ...overrides,
  };
}

describe("prepareDiffForReview", () => {
  it("drops lockfiles and files without a patch (binary/renamed)", () => {
    const files = [
      makeFile({ filename: "src/a.ts" }),
      makeFile({ filename: "package-lock.json", patch: "huge lockfile diff" }),
      makeFile({ filename: "image.png", patch: undefined }),
    ];

    const result = prepareDiffForReview(files);

    expect(result.includedFiles).toEqual(["src/a.ts"]);
    expect(result.omittedFiles).toEqual(["package-lock.json", "image.png"]);
    expect(result.text).toContain("src/a.ts");
  });

  it("returns empty text when everything is filtered out", () => {
    const files = [makeFile({ filename: "package-lock.json" })];
    const result = prepareDiffForReview(files);
    expect(result.text).toBe("");
    expect(result.includedFiles).toEqual([]);
  });

  it("truncates a single oversized patch instead of dropping the whole file", () => {
    const files = [makeFile({ filename: "big.ts", patch: "x".repeat(10_000) })];
    const result = prepareDiffForReview(files);
    expect(result.includedFiles).toEqual(["big.ts"]);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThan(10_000);
  });

  it("stops including files once the total size budget is exceeded", () => {
    const files = Array.from({ length: 20 }, (_, i) =>
      makeFile({ filename: `file-${i}.ts`, patch: "y".repeat(5_000) })
    );
    const result = prepareDiffForReview(files);
    expect(result.truncated).toBe(true);
    expect(result.includedFiles.length).toBeLessThan(files.length);
    expect(result.omittedFiles.length).toBeGreaterThan(0);
  });
});
