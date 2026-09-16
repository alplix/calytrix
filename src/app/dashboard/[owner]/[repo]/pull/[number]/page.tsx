import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth, getGithubAccessToken } from "@/lib/auth";
import { getPullRequest } from "@/lib/github";
import { getLatestReviewForPullRequest, type ReviewWithFindings } from "@/lib/review";
import { ReviewPanel } from "@/components/ReviewPanel";
import { ErrorPanel } from "@/components/ErrorPanel";
import { AppError, type ErrorCode } from "@/lib/errors";
import type { GithubPullRequestDetail } from "@/lib/types";

interface LoadedPull {
  pr: GithubPullRequestDetail;
  review: ReviewWithFindings | null;
}

async function loadPullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  number: number
): Promise<LoadedPull | { errorCode: ErrorCode | "UNKNOWN" }> {
  try {
    const [pr, review] = await Promise.all([
      getPullRequest(accessToken, owner, repo, number),
      getLatestReviewForPullRequest(owner, repo, number),
    ]);
    return { pr, review };
  } catch (error) {
    const code = error instanceof AppError ? error.code : "UNKNOWN";
    return { errorCode: code };
  }
}

export default async function PullRequestPage({
  params,
}: PageProps<"/dashboard/[owner]/[repo]/pull/[number]">) {
  const { owner, repo, number } = await params;
  const pullNumber = Number(number);

  const session = await auth();
  const accessToken = session?.user?.id ? await getGithubAccessToken(session.user.id) : null;

  if (!accessToken) {
    return <ErrorPanel code="GITHUB_AUTH_ERROR" />;
  }

  const result = await loadPullRequest(accessToken, owner, repo, pullNumber);
  if ("errorCode" in result) {
    return <ErrorPanel code={result.errorCode} />;
  }
  const { pr, review } = result;
  const t = await getTranslations("Pull");

  const isStale = review !== null && review.headSha !== pr.headSha;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/dashboard/${owner}/${repo}`} className="text-xs text-muted hover:text-foreground">
        ← {t("back")}
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-foreground">
        #{pr.number} {pr.title}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {t.rich("mergeInfo", {
          author: pr.authorLogin,
          baseRef: pr.baseRef,
          headRef: pr.headRef,
          base: (chunks) => <span className="font-mono text-foreground/80">{chunks}</span>,
          head: (chunks) => <span className="font-mono text-foreground/80">{chunks}</span>,
        })}
      </p>
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-xs text-accent hover:underline"
      >
        {t("viewOnGithub")} ↗
      </a>

      {isStale && (
        <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-xs text-medium">
          {t("staleNotice")}
        </p>
      )}

      <ReviewPanel
        owner={owner}
        repo={repo}
        number={pullNumber}
        initialReview={
          isStale || !review
            ? null
            : {
                id: review.id,
                summary: review.summary,
                createdAt: review.createdAt.toISOString(),
                findings: review.findings,
              }
        }
      />
    </div>
  );
}
