import test from "node:test";
import assert from "node:assert/strict";
import {
  createAgentReview,
  formatAgentReview
} from "../../dist/core/agentReview.js";
import type { A11yReport, DedupedIssue, Severity } from "../../dist/types.js";

test("createAgentReview summarizes current findings and previous progress", () => {
  const previous = report([
    issue("old-critical", "button-name", "critical"),
    issue("remaining-warning", "color-contrast", "warning")
  ]);
  const current = report([
    issue("remaining-warning", "color-contrast", "warning"),
    issue("new-critical", "image-alt", "critical"),
    issue("new-info", "page-has-heading-one", "info")
  ]);

  const review = createAgentReview({
    report: current,
    previousReport: previous,
    reportPath: "reports/current/a11y-report.json",
    previousReportPath: "reports/previous/a11y-report.json",
    maxItems: 2
  });

  assert.deepEqual(review.summary, {
    total: 3,
    critical: 1,
    warning: 1,
    info: 1
  });
  assert.equal(review.changes.fixedIssues, 1);
  assert.equal(review.changes.newIssues, 2);
  assert.equal(review.changes.remainingIssues, 1);
  assert.deepEqual(review.focus.map((item) => item.ruleId), ["image-alt", "color-contrast"]);
});

test("formatAgentReview renders concise next-step guidance", () => {
  const review = createAgentReview({
    report: report([issue("critical", "button-name", "critical")]),
    reportPath: "reports/a11y-report.json"
  });
  const text = formatAgentReview(review);

  assert.match(text, /a11y-shiftleft agent review/);
  assert.match(text, /Findings: total 1 \| critical 1 \| warning 0 \| info 0/);
  assert.match(text, /Change: no previous report provided/);
  assert.match(text, /Fix first:/);
  assert.match(text, /button-name/);
  assert.match(text, /Suggested next commands:/);
  assert.match(text, /ticket export/);
});

function report(issues: DedupedIssue[]): A11yReport {
  return {
    generatedAt: "2026-07-19T00:00:00.000Z",
    summary: {
      total: issues.length,
      critical: issues.filter((item) => item.severity === "critical").length,
      warning: issues.filter((item) => item.severity === "warning").length,
      info: issues.filter((item) => item.severity === "info").length
    },
    issues
  } as A11yReport;
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
    wcagCriteria: [{
      id: "4.1.2",
      title: "Name, Role, Value",
      level: "A",
      principle: "Robust",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    }],
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
