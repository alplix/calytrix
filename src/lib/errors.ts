export type ErrorCode =
  | "UNAUTHORIZED"
  | "GITHUB_AUTH_ERROR"
  | "GITHUB_RATE_LIMIT"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_API_ERROR"
  | "TILVAR_API_ERROR"
  | "CLAUDE_INVALID_RESPONSE"
  | "DIFF_TOO_LARGE"
  | "DIFF_EMPTY"
  | "DB_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND";

const USER_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "You need to sign in to do that.",
  GITHUB_AUTH_ERROR: "Your GitHub connection is no longer valid. Please sign in again.",
  GITHUB_RATE_LIMIT: "GitHub API rate limit reached. Please try again in a few minutes.",
  GITHUB_NOT_FOUND: "The requested repository or pull request could not be found.",
  GITHUB_API_ERROR: "Couldn't reach GitHub. Please try again.",
  TILVAR_API_ERROR: "The AI review service is unavailable right now. Please try again.",
  CLAUDE_INVALID_RESPONSE: "The AI review did not return a valid result. Please try again.",
  DIFF_TOO_LARGE: "This pull request is too large to review.",
  DIFF_EMPTY: "No reviewable code changes were found in this pull request.",
  DB_ERROR: "Couldn't reach the database. Please try again.",
  VALIDATION_ERROR: "Invalid request.",
  NOT_FOUND: "Not found.",
};

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  GITHUB_AUTH_ERROR: 401,
  GITHUB_RATE_LIMIT: 429,
  GITHUB_NOT_FOUND: 404,
  GITHUB_API_ERROR: 502,
  TILVAR_API_ERROR: 502,
  CLAUDE_INVALID_RESPONSE: 502,
  DIFF_TOO_LARGE: 413,
  DIFF_EMPTY: 422,
  DB_ERROR: 500,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
};

/** Application-level error with a safe, user-facing message. Never leaks stack traces to clients. */
export class AppError extends Error {
  code: ErrorCode;
  status: number;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? USER_MESSAGES[code]);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.name = "AppError";
  }
}

export function toAppError(error: unknown, fallback: ErrorCode = "GITHUB_API_ERROR"): AppError {
  if (error instanceof AppError) return error;
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      const remaining = (error as { response?: { headers?: Record<string, string> } }).response
        ?.headers?.["x-ratelimit-remaining"];
      if (remaining === "0") return new AppError("GITHUB_RATE_LIMIT");
      return new AppError("GITHUB_AUTH_ERROR");
    }
    if (status === 404) return new AppError("GITHUB_NOT_FOUND");
  }
  return new AppError(fallback);
}
