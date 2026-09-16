import type { GithubDiffFile } from "@/lib/types";

const MAX_TOTAL_CHARS = 60_000;
const MAX_FILE_CHARS = 6_000;

const EXCLUDED_EXACT = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "gemfile.lock",
  "poetry.lock",
  "cargo.lock",
  "go.sum",
]);

const EXCLUDED_PATH_PATTERNS = [
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
  /\.min\.(js|css)$/,
  /\.map$/,
  /(^|\/)(generated|__generated__)\//,
];

export function isExcludedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (EXCLUDED_EXACT.has(lower.split("/").pop() ?? lower)) return true;
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(lower));
}

export interface PreparedDiff {
  /** Diff text formatted for the AI prompt. Empty string if nothing reviewable remains. */
  text: string;
  includedFiles: string[];
  omittedFiles: string[];
  truncated: boolean;
}

/**
 * Filters out lockfiles/binaries/generated files, truncates oversized patches,
 * and caps the total size sent to the AI to keep API usage cheap and predictable.
 */
export function prepareDiffForReview(files: GithubDiffFile[]): PreparedDiff {
  const reviewable = files.filter((f) => f.patch && !isExcludedFile(f.filename));
  const omittedFiles = files
    .filter((f) => !f.patch || isExcludedFile(f.filename))
    .map((f) => f.filename);

  const includedFiles: string[] = [];
  const chunks: string[] = [];
  let totalChars = 0;
  let truncated = false;

  for (const file of reviewable) {
    let patch = file.patch as string;
    if (patch.length > MAX_FILE_CHARS) {
      patch = `${patch.slice(0, MAX_FILE_CHARS)}\n... (truncated, ${patch.length - MAX_FILE_CHARS} more characters)`;
      truncated = true;
    }

    const block = `--- ${file.filename} (${file.status}, +${file.additions}/-${file.deletions}) ---\n${patch}\n`;

    if (totalChars + block.length > MAX_TOTAL_CHARS) {
      truncated = true;
      omittedFiles.push(file.filename);
      continue;
    }

    chunks.push(block);
    includedFiles.push(file.filename);
    totalChars += block.length;
  }

  return { text: chunks.join("\n"), includedFiles, omittedFiles, truncated };
}
