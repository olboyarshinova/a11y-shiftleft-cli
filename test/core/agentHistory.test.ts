import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  findHistoryReportFiles,
  findPreviousReportInHistory,
  summarizeAgentHistory
} from "../../dist/core/agentHistory.js";
import type { A11yReport, DedupedIssue, Severity } from "../../dist/types.js";

let issueCounter = 0;

test("findPreviousReportInHistory selects the latest older report", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-agent-history-"));
  const oldPath = await writeReport(root, "run-1", "2026-07-01T00:00:00.000Z", 4);
  const previousPath = await writeReport(root, "run-2", "2026-07-02T00:00:00.000Z", 2);
  const currentPath = await writeReport(root, "run-3", "2026-07-03T00:00:00.000Z", 1);
  const currentReport = report("2026-07-03T00:00:00.000Z", 1);

  assert.deepEqual((await findHistoryReportFiles(root)).sort(), [oldPath, previousPath, currentPath].sort());
  assert.equal(
    await findPreviousReportInHistory({
      currentReportPath: currentPath,
      currentReport,
      historyRoot: root
    }),
    previousPath
  );
  assert.deepEqual(
    await summarizeAgentHistory({
      currentReportPath: currentPath,
      currentReport,
      historyRoot: root
    }),
    {
      totalRuns: 3,
      firstRunId: "run-1/a11y-report.json",
      currentRunId: "run-3/a11y-report.json",
      previousRunId: "run-2/a11y-report.json",
      totalDeltaFromFirst: -3,
      criticalDeltaFromFirst: 0,
      warningDeltaFromFirst: -3,
      infoDeltaFromFirst: 0,
      ruleRegressions: [],
      ruleImprovements: []
    }
  );
});

test("summarizeAgentHistory highlights compact rule changes from the first run", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-agent-history-rules-"));
  await writeReport(root, "run-1", "2026-07-01T00:00:00.000Z", 4, [
    issue("button-name", "critical"),
    issue("button-name", "critical"),
    issue("image-alt", "warning")
  ]);
  const currentPath = await writeReport(root, "run-2", "2026-07-02T00:00:00.000Z", 5, [
    issue("button-name", "critical"),
    issue("color-contrast", "warning"),
    issue("color-contrast", "warning"),
    issue("color-contrast", "warning")
  ]);

  const summary = await summarizeAgentHistory({
    currentReportPath: currentPath,
    currentReport: report("2026-07-02T00:00:00.000Z", 5),
    historyRoot: root
  });

  assert.deepEqual(summary?.ruleRegressions, [{
    ruleId: "color-contrast",
    first: 0,
    current: 3,
    change: 3
  }]);
  assert.deepEqual(summary?.ruleImprovements, [
    {
      ruleId: "button-name",
      first: 2,
      current: 1,
      change: -1
    },
    {
      ruleId: "image-alt",
      first: 1,
      current: 0,
      change: -1
    }
  ]);
});

test("findPreviousReportInHistory ignores the current file and invalid report JSON", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-agent-history-invalid-"));
  const currentPath = await writeReport(root, "current", "2026-07-03T00:00:00.000Z", 1);
  await fs.mkdir(path.join(root, "invalid"));
  await fs.writeFile(path.join(root, "invalid", "a11y-report.json"), "{}");

  assert.equal(
    await findPreviousReportInHistory({
      currentReportPath: currentPath,
      currentReport: report("2026-07-03T00:00:00.000Z", 1),
      historyRoot: root
    }),
    undefined
  );
});

async function writeReport(
  root: string,
  dirName: string,
  generatedAt: string,
  total: number,
  issues: DedupedIssue[] = []
): Promise<string> {
  const dir = path.join(root, dirName);
  const reportPath = path.join(dir, "a11y-report.json");
  await fs.mkdir(dir);
  await fs.writeFile(reportPath, JSON.stringify(report(generatedAt, total, issues)));
  return reportPath;
}

function report(generatedAt: string, total: number, issues: DedupedIssue[] = []): A11yReport {
  return {
    generatedAt,
    summary: {
      total,
      critical: 0,
      warning: total,
      info: 0
    },
    issues
  } as A11yReport;
}

function issue(ruleId: string, severity: Severity): DedupedIssue {
  issueCounter += 1;
  return {
    fingerprint: `${ruleId}-${issueCounter}`,
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
    category: "other",
    duplicateCount: 0
  } as DedupedIssue;
}
