import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveDashboardAccess, athenaLoginUrlForPath } from "@/lib/session";
import { listPullRequests } from "@/lib/github";
import { PullRequestCard } from "@/components/PullRequestCard";
import { ErrorPanel } from "@/components/ErrorPanel";
import { ConnectGithubPanel } from "@/components/ConnectGithubPanel";
import { AppError, type ErrorCode } from "@/lib/errors";
import type { GithubPullRequestSummary } from "@/lib/types";

async function loadPulls(
  accessToken: string,
  owner: string,
  repo: string
): Promise<{ pulls: GithubPullRequestSummary[] } | { errorCode: ErrorCode | "UNKNOWN" }> {
  try {
    return { pulls: await listPullRequests(accessToken, owner, repo) };
  } catch (error) {
    const code = error instanceof AppError ? error.code : "UNKNOWN";
    return { errorCode: code };
  }
}

export default async function RepoPullsPage({
  params,
}: PageProps<"/dashboard/[owner]/[repo]">) {
  const { owner, repo } = await params;
  const access = await resolveDashboardAccess();

  if (access.status === "signed-out") {
    redirect(await athenaLoginUrlForPath(`/dashboard/${owner}/${repo}`));
  }
  if (access.status === "github-not-connected") {
    return <ConnectGithubPanel />;
  }

  const result = await loadPulls(access.accessToken, owner, repo);
  if ("errorCode" in result) {
    return <ErrorPanel code={result.errorCode} />;
  }
  const { pulls } = result;
  const t = await getTranslations("Repo");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/dashboard" className="text-xs text-muted hover:text-foreground">
        ← {t("back")}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-foreground">
        {owner}/{repo}
      </h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

      {pulls.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {pulls.map((pr) => (
            <PullRequestCard key={pr.id} pr={pr} owner={owner} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}
