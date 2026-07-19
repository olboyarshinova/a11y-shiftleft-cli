import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProgram } from "../../dist/cli.js";
import type { DedupedIssue, Severity } from "../../dist/types.js";

test("agent review exposes local report comparison options", () => {
  const agent = createProgram().commands.find((item) => item.name() === "agent");
  const reviewCommand = agent?.commands.find((item) => item.name() === "review");

  assert.ok(reviewCommand);
  const flags = reviewCommand.options.map((option) => option.long);
  assert.equal(flags.includes("--report"), true);
  assert.equal(flags.includes("--previous"), true);
  assert.equal(flags.includes("--history"), true);
  assert.equal(flags.includes("--history-max-depth"), true);
  assert.equal(flags.includes("--max-items"), true);
  assert.equal(flags.includes("--out"), true);
  assert.equal(flags.includes("--json"), true);
  assert.match(reviewCommand.description(), /compare progress/);
});

test("agent run exposes audit plus review workflow options", () => {
  const agent = createProgram().commands.find((item) => item.name() === "agent");
  const runCommand = agent?.commands.find((item) => item.name() === "run");

  assert.ok(runCommand);
  const flags = runCommand.options.map((option) => option.long);
  assert.equal(flags.includes("--url"), true);
  assert.equal(flags.includes("--previous"), true);
  assert.equal(flags.includes("--history"), true);
  assert.equal(flags.includes("--out"), true);
  assert.equal(flags.includes("--review-out"), true);
  assert.equal(flags.includes("--profile"), true);
  assert.equal(flags.includes("--with-lighthouse"), true);
  assert.equal(flags.includes("--open"), true);
  assert.match(runCommand.description(), /Run an audit/);
});

test("agent refresh-html exposes visual rebuild options", () => {
  const agent = createProgram().commands.find((item) => item.name() === "agent");
  const refreshCommand = agent?.commands.find((item) => item.name() === "refresh-html");

  assert.ok(refreshCommand);
  const flags = refreshCommand.options.map((option) => option.long);
  assert.equal(flags.includes("--report"), true);
  assert.equal(flags.includes("--out"), true);
  assert.equal(flags.includes("--file-name"), true);
  assert.equal(flags.includes("--open"), true);
  assert.match(refreshCommand.description(), /Rebuild the visual HTML report/);
});

test("agent review can compare with the previous report from history", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-agent-review-history-"));
  const historyDir = path.join(root, "history");
  const currentDir = path.join(historyDir, "run-2");
  const previousDir = path.join(historyDir, "run-1");
  const outputPath = path.join(root, "agent-review.md");
  await fs.mkdir(currentDir, { recursive: true });
  await fs.mkdir(previousDir, { recursive: true });
  await fs.writeFile(path.join(previousDir, "a11y-report.json"), JSON.stringify({
    ...report([issue("fixed", "button-name", "critical")]),
    generatedAt: "2026-07-18T00:00:00.000Z"
  }));
  await fs.writeFile(path.join(currentDir, "a11y-report.json"), JSON.stringify({
    ...report([issue("new", "image-alt", "critical")]),
    generatedAt: "2026-07-19T00:00:00.000Z"
  }));

  await createProgram().parseAsync([
    "node",
    "a11y-shiftleft",
    "agent",
    "review",
    "--report",
    currentDir,
    "--history",
    historyDir,
    "--out",
    outputPath
  ]);

  const output = await fs.readFile(outputPath, "utf8");
  assert.match(output, /Compared with \(history\):/);
  assert.match(output, /run-1\/a11y-report\.json/);
  assert.match(output, /Change: fixed 1, new 1, remaining 0/);
  assert.match(output, /History: 2 runs indexed \| total 0 \| critical 0 \| warning 0 \| info 0/);
  assert.match(output, /Rules increased: image-alt \+1 \(0 -> 1\)/);
  assert.match(output, /Rules improved: button-name -1 \(1 -> 0\)/);
});

