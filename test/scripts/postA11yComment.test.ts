import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildCommentBody,
  getPullRequestContext,
  postA11yComment
} from "../../dist/scripts/post-a11y-comment.js";

test("getPullRequestContext returns null when GitHub env is missing", () => {
  assert.equal(getPullRequestContext({}), null);
});

test("getPullRequestContext parses GitHub PR environment", () => {
  assert.deepEqual(
    getPullRequestContext({
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "owner/repo",
      PR_NUMBER: "12"
    }),
    {
      owner: "owner",
      repo: "repo",
      issue_number: 12,
      token: "token"
    }
  );
});

test("buildCommentBody prefers markdown report", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-md-"));
  await fs.writeFile(path.join(reportDir, "a11y-comment.md"), "hello markdown");

  assert.equal(await buildCommentBody(reportDir), "hello markdown");
});

test("buildCommentBody falls back to JSON report", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-json-"));
  await fs.writeFile(
    path.join(reportDir, "a11y-report.json"),
    JSON.stringify({
      summary: {
        total: 1,
        critical: 1,
        warning: 0,
        info: 0,
        rawCount: 1,
        duplicateCount: 0,
        duplicateRate: 0,
        scanDurationMs: 42,
        framework: "react"
      },
      issues: [
        {
          severity: "critical",
          ruleId: "button-name",
          selector: ".icon-button",
          message: "Buttons must have discernible text"
        }
      ]
    })
  );

  const body = await buildCommentBody(reportDir);

  assert.match(body, /Accessibility Shift-Left Report/);
  assert.match(body, /button-name/);
});

test("buildCommentBody returns null when no report exists", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-empty-"));

  assert.equal(await buildCommentBody(reportDir), null);
});

test("postA11yComment skips when no report exists", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-no-report-"));
  const result = await postA11yComment({
    reportDir,
    env: {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "owner/repo",
      PR_NUMBER: "3"
    },
    octokit: {
      issues: {
        createComment: async () => {
          throw new Error("Should not be called");
        }
      }
    }
  });

  assert.deepEqual(result, { skipped: true });
});

test("postA11yComment can be tested with an injected client", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-post-"));
  await fs.writeFile(path.join(reportDir, "a11y-comment.md"), "body");

  const calls = [];
  const result = await postA11yComment({
    reportDir,
    env: {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "owner/repo",
      PR_NUMBER: "3"
    },
    octokit: {
      issues: {
        createComment: async (payload) => {
          calls.push(payload);
        }
      }
    }
  });

  assert.deepEqual(result, { skipped: false });
	  assert.deepEqual(calls, [
	    {
	      owner: "owner",
	      repo: "repo",
	      issue_number: 3,
	      body: "<!-- a11y-shiftleft-report -->\nbody"
	    }
	  ]);
	});

test("postA11yComment updates an existing report comment", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-update-"));
  await fs.writeFile(path.join(reportDir, "a11y-comment.md"), "updated body");

  const createCalls = [];
  const updateCalls = [];
  const result = await postA11yComment({
    reportDir,
    env: {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "owner/repo",
      PR_NUMBER: "3"
    },
    octokit: {
      issues: {
        listComments: async () => ({
          data: [
            {
              id: 99,
              body: "<!-- a11y-shiftleft-report -->\nold body"
            }
          ]
        }),
        updateComment: async (payload) => {
          updateCalls.push(payload);
        },
        createComment: async (payload) => {
          createCalls.push(payload);
        }
      }
    }
  });

  assert.deepEqual(result, { skipped: false });
  assert.deepEqual(createCalls, []);
  assert.deepEqual(updateCalls, [
    {
      owner: "owner",
      repo: "repo",
      comment_id: 99,
      body: "<!-- a11y-shiftleft-report -->\nupdated body"
    }
  ]);
});
