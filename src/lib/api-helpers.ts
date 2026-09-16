import { NextResponse } from "next/server";
import { auth, getGithubAccessToken } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export async function requireAuth(): Promise<{ userId: string; accessToken: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new AppError("UNAUTHORIZED");

  const accessToken = await getGithubAccessToken(session.user.id);
  if (!accessToken) throw new AppError("GITHUB_AUTH_ERROR");

  return { userId: session.user.id, accessToken };
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  // Unknown errors are logged server-side only; the client never sees stack traces.
  console.error(error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again.", code: "UNKNOWN" },
    { status: 500 }
  );
}
