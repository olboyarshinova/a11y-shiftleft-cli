import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applyRetest, resolveRetestReportPath } from "../../dist/core/retest.js";

test("resolveRetestReportPath accepts a report directory", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-retest-"));
  const reportDir = path.join(cwd, "before");
  await fs.mkdir(reportDir);

  assert.equal(
    await resolveRetestReportPath(cwd, "before"),
    path.join(reportDir, "a11y-report.json")
  );
});

test("applyRetest reports fixed, remaining, and new findings", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-retest-"));
  const reportDir = path.join(cwd, "before");
  await fs.mkdir(reportDir);
  await fs.writeFile(path.join(reportDir, "a11y-report.json"), JSON.stringify({
    generatedAt: "2026-01-01T00:00:00.000Z",
    summary: {},
    issues: [
      issue("remaining-critical", "critical"),
      issue("fixed-warning", "warning")
    ]
  }));

  const result = await applyRetest([
    issue("remaining-critical", "critical"),
    issue("new-warning", "warning"),
    issue("new-info", "info")
  ], { cwd, previous: "before" });

  assert.equal(result.summary.file, "before/a11y-report.json");
  assert.equal(result.summary.previousIssues, 2);
  assert.equal(result.summary.currentIssues, 3);
  assert.equal(result.summary.fixedIssues, 1);
  assert.equal(result.summary.remainingIssues, 1);
  assert.equal(result.summary.newIssues, 2);
  assert.equal(result.summary.newCritical, 0);
  assert.equal(result.summary.newWarning, 1);
  assert.equal(result.summary.newInfo, 1);
  assert.deepEqual(result.issues.map((item) => item.retestStatus), ["remaining", "new", "new"]);
});

function issue(fingerprint: string, severity: "critical" | "warning" | "info") {
  return {
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    message: "Button must have an accessible name",
    wcag: ["4.1.2"],
    wcagCriteria: [],
    tags: [],
    severity,
    fingerprint,
    duplicateCount: 0
  } as never;
}
