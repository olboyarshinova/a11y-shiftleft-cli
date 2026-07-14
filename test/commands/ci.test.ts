import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import {
  checkGateArgument,
  circleCiWorkflowFiles,
  circleCiWorkflowTemplate,
  gitLabWorkflowFiles,
  gitLabWorkflowTemplate,
  fullWorkflowTemplate,
  shellWorkflowFiles,
  shellWorkflowTemplate,
  toCiProvider,
  toCiProfile,
  workflowFiles,
  workflowTemplate
} from "../../dist/commands/ci.js";

test("generate-ci is the documented command and ci remains a short alias", () => {
  const command = createProgram().commands.find((item) => item.name() === "generate-ci");

  assert.ok(command);
  assert.deepEqual(command.aliases(), ["ci"]);
  assert.match(command.description(), /Generate CI workflow files/);
  const flags = command.options.map((option) => option.long);
  assert.equal(flags.includes("--provider"), true);
  assert.equal(flags.includes("--start-command"), true);
});

test("workflowTemplate includes compliance standard and multiple URLs", () => {
  const workflow = workflowTemplate({
    urls: [
      "http://localhost:4200",
      "http://localhost:4200/favorites"
    ],
    startCommand: "npm run dev -- --host localhost --port 4200",
    failOn: "warning",
    standard: "section508"
  });

  assert.match(workflow, /curl -fsS http:\/\/localhost:4200/);
  assert.match(
    workflow,
    /npx a11y-shiftleft check --dynamic --url http:\/\/localhost:4200 http:\/\/localhost:4200\/favorites --crawl --crawl-depth 1 --crawl-limit 10 --out reports --fail-on warning --standard section508/
  );
});

