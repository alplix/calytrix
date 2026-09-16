import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { GithubPullRequestSummary } from "@/lib/types";
import { timeAgo } from "@/lib/format";

const STATE_COLOR: Record<string, string> = {
  open: "text-low",
  merged: "text-accent",
  closed: "text-critical",
};

export function PullRequestCard({
  pr,
  owner,
  repo,
}: {
  pr: GithubPullRequestSummary;
  owner: string;
  repo: string;
}) {
  const locale = useLocale();
  const t = useTranslations("Repo");
  const tState = useTranslations("State");

  return (
    <Link
      href={`/dashboard/${owner}/${repo}/pull/${pr.number}`}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-foreground">
          #{pr.number} {pr.title}
        </span>
        <span className={`shrink-0 text-xs font-medium uppercase ${STATE_COLOR[pr.state] ?? "text-muted"}`}>
          {tState.has(pr.state) ? tState(pr.state) : pr.state}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {t("updatedBy", { author: pr.authorLogin, time: timeAgo(pr.updatedAt, locale) })}
      </p>
    </Link>
  );
}
