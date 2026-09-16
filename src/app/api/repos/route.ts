import { NextResponse } from "next/server";
import { requireAuth, errorResponse } from "@/lib/api-helpers";
import { listUserRepos } from "@/lib/github";

export async function GET() {
  try {
    const { accessToken } = await requireAuth();
    const repos = await listUserRepos(accessToken);
    return NextResponse.json({ repos });
  } catch (error) {
    return errorResponse(error);
  }
}
