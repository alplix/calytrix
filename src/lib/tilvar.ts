import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { ReviewFinding } from "@/lib/types";

const TILVAR_API_URL = "https://tilvar.athena.org.tr/api/chat";
const DEFAULT_MAX_CHARS = 40_000;
// Headroom reserved below TILVAR_API_MAX_CHARS for the prompt instructions, the
// JSON schema example, and the PR title/description that surround the diff —
// so the fully-assembled request stays under Tilvar's limit and never gets a 413.
const PROMPT_OVERHEAD_MARGIN = 2_000;

const SYSTEM_INSTRUCTIONS = `You are a senior software engineer performing a pull request code review.
Review ONLY the provided diff. Report real, meaningful problems in these categories:
bug, security, performance, code_quality, missing_tests.

Rules:
- Only report issues you are reasonably confident about. If you are speculating, say so in "why" instead of stating it as fact.
- Do not report minor style preferences (formatting, naming taste) unless they meaningfully hurt readability or correctness.
- Do not invent line numbers; only set "line" when you can point to a specific changed line, otherwise use null.
- If there are no meaningful problems, return an empty array.
- Be concise: 1-3 sentences per field.

RESPONSE FORMAT — READ CAREFULLY:
Reply with ONLY a JSON array matching the schema below, and nothing else. Do NOT add any
explanation, preamble, or commentary. Do NOT use a markdown code block (no \`\`\`). Your entire
reply must be valid JSON, starting with "[" and ending with "]".

Each item in the array must match this example exactly in shape:
{
  "severity": "high",
  "category": "security",
  "file": "src/api/user.ts",
  "line": 42,
  "title": "Unvalidated user input",
  "description": "User input reaches the query unchecked.",
  "why": "This allows injection attacks.",
  "suggestion": "Validate and parameterize the query."
}

Field rules:
- "severity": one of "critical", "high", "medium", "low"
- "category": one of "bug", "security", "performance", "code_quality", "missing_tests"
- "file": path of the file the issue is in
- "line": line number in the new file version, or null if not applicable
- "title", "description", "why", "suggestion": short strings, 1-3 sentences each

If there are no meaningful problems, reply with exactly: []`;

const FindingSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum(["bug", "security", "performance", "code_quality", "missing_tests"]),
  file: z.string().min(1),
  line: z.number().int().positive().nullable().default(null),
  title: z.string().min(1),
  description: z.string().min(1),
  why: z.string().min(1),
  suggestion: z.string().min(1),
});

const FindingsArraySchema = z.array(FindingSchema);

/**
 * Parses raw findings defensively: a single malformed item from the model
 * should not discard the whole review.
 */
export function parseFindings(rawFindings: unknown): ReviewFinding[] {
  if (!Array.isArray(rawFindings)) {
    throw new AppError("CLAUDE_INVALID_RESPONSE");
  }

  const wholeArrayResult = FindingsArraySchema.safeParse(rawFindings);
  if (wholeArrayResult.success) return wholeArrayResult.data;

  const valid: ReviewFinding[] = [];
  for (const item of rawFindings) {
    const result = FindingSchema.safeParse(item);
    if (result.success) valid.push(result.data);
  }
  return valid;
}

export interface ReviewInput {
  title: string;
  body: string | null;
  diffText: string;
}

/**
 * Tilvar has no native structured-output / tool-calling on this endpoint — the JSON
 * schema is enforced purely through prompt instructions, and a small model won't
 * always follow "no markdown, no prose" as strictly as Claude does. This strips the
 * common ways a reply deviates from a bare JSON array before parsing:
 *   1. A ```json fenced block (or a bare ``` fenced block).
 *   2. Leading/trailing prose around the outermost "[" ... "]" pair.
 * Anything that still doesn't parse as a JSON array falls back to an empty array
 * rather than throwing — the UI already has a "no significant problems found"
 * state for zero findings, so that's a safe default here.
 */
export function extractFindingsArray(replyText: string): unknown[] {
  let text = replyText.trim();

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    text = fencedMatch[1].trim();
  }

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getMaxChars(): number {
  const raw = process.env.TILVAR_API_MAX_CHARS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHARS;
}

/** Builds the single user-message prompt, truncating the diff to fit under TILVAR_API_MAX_CHARS. */
function buildPrompt(input: ReviewInput): string {
  const header = `${SYSTEM_INSTRUCTIONS}

Pull request title: ${input.title}
Description: ${input.body?.slice(0, 1000) || "(none)"}

Diff:
`;

  const maxChars = getMaxChars();
  const budget = maxChars - header.length - PROMPT_OVERHEAD_MARGIN;

  const safeBudget = Math.max(0, budget);
  let diffText = input.diffText;
  if (diffText.length > safeBudget) {
    diffText = `${diffText.slice(0, safeBudget)}\n... (diff truncated)`;
  }

  return `${header}${diffText}`;
}

interface TilvarChatResponse {
  reply: string;
  kind: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callTilvar(
  apiKey: string,
  prompt: string,
  isRetry = false
): Promise<TilvarChatResponse> {
  let response: Response;
  try {
    response = await fetch(TILVAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        web: false,
        think: false,
      }),
    });
  } catch {
    throw new AppError("TILVAR_API_ERROR");
  }

  if (response.ok) {
    try {
      return (await response.json()) as TilvarChatResponse;
    } catch {
      throw new AppError("TILVAR_API_ERROR");
    }
  }

  // Retry once on rate limit / daily limit, honoring Retry-After (seconds).
  if (response.status === 429 && !isRetry) {
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : 0;
    await sleep(Math.max(0, retryAfterSeconds || 0) * 1000);
    return callTilvar(apiKey, prompt, true);
  }

  throw new AppError("TILVAR_API_ERROR");
}

export async function reviewPullRequestDiff(input: ReviewInput): Promise<ReviewFinding[]> {
  const apiKey = process.env.TILVAR_API_KEY;
  if (!apiKey) throw new AppError("TILVAR_API_ERROR", "TILVAR_API_KEY is not configured.");

  const prompt = buildPrompt(input);
  const result = await callTilvar(apiKey, prompt);

  const rawFindings = extractFindingsArray(result?.reply ?? "");
  return parseFindings(rawFindings);
}
