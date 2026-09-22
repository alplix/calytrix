import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveDashboardAccess, athenaLoginUrlForPath } from "@/lib/session";
import { listUserRepos } from "@/lib/github";
import { RepoCard } from "@/components/RepoCard";
import { ErrorPanel } from "@/components/ErrorPanel";
import { ConnectGithubPanel } from "@/components/ConnectGithubPanel";
import { AppError, type ErrorCode } from "@/lib/errors";
import type { GithubRepoSummary } from "@/lib/types";

async function loadRepos(
  accessToken: string
): Promise<{ repos: GithubRepoSummary[] } | { errorCode: ErrorCode | "UNKNOWN" }> {
  try {
    return { repos: await listUserRepos(accessToken) };
  } catch (error) {
    const code = error instanceof AppError ? error.code : "UNKNOWN";
    return { errorCode: code };
  }
}

export default async function DashboardPage() {
  const access = await resolveDashboardAccess();

  if (access.status === "signed-out") {
    redirect(await athenaLoginUrlForPath("/dashboard"));
  }
  if (access.status === "github-not-connected") {
    return <ConnectGithubPanel />;
  }

  const result = await loadRepos(access.accessToken);
  if ("errorCode" in result) {
    return <ErrorPanel code={result.errorCode} />;
  }
  const { repos } = result;
  const t = await getTranslations("Dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

      {repos.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}
