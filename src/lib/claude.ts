import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { ReviewFinding } from "@/lib/types";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a senior software engineer performing a pull request code review.
Review ONLY the provided diff. Report real, meaningful problems in these categories:
bug, security, performance, code_quality, missing_tests.

Rules:
- Only report issues you are reasonably confident about. If you are speculating, say so in "why" instead of stating it as fact.
- Do not report minor style preferences (formatting, naming taste) unless they meaningfully hurt readability or correctness.
- Do not invent line numbers; only set "line" when you can point to a specific changed line, otherwise use null.
- If there are no meaningful problems, call the tool with an empty findings array.
- Be concise: 1-3 sentences per field.`;

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

const FINDINGS_TOOL: Anthropic.Tool = {
  name: "report_findings",
  description: "Report the structured code review findings for this pull request diff.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            category: {
              type: "string",
              enum: ["bug", "security", "performance", "code_quality", "missing_tests"],
            },
            file: { type: "string", description: "Path of the file the issue is in" },
            line: {
              type: ["number", "null"],
              description: "Line number in the new file version, or null if not applicable",
            },
            title: { type: "string", description: "Short title of the issue" },
            description: { type: "string", description: "What the problem is" },
            why: { type: "string", description: "Why this is a problem" },
            suggestion: { type: "string", description: "Suggested fix" },
          },
          required: ["severity", "category", "file", "title", "description", "why", "suggestion"],
        },
      },
    },
    required: ["findings"],
  },
};

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

export async function reviewPullRequestDiff(input: ReviewInput): Promise<ReviewFinding[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError("CLAUDE_API_ERROR", "ANTHROPIC_API_KEY is not configured.");

  const anthropic = new Anthropic({ apiKey });

  const userPrompt = `Pull request title: ${input.title}
Description: ${input.body?.slice(0, 1000) || "(none)"}

Diff:
${input.diffText}`;

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [FINDINGS_TOOL],
      tool_choice: { type: "tool", name: "report_findings" },
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch {
    throw new AppError("CLAUDE_API_ERROR");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new AppError("CLAUDE_INVALID_RESPONSE");

  const input_ = toolUse.input as { findings?: unknown };
  return parseFindings(input_.findings);
}
