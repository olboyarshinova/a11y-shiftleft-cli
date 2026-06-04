import fs from "node:fs/promises";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import { toMarkdown } from "../reporters/writeReports.js";
import type { A11yReport } from "../types.js";

type GitHubEnv = Record<string, string | undefined>;

export type PullRequestContext = {
  owner: string;
  repo: string;
  issue_number: number;
  token: string;
};

type CommentClient = {
  issues: {
    createComment: (payload: {
      owner: string;
      repo: string;
      issue_number: number;
      body: string;
    }) => Promise<unknown>;
  };
};

export type PostCommentOptions = {
  env?: GitHubEnv;
  reportDir?: string;
  octokit?: CommentClient;
};

export type PostCommentResult = {
  skipped: boolean;
};

export function getPullRequestContext(
  env: GitHubEnv = process.env
): PullRequestContext | null {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER } = env;

  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER) {
    return null;
  }

  const [owner, repo] = GITHUB_REPOSITORY.split("/");

  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY must use the owner/repo format.");
  }

  return {
    owner,
    repo,
    issue_number: Number(PR_NUMBER),
    token: GITHUB_TOKEN
  };
}

export async function buildCommentBody(reportDir = "reports"): Promise<string | null> {
  const markdownPath = path.join(reportDir, "a11y-comment.md");
  const jsonPath = path.join(reportDir, "a11y-report.json");

  try {
    return await fs.readFile(markdownPath, "utf8");
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }

  try {
    const report = JSON.parse(await fs.readFile(jsonPath, "utf8")) as A11yReport;
    return toMarkdown(report);
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function postA11yComment({
  env = process.env,
  reportDir = "reports",
  octokit
}: PostCommentOptions = {}): Promise<PostCommentResult> {
  const context = getPullRequestContext(env);

  if (!context) {
    console.log("Missing GitHub PR environment variables. Skipping comment.");
    return { skipped: true };
  }

  const body = await buildCommentBody(reportDir);

  if (!body) {
    console.log("No accessibility report found. Skipping comment.");
    return { skipped: true };
  }

  const client = octokit ?? new Octokit({ auth: context.token });

  await client.issues.createComment({
    owner: context.owner,
    repo: context.repo,
    issue_number: context.issue_number,
    body
  });

  return { skipped: false };
}

export async function main(): Promise<void> {
  await postA11yComment();
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}
