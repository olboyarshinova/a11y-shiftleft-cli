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
    listComments?: (payload: {
      owner: string;
      repo: string;
      issue_number: number;
      per_page?: number;
    }) => Promise<{
      data: Array<{
        id: number;
        body?: string | null;
      }>;
    }>;
    updateComment?: (payload: {
      owner: string;
      repo: string;
      comment_id: number;
      body: string;
    }) => Promise<unknown>;
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
  includeLabels?: boolean;
};

export type PostCommentResult = {
  skipped: boolean;
};

const COMMENT_MARKER = "<!-- a11y-shiftleft-report -->";

export type PrLabelSuggestion = {
  label: string;
  reason: string;
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

export async function buildCommentBody(
  reportDir = "reports",
  options: { includeLabels?: boolean } = {}
): Promise<string | null> {
  const markdownPath = path.join(reportDir, "a11y-comment.md");
  const jsonPath = path.join(reportDir, "a11y-report.json");
  let jsonReport: A11yReport | null = null;

  try {
    const markdown = await fs.readFile(markdownPath, "utf8");
    if (!options.includeLabels) return markdown;

    jsonReport = await readJsonReport(jsonPath);
    return withSuggestedLabels(markdown, jsonReport);
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }

  try {
    jsonReport = JSON.parse(await fs.readFile(jsonPath, "utf8")) as A11yReport;
    return withSuggestedLabels(toMarkdown(jsonReport), options.includeLabels ? jsonReport : null);
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function postA11yComment({
  env = process.env,
  reportDir = "reports",
  octokit,
  includeLabels = false
}: PostCommentOptions = {}): Promise<PostCommentResult> {
  const context = getPullRequestContext(env);

  if (!context) {
    console.log("Missing GitHub PR environment variables. Skipping comment.");
    return { skipped: true };
  }

  const body = await buildCommentBody(reportDir, { includeLabels });

  if (!body) {
    console.log("No accessibility report found. Skipping comment.");
    return { skipped: true };
  }

  const client = octokit ?? new Octokit({ auth: context.token });
  const markedBody = withCommentMarker(withArtifactRunLink(body, env));

  try {
    const existingComment = await findExistingComment(client, context);

    if (existingComment && client.issues.updateComment) {
      await client.issues.updateComment({
        owner: context.owner,
        repo: context.repo,
        comment_id: existingComment.id,
        body: markedBody
      });

      return { skipped: false };
    }

    await client.issues.createComment({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.issue_number,
      body: markedBody
    });

    return { skipped: false };
  } catch (error) {
    if (isGitHubCommentPermissionError(error)) {
      console.log("GitHub token cannot write PR comments for this run. Skipping accessibility comment.");
      return { skipped: true };
    }

    throw error;
  }
}

export async function readJsonReport(jsonPath: string): Promise<A11yReport | null> {
  try {
    return JSON.parse(await fs.readFile(jsonPath, "utf8")) as A11yReport;
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export function suggestPrLabels(report: A11yReport | null): PrLabelSuggestion[] {
  if (!report) return [];

  const summary = report.summary;
  const labels: PrLabelSuggestion[] = [];

  if (summary.critical > 0) {
    labels.push({
      label: "a11y-critical",
      reason: `${summary.critical} critical finding${summary.critical === 1 ? "" : "s"}`
    });
  } else if (summary.warning > 0) {
    labels.push({
      label: "a11y-warning",
      reason: `${summary.warning} warning finding${summary.warning === 1 ? "" : "s"}`
    });
  } else if (summary.info > 0) {
    labels.push({
      label: "a11y-info",
      reason: `${summary.info} informational finding${summary.info === 1 ? "" : "s"}`
    });
  } else {
    labels.push({
      label: "a11y-clean",
      reason: "no automated findings"
    });
  }

  if ((summary.byFindingType?.["needs-review"] || 0) > 0 || (summary.blockedByHumanVerification || 0) > 0) {
    labels.push({
      label: "a11y-needs-review",
      reason: "manual verification recommended"
    });
  }

  return labels;
}

export function withSuggestedLabels(body: string, report: A11yReport | null): string {
  if (body.includes("## Suggested PR Labels")) return body;

  const labels = suggestPrLabels(report);
  if (labels.length === 0) return body;

  const lines = labels.map((item) => `- \`${item.label}\` - ${item.reason}`);
  return `${body.trimEnd()}\n\n## Suggested PR Labels\n\n${lines.join("\n")}\n`;
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

function withCommentMarker(body: string): string {
  if (body.includes(COMMENT_MARKER)) return body;
  return `${COMMENT_MARKER}\n${body}`;
}

export function withArtifactRunLink(body: string, env: GitHubEnv): string {
  const { GITHUB_REPOSITORY, GITHUB_RUN_ID } = env;
  const artifactName = normalizeArtifactName(env.REPORT_ARTIFACT_NAME);
  const artifactUrl = normalizeArtifactUrl(env.REPORT_ARTIFACT_URL);

  if (artifactUrl) {
    return `${body.trimEnd()}\n\n## Visual Report\n\n[Download the \`${artifactName}\` artifact](${artifactUrl}) to open the visual HTML report and screenshots. Access and retention follow the repository's GitHub Actions settings.\n`;
  }

  if (!GITHUB_REPOSITORY || !GITHUB_RUN_ID) return body;

  const serverUrl = (env.GITHUB_SERVER_URL || "https://github.com").replace(/\/$/, "");
  const runUrl = `${serverUrl}/${GITHUB_REPOSITORY}/actions/runs/${encodeURIComponent(GITHUB_RUN_ID)}`;

  return `${body.trimEnd()}\n\n## Visual Report\n\n[Open the GitHub Actions run to download \`${artifactName}\`](${runUrl}). Access and retention follow the repository's GitHub Actions settings.\n`;
}

function normalizeArtifactName(value: string | undefined): string {
  if (!value || !/^[a-zA-Z0-9._-]+$/.test(value)) return "a11y-report";
  return value;
}

function normalizeArtifactUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isGitHubCommentPermissionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (!("status" in error)) return false;

  const status = Number(error.status);
  return status === 403 || status === 404;
}

async function findExistingComment(
  client: CommentClient,
  context: PullRequestContext
): Promise<{ id: number } | null> {
  if (!client.issues.listComments) return null;

  const response = await client.issues.listComments({
    owner: context.owner,
    repo: context.repo,
    issue_number: context.issue_number,
    per_page: 100
  });

  return response.data.find((comment) => comment.body?.includes(COMMENT_MARKER)) || null;
}
