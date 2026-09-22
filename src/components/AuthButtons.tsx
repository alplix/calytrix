import { getTranslations } from "next-intl/server";
import { ATHENA_BASE_URL } from "@/lib/athena";

const DEFAULT_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover";

/** Sends the visitor to Athena's shared sign-in page (`href` should already carry a `next` return URL). */
export async function AthenaSignInButton({ href, className }: { href: string; className?: string }) {
  const t = await getTranslations("Landing");
  return (
    <a href={href} className={className ?? DEFAULT_BUTTON_CLASS}>
      {t("signInAthena")}
    </a>
  );
}

/** Starts the (separate, optional) real GitHub OAuth authorization for repo access. */
export async function ConnectGithubButton({ className }: { className?: string }) {
  const t = await getTranslations("Landing");
  return (
    <a href="/api/auth/github/connect" className={className ?? DEFAULT_BUTTON_CLASS}>
      <GitHubMark className="h-4 w-4" />
      {t("connectGithub")}
    </a>
  );
}

/** Link to Athena's own site, where the visitor's SSO session actually lives and can be managed. */
export async function AthenaAccountLink() {
  const t = await getTranslations("Nav");
  return (
    <a
      href={ATHENA_BASE_URL}
      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground"
    >
      {t("signOut")}
    </a>
  );
}

export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .3.2.66.79.55A10.52 10.52 0 0 0 23.5 12c0-6.27-5.23-11.5-11.5-11.5Z" />
    </svg>
  );
}
