import { NextResponse } from "next/server";
import { getAthenaUser, getGithubConnection } from "@/lib/session";
import { AppError } from "@/lib/errors";

export async function requireAuth(): Promise<{ userId: number; accessToken: string }> {
  const athenaUser = await getAthenaUser();
  if (!athenaUser) throw new AppError("UNAUTHORIZED");

  const connection = await getGithubConnection(athenaUser.id);
  if (!connection) throw new AppError("GITHUB_AUTH_ERROR");

  return { userId: athenaUser.id, accessToken: connection.accessToken };
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
