import type { Command } from "commander";
import {
  buildCommentBody,
  getPullRequestContext,
  postA11yComment,
  withArtifactRunLink
} from "../scripts/post-a11y-comment.js";

interface PrCommentOptions {
  report?: string;
  repo?: string;
  pr?: string;
  token?: string;
  artifactName?: string;
  artifactUrl?: string;
  serverUrl?: string;
  dryRun?: boolean;
}

type PrCommentEnv = Record<string, string | undefined>;

export function registerPrCommentCommand(program: Command): void {
  program
    .command("pr-comment")
    .description("Post or update a GitHub pull request comment from a local accessibility report.")
    .option("--report <dir>", "Report directory containing a11y-comment.md or a11y-report.json", "reports")
    .option("--repo <owner/repo>", "GitHub repository, for example owner/repo")
    .option("--pr <number>", "Pull request number")
    .option("--token <token>", "GitHub token. Prefer GITHUB_TOKEN or GH_TOKEN in the environment.")
    .option("--artifact-name <name>", "Uploaded report artifact name")
    .option("--artifact-url <url>", "Direct URL to the uploaded report artifact")
    .option("--server-url <url>", "GitHub server URL", "https://github.com")
    .option("--dry-run", "Print the comment body without posting to GitHub")
    .action(async (options: PrCommentOptions) => {
      const env = resolvePrCommentEnv(options, process.env);

      if (options.dryRun) {
        const body = await buildCommentBody(options.report || "reports");

        if (!body) {
          throw new Error(`No accessibility report found in ${options.report || "reports"}. Run audit or check first.`);
        }

        console.log(withArtifactRunLink(body, env));
        return;
      }

      if (!getPullRequestContext(env)) {
        throw new Error("Missing GitHub PR details. Provide --repo, --pr, and --token, or set GITHUB_REPOSITORY, PR_NUMBER, and GITHUB_TOKEN.");
      }

      const result = await postA11yComment({
        env,
        reportDir: options.report || "reports"
      });

      if (result.skipped) {
        process.exitCode = 1;
        return;
      }

      console.log(`Posted or updated accessibility comment for ${env.GITHUB_REPOSITORY}#${env.PR_NUMBER}.`);
    });
}

export function resolvePrCommentEnv(
  options: Pick<PrCommentOptions, "repo" | "pr" | "token" | "artifactName" | "artifactUrl" | "serverUrl">,
  env: PrCommentEnv
): PrCommentEnv {
  return {
    ...env,
    GITHUB_TOKEN: options.token || env.GITHUB_TOKEN || env.GH_TOKEN,
    GITHUB_REPOSITORY: options.repo || env.GITHUB_REPOSITORY,
    PR_NUMBER: options.pr || env.PR_NUMBER,
    REPORT_ARTIFACT_NAME: options.artifactName || env.REPORT_ARTIFACT_NAME,
    REPORT_ARTIFACT_URL: options.artifactUrl || env.REPORT_ARTIFACT_URL,
    GITHUB_SERVER_URL: options.serverUrl || env.GITHUB_SERVER_URL
  };
}
