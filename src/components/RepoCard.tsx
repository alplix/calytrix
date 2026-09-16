import Link from "next/link";
import { useTranslations } from "next-intl";
import type { GithubRepoSummary } from "@/lib/types";

export function RepoCard({ repo }: { repo: GithubRepoSummary }) {
  const t = useTranslations("Dashboard");
  return (
    <Link
      href={`/dashboard/${repo.ownerLogin}/${repo.name}`}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-foreground">{repo.fullName}</span>
        {repo.private && (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted">
            {t("private")}
          </span>
        )}
      </div>
      {repo.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{repo.description}</p>
      )}
    </Link>
  );
}
