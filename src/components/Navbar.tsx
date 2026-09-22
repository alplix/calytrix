import Link from "next/link";
import { resolveDashboardAccess } from "@/lib/session";
import { AthenaAccountLink } from "@/components/AuthButtons";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export async function Navbar() {
  const access = await resolveDashboardAccess();
  const isSignedIn = access.status !== "signed-out";

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={isSignedIn ? "/dashboard" : "/"} className="text-base font-semibold tracking-tight">
          Calytrix
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {isSignedIn && (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted sm:inline">
                {access.athenaUser.username}
                {access.status === "ready" && (
                  <span className="text-muted/70"> · {access.githubLogin}</span>
                )}
              </span>
              <AthenaAccountLink />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
