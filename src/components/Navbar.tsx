import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/AuthButtons";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={session ? "/dashboard" : "/"} className="text-base font-semibold tracking-tight">
          Calytrix
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {session?.user && (
            <div className="flex items-center gap-3">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "avatar"}
                  className="h-7 w-7 rounded-full"
                />
              )}
              <span className="hidden text-sm text-muted sm:inline">{session.user.name}</span>
              <SignOutButton />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
