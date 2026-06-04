import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Octokit } from "@octokit/rest";
import { toMarkdown } from "../dist/reporters/writeReports.js";

export function getPullRequestContext(env = process.env) {
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

export async function buildCommentBody(reportDir = "reports") {
  const markdownPath = path.join(reportDir, "a11y-comment.md");
  const jsonPath = path.join(reportDir, "a11y-report.json");

  try {
    return await fs.readFile(markdownPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    const report = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    return toMarkdown(report);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function postA11yComment({
  env = process.env,
  reportDir = "reports",
  octokit
} = {}) {
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

  const client = octokit || new Octokit({ auth: context.token });

  await client.issues.createComment({
    owner: context.owner,
    repo: context.repo,
    issue_number: context.issue_number,
    body
  });

  return { skipped: false };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await postA11yComment();
}
