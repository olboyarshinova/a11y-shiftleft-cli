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
    previousReportSource: "history",
    maxItems: 2
  });

  assert.deepEqual(review.summary, {
    total: 3,
    critical: 1,
    warning: 1,
    info: 1
  });
  assert.equal(review.visualReportPath, "reports/current/a11y-report.html");
  assert.equal(review.previousReportSource, "history");
  assert.equal(review.changes.fixedIssues, 1);
  assert.equal(review.changes.newIssues, 2);
  assert.equal(review.changes.remainingIssues, 1);
  assert.deepEqual(review.riskFocus.map((item) => item.id), ["critical"]);
  assert.deepEqual(review.focus.map((item) => item.ruleId), ["image-alt", "color-contrast"]);
});

test("formatAgentReview renders concise next-step guidance", () => {
  const review = createAgentReview({
    report: report([issue("critical", "button-name", "critical")]),
    reportPath: "reports/a11y-report.json"
  });
  const text = formatAgentReview(review);

  assert.match(text, /a11y-shiftleft agent review/);
  assert.match(text, /Visual report: reports\/a11y-report\.html/);
  assert.match(text, /Findings: total 1 \| critical 1 \| warning 0 \| info 0/);
  assert.match(text, /Change: no previous report provided/);
  assert.match(text, /Review focus:/);
  assert.match(text, /Critical findings: 1/);
  assert.match(text, /Fix first:/);
  assert.match(text, /button-name/);
  assert.match(text, /Suggested next commands:/);
  assert.match(text, /ticket export --report reports\/a11y-report\.json --tracker github --out reports\/a11y-tickets\.md/);
  assert.match(text, /agent refresh-html --report reports --share-out a11y-share/);
});

test("createAgentReview recommends focused follow-up from report evidence", () => {
  const review = createAgentReview({
    report: {
      ...report([
        issue("keyboard", "keyboard-focus-cycle", "warning", { category: "keyboard" }),
        issue("needs-review", "layout-horizontal-overflow", "warning", { findingType: "needs-review" })
      ]),
      keyboard: { steps: [], issues: [], summary: { forwardSteps: 0, reverseSteps: 0, activationChecks: 0 } }
    } as A11yReport,
    previousReport: report([]),
    reportPath: "/tmp/reports/a11y-report.json"
  });

  assert.equal(review.nextCommands.some((command) => /Keyboard Audit/.test(command)), true);
  assert.equal(review.nextCommands.some((command) => /manual review checklist/.test(command)), true);
  assert.equal(review.nextCommands.some((command) => /--with-lighthouse/.test(command)), true);
});

test("createAgentReview recommends continuing history workflow when available", () => {
  const review = createAgentReview({
    report: report([issue("warning", "color-contrast", "warning")]),
    reportPath: "reports/history/run-2/a11y-report.json",
    historyRoot: "reports/history"
  });

  assert.equal(review.nextCommands.some((command) => /--history reports\/history/.test(command)), true);
  assert.equal(review.nextCommands.some((command) => /ticket export --report reports\/history\/run-2\/a11y-report\.json/.test(command)), true);
  assert.equal(review.nextCommands.some((command) => /agent refresh-html --report reports\/history\/run-2/.test(command)), true);
  assert.equal(review.nextCommands.some((command) => /--previous <previous-report-dir>/.test(command)), false);
});

test("formatAgentReview includes dashboard history deltas when available", () => {
  const review = createAgentReview({
    report: report([issue("warning", "color-contrast", "warning")]),
    reportPath: "reports/history/run-2/a11y-report.json",
    dashboardHistory: {
      totalRuns: 2,
      previousRunId: "run-1",
      latestRunId: "run-2",
      totalChange: -3,
      criticalChange: 0,
      lighthouseScoreChange: 4,
      ruleRegressions: [{ id: "image-alt", change: 1 }],
      ruleResolved: [{ id: "button-name", resolved: 2 }]
    }
  });
  const text = formatAgentReview(review);

  assert.match(text, /Dashboard history: 2 runs \| run-1 -> run-2 \| total -3 \| critical 0 \| Lighthouse \+4/);
  assert.match(text, /Dashboard rule regressions: image-alt \+1/);
  assert.match(text, /Dashboard rule resolved: button-name -2/);
});

test("createAgentReview summarizes practical risk focus areas", () => {
  const reportWithRisk = {
    ...report([
      issue("new-critical", "button-name", "critical"),
      issue("keyboard", "keyboard-focus-cycle", "warning", { source: "keyboard", category: "keyboard" }),
      issue("needs-review", "layout-horizontal-overflow", "warning", { findingType: "needs-review" }),
      issue("third-party", "aria-prohibited-attr", "warning", {
        ownership: {
          kind: "third-party-embed",
          label: "Third-party embedded content"
        }
      })
    ]),
    summary: {
      ...report([]).summary,
      total: 4,
      critical: 1,
      warning: 3,
      info: 0,
      byOwnership: {
        "third-party-embed": 1
      },
      blockedByHumanVerification: 1,
      lighthouse: {
        enabled: true,
        pageCount: 1,
        averageAccessibilityScore: 88,
        minAccessibilityScore: 88,
        failedAuditCount: 2,
        manualAuditCount: 1,
        pages: []
      }
    }
  } as A11yReport;

  const review = createAgentReview({
    report: reportWithRisk,
    reportPath: "reports/a11y-report.json"
  });

  assert.deepEqual(review.riskFocus.map((item) => item.id), [
    "critical",
    "keyboard-focus",
    "needs-review",
    "third-party",
    "human-verification"
  ]);
  assert.equal(review.riskFocus.some((item) => item.id === "lighthouse"), false);
});

test("createAgentReview recommends ignore cleanup only when scoped ignores need review", () => {
  const cleanReview = createAgentReview({
    report: {
      ...report([issue("warning", "color-contrast", "warning")]),
      summary: {
        ...report([issue("warning", "color-contrast", "warning")]).summary,
        ignore: {
          enabled: true,
          file: "a11y-ignore.json",
          totalRules: 1,
          activeRules: 1,
          expiredRules: 0,
          invalidRules: 0,
          expiringSoonRules: 0,
          ignoredIssues: 1,
          ownerSummaries: []
        }
      }
    } as A11yReport,
    reportPath: "reports/a11y-report.json"
  });
  const staleReview = createAgentReview({
    report: {
      ...report([issue("warning", "color-contrast", "warning")]),
      summary: {
        ...report([issue("warning", "color-contrast", "warning")]).summary,
        ignore: {
          enabled: true,
          file: "config/a11y ignore.json",
          totalRules: 2,
          activeRules: 1,
          expiredRules: 1,
          invalidRules: 0,
          expiringSoonRules: 1,
          ignoredIssues: 1,
          ownerSummaries: []
        }
      }
    } as A11yReport,
    reportPath: "reports/a11y-report.json"
  });

  assert.equal(cleanReview.nextCommands.some((command) => /ignore cleanup-plan/.test(command)), false);
  assert.equal(staleReview.nextCommands.some((command) => /ignore cleanup-plan --ignore-file 'config\/a11y ignore\.json'/.test(command)), true);
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

function issue(
  fingerprint: string,
  ruleId: string,
  severity: Severity,
  overrides: Partial<DedupedIssue> = {}
): DedupedIssue {
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
    duplicateCount: 0,
    ...overrides
  } as DedupedIssue;
}
