import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, errorResponse } from "@/lib/api-helpers";
import { getOrCreateReview } from "@/lib/review";
import { AppError } from "@/lib/errors";

const BodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { userId, accessToken } = await requireAuth();

    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR");

    const review = await getOrCreateReview({
      accessToken,
      userId,
      owner: parsed.data.owner,
      repo: parsed.data.repo,
      number: parsed.data.number,
      force: parsed.data.force,
    });

    return NextResponse.json({ review });
  } catch (error) {
    return errorResponse(error);
  }
}
