import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ATHENA_COOKIE_NAME, athenaLoginUrl, calytrixOrigin } from "@/lib/athena";

/**
 * Cheap, Edge-safe pre-check: bounce straight to Athena sign-in when the
 * shared `tv` cookie is entirely absent, so a fully signed-out visitor never
 * reaches the dashboard render. This is only an optimization — it does not
 * validate the cookie (that needs a network call to Athena's `/api/me` and
 * lives in src/lib/session.ts, called from the page itself), so a stale or
 * forged cookie still gets caught, just one render later.
 */
export function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  const hasAthenaCookie = request.cookies.has(ATHENA_COOKIE_NAME);

  if (pathname.startsWith("/dashboard") && !hasAthenaCookie) {
    return NextResponse.redirect(athenaLoginUrl(`${calytrixOrigin(origin)}${pathname}`));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