test("agent review writes a deterministic progress summary", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-agent-review-"));
  const currentDir = path.join(root, "current");
  const previousDir = path.join(root, "previous");
  const outputPath = path.join(root, "agent-review.md");
  await fs.mkdir(currentDir);
  await fs.mkdir(previousDir);
  await fs.writeFile(path.join(previousDir, "a11y-report.json"), JSON.stringify(report([
    issue("old", "button-name", "critical"),
    issue("remaining", "color-contrast", "warning")
  ])));
  await fs.writeFile(path.join(currentDir, "a11y-report.json"), JSON.stringify(report([
    issue("remaining", "color-contrast", "warning"),
    issue("new", "image-alt", "critical")
  ])));

  await createProgram().parseAsync([
    "node",
    "a11y-shiftleft",
    "agent",
    "review",
    "--report",
    currentDir,
    "--previous",
    previousDir,
    "--out",
    outputPath
  ]);

  const output = await fs.readFile(outputPath, "utf8");
  assert.match(output, /Findings: total 2 \| critical 1 \| warning 1 \| info 0/);
  assert.match(output, /Change: fixed 1, new 1, remaining 1/);
  assert.match(output, /image-alt/);
});

test("agent refresh-html rebuilds visual report from existing JSON and copies screenshots", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-agent-refresh-html-"));
  const sourceDir = path.join(root, "source");
  const outputDir = path.join(root, "output");
  await fs.mkdir(path.join(sourceDir, "screenshots"), { recursive: true });
  await fs.writeFile(path.join(sourceDir, "screenshots", "state-1.png"), "image-data");
  await fs.writeFile(path.join(sourceDir, "a11y-report.json"), JSON.stringify({
    ...report([issue("finding", "button-name", "critical")]),
    exploration: {
      generatedAt: "2026-07-19T00:00:00.000Z",
      startUrl: "http://localhost:3000",
      states: [{
        id: "state-1",
        url: "http://localhost:3000/",
        title: "Demo",
        depth: 0,
        fingerprint: "state-1",
        actionLabel: "Initial page",
        screenshot: "screenshots/state-1.png",
        issueCount: 1,
        actionCount: 0
      }],
      edges: [],
      skippedActions: [],
      summary: {
        statesVisited: 1,
        actionsTried: 0,
        skippedActions: 0,
        screenshots: 1,
        duplicateScreenshots: 0,
        maxDepth: 1,
        maxStates: 1
      }
    }
  }));

  await createProgram().parseAsync([
    "node",
    "a11y-shiftleft",
    "agent",
    "refresh-html",
    "--report",
    sourceDir,
    "--out",
    outputDir
  ]);

  const html = await fs.readFile(path.join(outputDir, "a11y-report.html"), "utf8");
  assert.match(html, /Accessibility Audit Report/);
  assert.match(html, /state-1/);
  assert.equal(await fs.readFile(path.join(outputDir, "screenshots", "state-1.png"), "utf8"), "image-data");
});

function report(issues: DedupedIssue[]) {
  return {
    generatedAt: "2026-07-19T00:00:00.000Z",
    summary: {
      total: issues.length,
      critical: issues.filter((item) => item.severity === "critical").length,
      warning: issues.filter((item) => item.severity === "warning").length,
      info: issues.filter((item) => item.severity === "info").length
    },
    issues
  };
}

function issue(fingerprint: string, ruleId: string, severity: Severity): DedupedIssue {
  return {
    fingerprint,
    ruleId,
    severity,
    source: "test",
    framework: "react",
    message: `${ruleId} message`,
    wcag: [],
    wcagCriteria: [],
    tags: [],
    confidence: "high",
    confidenceScore: 0.9,
    confidenceReason: "test",
    findingType: "wcag",
    category: "semantics",
    selector: ".target",
    duplicateCount: 0
  } as DedupedIssue;
}
