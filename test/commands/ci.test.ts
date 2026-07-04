import test from "node:test";
import assert from "node:assert/strict";
import {
  checkGateArgument,
  fullWorkflowTemplate,
  toCiProfile,
  workflowFiles,
  workflowTemplate
} from "../../dist/commands/ci.js";

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
  assert.match(workflow, /--crawl --crawl-depth 1 --crawl-limit 5/);
  assert.match(workflow, /Comment on PR/);
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

test("toCiProfile supports quick alias and rejects unknown profiles", () => {
  assert.equal(toCiProfile("quick"), "pr");
  assert.equal(toCiProfile("split"), "split");
  assert.throws(() => toCiProfile("slow"), /Unsupported CI profile/);
});
