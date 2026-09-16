export interface GithubRepoSummary {
  id: number;
  fullName: string;
  ownerLogin: string;
  name: string;
  private: boolean;
  description: string | null;
  updatedAt: string | null;
}

export interface GithubPullRequestSummary {
  id: number;
  number: number;
  title: string;
  authorLogin: string;
  state: string;
  updatedAt: string;
  url: string;
}

export interface GithubPullRequestDetail extends GithubPullRequestSummary {
  body: string | null;
  headSha: string;
  baseSha: string;
  headRef: string;
  baseRef: string;
  createdAt: string;
}

export interface GithubDiffFile {
  filename: string;
  previousFilename?: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export type Severity = "critical" | "high" | "medium" | "low";
export type FindingCategory = "bug" | "security" | "performance" | "code_quality" | "missing_tests";

export interface FindingView {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "BUG" | "SECURITY" | "PERFORMANCE" | "CODE_QUALITY" | "MISSING_TESTS";
  file: string;
  line: number | null;
  title: string;
  description: string;
  why: string;
  suggestion: string;
}

export interface ReviewView {
  id: string;
  summary: string | null;
  createdAt: string;
  findings: FindingView[];
}

export interface ReviewFinding {
  severity: Severity;
  category: FindingCategory;
  file: string;
  line: number | null;
  title: string;
  description: string;
  why: string;
  suggestion: string;
}
