import { prisma } from "@/lib/prisma";
import { getPullRequest, getPullRequestFiles, getRepo } from "@/lib/github";
import { prepareDiffForReview } from "@/lib/diff-filter";
import { reviewPullRequestDiff } from "@/lib/tilvar";
import { AppError } from "@/lib/errors";
import { Prisma, type FindingCategory, type Severity } from "@prisma/client";

async function upsertRepository(repo: Awaited<ReturnType<typeof getRepo>>) {
  return prisma.repository.upsert({
    where: { githubId: BigInt(repo.id) },
    update: { fullName: repo.fullName, isPrivate: repo.private },
    create: {
      githubId: BigInt(repo.id),
      fullName: repo.fullName,
      ownerLogin: repo.ownerLogin,
      name: repo.name,
      isPrivate: repo.private,
    },
  });
}

async function upsertPullRequest(
  repositoryId: string,
  pr: Awaited<ReturnType<typeof getPullRequest>>
) {
  return prisma.pullRequest.upsert({
    where: { githubId: BigInt(pr.id) },
    update: {
      title: pr.title,
      headSha: pr.headSha,
      baseSha: pr.baseSha,
      updatedAt: new Date(),
    },
    create: {
      githubId: BigInt(pr.id),
      number: pr.number,
      title: pr.title,
      authorLogin: pr.authorLogin,
      headSha: pr.headSha,
      baseSha: pr.baseSha,
      headRef: pr.headRef,
      baseRef: pr.baseRef,
      url: pr.url,
      repositoryId,
    },
  });
}

export interface GetOrCreateReviewParams {
  accessToken: string;
  userId: number;
  owner: string;
  repo: string;
  number: number;
  /** Force a fresh AI review even if a cached one exists for the current head SHA. */
  force?: boolean;
}

const reviewWithFindings = {
  include: { findings: { orderBy: { createdAt: "asc" } } },
} satisfies Prisma.ReviewDefaultArgs;

export type ReviewWithFindings = Prisma.ReviewGetPayload<typeof reviewWithFindings>;

export async function getOrCreateReview({
  accessToken,
  userId,
  owner,
  repo,
  number,
  force = false,
}: GetOrCreateReviewParams): Promise<ReviewWithFindings> {
  const [repoInfo, pr] = await Promise.all([
    getRepo(accessToken, owner, repo),
    getPullRequest(accessToken, owner, repo, number),
  ]);

  const repository = await upsertRepository(repoInfo);
  const pullRequest = await upsertPullRequest(repository.id, pr);

  if (!force) {
    const cached = await prisma.review.findFirst({
      where: { pullRequestId: pullRequest.id, headSha: pr.headSha, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      ...reviewWithFindings,
    });
    if (cached) return cached;
  }

  const files = await getPullRequestFiles(accessToken, owner, repo, number);
  if (files.length === 0) {
    throw new AppError("DIFF_EMPTY");
  }

  const diff = prepareDiffForReview(files);

  if (diff.text.length === 0) {
    return prisma.review.create({
      data: {
        headSha: pr.headSha,
        status: "COMPLETED",
        summary: "No reviewable problem found. Only lockfiles, generated, or binary files changed.",
        pullRequestId: pullRequest.id,
        requestedById: userId,
      },
      ...reviewWithFindings,
    });
  }

  const findings = await reviewPullRequestDiff({
    title: pr.title,
    body: pr.body,
    diffText: diff.text,
  });

  const summary =
    findings.length === 0
      ? "No significant problems were found in this pull request."
      : `${findings.length} issue${findings.length === 1 ? "" : "s"} found.`;

  return prisma.review.create({
    data: {
      headSha: pr.headSha,
      status: "COMPLETED",
      summary,
      pullRequestId: pullRequest.id,
      requestedById: userId,
      findings: {
        create: findings.map((f) => ({
          severity: f.severity.toUpperCase() as Severity,
          category: f.category.toUpperCase() as FindingCategory,
          file: f.file,
          line: f.line,
          title: f.title,
          description: f.description,
          why: f.why,
          suggestion: f.suggestion,
        })),
      },
    },
    ...reviewWithFindings,
  });
}

export async function getLatestReviewForPullRequest(
  owner: string,
  repo: string,
  number: number
): Promise<ReviewWithFindings | null> {
  return prisma.review.findFirst({
    where: {
      status: "COMPLETED",
      pullRequest: { number, repository: { fullName: `${owner}/${repo}` } },
    },
    orderBy: { createdAt: "desc" },
    ...reviewWithFindings,
  });
}
