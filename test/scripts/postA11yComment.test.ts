import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildCommentBody,
  getPullRequestContext,
  postA11yComment,
  suggestPrLabels,
  withArtifactRunLink
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

test("buildCommentBody can append suggested PR labels from JSON summary", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-labels-"));
  await fs.writeFile(path.join(reportDir, "a11y-comment.md"), "hello markdown");
  await fs.writeFile(
    path.join(reportDir, "a11y-report.json"),
    JSON.stringify({
      summary: {
        total: 3,
        critical: 2,
        warning: 1,
        info: 0,
        rawCount: 3,
        uniqueCount: 3,
        duplicateCount: 0,
        duplicateRate: 0,
        scanDurationMs: 42,
        framework: "react",
        byFindingType: {
          "needs-review": 1
        }
      },
      issues: []
    })
  );

  const body = await buildCommentBody(reportDir, { includeLabels: true });

  assert.match(body, /hello markdown/);
  assert.match(body, /Suggested PR Labels/);
  assert.match(body, /`a11y-critical` - 2 critical findings/);
  assert.match(body, /`a11y-needs-review` - manual verification recommended/);
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

test("suggestPrLabels returns a clean label when no findings are present", () => {
  assert.deepEqual(
    suggestPrLabels({
      summary: {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0
      }
    } as never),
    [
      {
        label: "a11y-clean",
        reason: "no automated findings"
      }
    ]
  );
});

test("withArtifactRunLink adds the current GitHub Actions run", () => {
  assert.equal(
    withArtifactRunLink("report body", {
      GITHUB_SERVER_URL: "https://github.example.com/",
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_RUN_ID: "123",
      REPORT_ARTIFACT_NAME: "a11y-preview"
    }),
    "report body\n\n## Visual Report\n\n[Open the GitHub Actions run to download `a11y-preview`](https://github.example.com/owner/repo/actions/runs/123). Access and retention follow the repository's GitHub Actions settings.\n"
  );
});

test("withArtifactRunLink prefers the direct artifact URL when available", () => {
  assert.equal(
    withArtifactRunLink("report body", {
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_RUN_ID: "123",
      REPORT_ARTIFACT_NAME: "a11y-preview",
      REPORT_ARTIFACT_URL: "https://github.example.com/owner/repo/actions/runs/123/artifacts/456"
    }),
    "report body\n\n## Visual Report\n\n[Download the `a11y-preview` artifact](https://github.example.com/owner/repo/actions/runs/123/artifacts/456) to open the visual HTML report and screenshots. Access and retention follow the repository's GitHub Actions settings.\n"
  );
});

test("withArtifactRunLink leaves local report comments unchanged", () => {
  assert.equal(withArtifactRunLink("report body", {}), "report body");
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

test("postA11yComment includes the uploaded report run link in CI", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-artifact-"));
  await fs.writeFile(path.join(reportDir, "a11y-comment.md"), "body");

  const calls = [];
  await postA11yComment({
    reportDir,
    env: {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_RUN_ID: "456",
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

  assert.match(calls[0].body, /github\.com\/owner\/repo\/actions\/runs\/456/);
  assert.match(calls[0].body, /a11y-report/);
});

test("postA11yComment skips when GitHub token cannot write PR comments", async () => {
  const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-comment-forbidden-"));
  await fs.writeFile(path.join(reportDir, "a11y-comment.md"), "body");

  const forbidden = new Error("Resource not accessible by integration") as Error & {
    status: number;
  };
  forbidden.status = 403;

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
          throw forbidden;
        }
      }
    }
  });

  assert.deepEqual(result, { skipped: true });
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
