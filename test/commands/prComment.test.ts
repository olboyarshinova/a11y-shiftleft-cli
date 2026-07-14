import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import { resolvePrCommentEnv } from "../../dist/commands/prComment.js";

test("pr-comment command is registered with manual posting options", () => {
  const command = createProgram().commands.find((item) => item.name() === "pr-comment");

  assert.ok(command);
  assert.match(command.description(), /pull request comment/);

  const flags = command.options.map((option) => option.long);
  assert.equal(flags.includes("--report"), true);
  assert.equal(flags.includes("--repo"), true);
  assert.equal(flags.includes("--pr"), true);
  assert.equal(flags.includes("--token"), true);
  assert.equal(flags.includes("--dry-run"), true);
});

test("resolvePrCommentEnv uses explicit options and GH_TOKEN fallback", () => {
  const env = resolvePrCommentEnv({
    repo: "owner/repo",
    pr: "42",
    artifactName: "a11y-preview",
    artifactUrl: "https://github.example.com/artifacts/123"
  }, {
    GH_TOKEN: "fallback-token",
    GITHUB_REPOSITORY: "old/repo",
    PR_NUMBER: "1",
    GITHUB_SERVER_URL: "https://github.example.com"
  });

  assert.equal(env.GITHUB_TOKEN, "fallback-token");
  assert.equal(env.GITHUB_REPOSITORY, "owner/repo");
  assert.equal(env.PR_NUMBER, "42");
  assert.equal(env.REPORT_ARTIFACT_NAME, "a11y-preview");
  assert.equal(env.REPORT_ARTIFACT_URL, "https://github.example.com/artifacts/123");
  assert.equal(env.GITHUB_SERVER_URL, "https://github.example.com");
});