test("workflowTemplate supports bounded fast PR crawls", () => {
  const workflow = workflowTemplate({
    urls: ["http://localhost:3000"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    failOn: "critical",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 5
  });

  assert.match(workflow, /name: Accessibility PR/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /--crawl --crawl-depth 1 --crawl-limit 5/);
  assert.match(workflow, /id: upload-a11y-report/);
  assert.match(workflow, /REPORT_ARTIFACT_URL: \$\{\{ steps\.upload-a11y-report\.outputs\.artifact-url \}\}/);
  assert.match(workflow, /Comment on PR/);
  assert.match(workflow, /npx a11y-shiftleft pr-comment --report reports --include-labels/);
  assert.doesNotMatch(workflow, /scripts\/post-a11y-comment\.js/);
});

test("workflowTemplate supports quality gate profiles for PR workflows", () => {
  const workflow = workflowTemplate({
    urls: ["http://localhost:3000"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    failOn: "critical",
    gate: "new-critical-only",
    standard: "wcag22-aa"
  });

  assert.match(workflow, /--gate new-critical-only --standard wcag22-aa/);
  assert.doesNotMatch(workflow, /--fail-on critical --standard/);
});

test("checkGateArgument maps supported gates and rejects unknown profiles", () => {
  assert.equal(checkGateArgument(undefined, "warning"), "--fail-on warning");
  assert.equal(checkGateArgument("report-only", "critical"), "--gate report-only");
  assert.throws(() => checkGateArgument("everything", "critical"), /Unsupported CI quality gate/);
});

test("fullWorkflowTemplate creates scheduled full-site crawl workflow", () => {
  const workflow = fullWorkflowTemplate({
    urls: ["http://localhost:3000"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 3,
    crawlLimit: 100,
    schedule: "0 7 * * 1"
  });

  assert.match(workflow, /name: Accessibility Full Site/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /cron: "0 7 \* \* 1"/);
  assert.match(workflow, /--crawl --crawl-depth 3 --crawl-limit 100 --semi-auto/);
  assert.match(workflow, /--fail-on none/);
  assert.doesNotMatch(workflow, /Comment on PR/);
});

test("workflowFiles splits PR and full-site workflows", () => {
  const workflows = workflowFiles({
    profile: "split",
    urls: ["http://localhost:3000"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    failOn: "critical",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    fullCrawlDepth: 3,
    fullCrawlLimit: 100,
    fullSchedule: "0 7 * * 1"
  });

  assert.deepEqual(workflows.map((workflow) => workflow.fileName), [
    "a11y-pr.yml",
    "a11y-full.yml"
  ]);
});

test("gitLabWorkflowTemplate creates a report-only merge request job", () => {
  const workflow = gitLabWorkflowTemplate({
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10
  });

  assert.match(workflow, /image: mcr\.microsoft\.com\/playwright:v1\.49\.1-jammy/);
  assert.match(workflow, /APP_URL: "http:\/\/localhost:5173"/);
  assert.match(workflow, /npm run build --if-present/);
  assert.match(workflow, /npx a11y-shiftleft check --dynamic --url http:\/\/localhost:5173 --crawl --crawl-depth 1 --crawl-limit 10 --out reports --gate report-only --standard wcag22-aa/);
  assert.match(workflow, /paths:\n      - reports\//);
});

test("gitLabWorkflowFiles supports the fast PR profile", () => {
  const workflows = gitLabWorkflowFiles({
    profile: "pr",
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    fullCrawlDepth: 3,
    fullCrawlLimit: 100,
    fullSchedule: "0 7 * * 1"
  });

  assert.deepEqual(workflows.map((workflow) => workflow.fileName), [".gitlab-ci.yml"]);
});

test("circleCiWorkflowTemplate creates a report-only job with artifacts", () => {
  const workflow = circleCiWorkflowTemplate({
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10
  });

  assert.match(workflow, /version: 2\.1/);
  assert.match(workflow, /image: mcr\.microsoft\.com\/playwright:v1\.49\.1-jammy/);
  assert.match(workflow, /APP_URL: "http:\/\/localhost:5173"/);
  assert.match(workflow, /background: true/);
  assert.match(workflow, /npx a11y-shiftleft check --dynamic --url http:\/\/localhost:5173 --crawl --crawl-depth 1 --crawl-limit 10 --out reports --gate report-only --standard wcag22-aa/);
  assert.match(workflow, /store_artifacts:/);
});

test("circleCiWorkflowFiles supports the fast PR profile", () => {
  const workflows = circleCiWorkflowFiles({
    profile: "pr",
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    fullCrawlDepth: 3,
    fullCrawlLimit: 100,
    fullSchedule: "0 7 * * 1"
  });

  assert.deepEqual(workflows.map((workflow) => workflow.fileName), ["config.yml"]);
});

test("shellWorkflowTemplate creates a portable CI script", () => {
  const script = shellWorkflowTemplate({
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10
  });

  assert.match(script, /^#!\/usr\/bin\/env bash/);
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /APP_URL="\$\{APP_URL:-http:\/\/localhost:5173\}"/);
  assert.match(script, /REPORT_DIR="\$\{A11Y_REPORT_DIR:-reports\}"/);
  assert.match(script, /npm run build --if-present/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /npx a11y-shiftleft check --dynamic --url http:\/\/localhost:5173 --crawl --crawl-depth 1 --crawl-limit 10 --out "\$REPORT_DIR" --gate report-only --standard wcag22-aa/);
});

test("shellWorkflowFiles supports the fast PR profile", () => {
  const workflows = shellWorkflowFiles({
    profile: "pr",
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    fullCrawlDepth: 3,
    fullCrawlLimit: 100,
    fullSchedule: "0 7 * * 1"
  });

  assert.deepEqual(workflows.map((workflow) => workflow.fileName), ["a11y-ci.sh"]);
  assert.equal(workflows[0]?.executable, true);
});

test("toCiProfile supports quick alias and rejects unknown profiles", () => {
  assert.equal(toCiProfile("quick"), "pr");
  assert.equal(toCiProfile("split"), "split");
  assert.throws(() => toCiProfile("slow"), /Unsupported CI profile/);
});

test("toCiProvider supports GitHub, GitLab, CircleCI, and shell aliases", () => {
  assert.equal(toCiProvider("github"), "github");
  assert.equal(toCiProvider("GitLab"), "gitlab");
  assert.equal(toCiProvider("circle"), "circleci");
  assert.equal(toCiProvider("CircleCI"), "circleci");
  assert.equal(toCiProvider("generic"), "shell");
  assert.equal(toCiProvider("Jenkins"), "shell");
  assert.throws(() => toCiProvider("teamcity"), /Unsupported CI provider/);
});
