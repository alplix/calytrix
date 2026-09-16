import { Octokit } from "octokit";
import { toAppError } from "@/lib/errors";
import type {
  GithubDiffFile,
  GithubPullRequestDetail,
  GithubPullRequestSummary,
  GithubRepoSummary,
} from "@/lib/types";

export function createOctokit(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export async function listUserRepos(accessToken: string): Promise<GithubRepoSummary[]> {
  const octokit = createOctokit(accessToken);
  try {
    const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      per_page: 100,
      sort: "updated",
      affiliation: "owner,collaborator,organization_member",
    });
    return repos.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      ownerLogin: r.owner.login,
      name: r.name,
      private: r.private,
      description: r.description,
      updatedAt: r.updated_at ?? null,
    }));
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getRepo(
  accessToken: string,
  owner: string,
  repo: string
): Promise<GithubRepoSummary> {
  const octokit = createOctokit(accessToken);
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo });
    return {
      id: data.id,
      fullName: data.full_name,
      ownerLogin: data.owner.login,
      name: data.name,
      private: data.private,
      description: data.description,
      updatedAt: data.updated_at ?? null,
    };
  } catch (error) {
    throw toAppError(error);
  }
}

export async function listPullRequests(
  accessToken: string,
  owner: string,
  repo: string
): Promise<GithubPullRequestSummary[]> {
  const octokit = createOctokit(accessToken);
  try {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 30,
    });
    return data.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      authorLogin: pr.user?.login ?? "unknown",
      state: pr.merged_at ? "merged" : pr.state,
      updatedAt: pr.updated_at,
      url: pr.html_url,
    }));
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getPullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  number: number
): Promise<GithubPullRequestDetail> {
  const octokit = createOctokit(accessToken);
  try {
    const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      authorLogin: pr.user?.login ?? "unknown",
      state: pr.merged_at ? "merged" : pr.state,
      updatedAt: pr.updated_at,
      createdAt: pr.created_at,
      url: pr.html_url,
      headSha: pr.head.sha,
      baseSha: pr.base.sha,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
    };
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getPullRequestFiles(
  accessToken: string,
  owner: string,
  repo: string,
  number: number
): Promise<GithubDiffFile[]> {
  const octokit = createOctokit(accessToken);
  try {
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: number,
      per_page: 100,
    });
    return files.map((f) => ({
      filename: f.filename,
      previousFilename: f.previous_filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
    }));
  } catch (error) {
    throw toAppError(error);
  }
}
