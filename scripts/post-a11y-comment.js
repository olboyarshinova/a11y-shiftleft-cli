import fs from "node:fs/promises";
import { Octokit } from "@octokit/rest";

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER } = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER) {
  console.log("Missing GitHub PR environment variables. Skipping comment.");
  process.exit(0);
}

const [owner, repo] = GITHUB_REPOSITORY.split("/");
const body = await fs.readFile("reports/a11y-comment.md", "utf8");
const octokit = new Octokit({ auth: GITHUB_TOKEN });

await octokit.issues.createComment({
  owner,
  repo,
  issue_number: Number(PR_NUMBER),
  body
});
