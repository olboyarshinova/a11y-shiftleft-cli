import test from "node:test";
import assert from "node:assert/strict";
import {
  createTicketDrafts,
  ticketDraftsToMarkdown
} from "../../dist/core/ticketDrafts.js";
import type { A11yReport, DedupedIssue } from "../../dist/types.js";

test("createTicketDrafts groups findings by severity, rule, page, and target", () => {
  const report = reportWithIssues([
    issue({
      ruleId: "button-name",
      selector: "#menu",
      duplicateCount: 2
    }),
    issue({
      ruleId: "button-name",
      selector: "#menu"
    }),
    issue({
      ruleId: "color-contrast",
      selector: ".cta",
      severity: "critical"
    }),
    issue({
      ruleId: "page-has-heading-one",
      selector: "html",
      severity: "info"
    })
  ]);

  const drafts = createTicketDrafts(report, {
    tracker: "jira",
    minSeverity: "warning"
  });

  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].ruleId, "color-contrast");
  assert.equal(drafts[0].severity, "critical");
  assert.equal(drafts[1].ruleId, "button-name");
  assert.equal(drafts[1].count, 4);
  assert.deepEqual(drafts[1].labels.slice(0, 2), ["a11y", "accessibility"]);
  assert.match(drafts[1].body, /Give every button an accessible name/);
});

test("createTicketDrafts supports max ticket limits and Linear labels", () => {
  const report = reportWithIssues([
    issue({ ruleId: "button-name", selector: "#menu" }),
    issue({ ruleId: "color-contrast", selector: ".cta", severity: "critical" })
  ]);

  const drafts = createTicketDrafts(report, {
    tracker: "linear",
    minSeverity: "info",
    maxTickets: 1
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].ruleId, "color-contrast");
  assert.equal(drafts[0].labels[0], "A11y");
});

test("ticketDraftsToMarkdown renders dry-run ticket content", () => {
  const report = reportWithIssues([
    issue({ ruleId: "button-name", selector: "#menu" })
  ]);
  const drafts = createTicketDrafts(report);

  const markdown = ticketDraftsToMarkdown(drafts, report);

  assert.match(markdown, /# Accessibility Ticket Drafts/);
  assert.match(markdown, /These are dry-run ticket drafts/);
  assert.match(markdown, /\[a11y\]\[warning\] button-name/);
  assert.match(markdown, /### Suggested Fix/);
});

function reportWithIssues(issues: DedupedIssue[]): A11yReport {
  return {
    generatedAt: "2026-06-13T00:00:00.000Z",
    summary: {
      total: issues.length,
      critical: issues.filter((issue) => issue.severity === "critical").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
      rawCount: issues.length,
      uniqueCount: issues.length,
      duplicateCount: 0,
      duplicateRate: 0,
      scanDurationMs: 100,
      framework: "react",
      urls: ["http://localhost:3000"],
      complianceEvidence: {
        automatedCoverage: "partial",
        requiresManualReview: true,
        totalFindings: issues.length,
        wcagMappedFindings: issues.filter((issue) => issue.wcag.length > 0).length,
        unmappedFindings: issues.filter((issue) => issue.wcag.length === 0).length,
        affectedPages: 1,
        topAffectedPages: []
      },
      bySource: {},
      bySeverity: {},
      byConfidence: {},
      byCategory: {},
      byPour: {},
      byWcagLevel: {},
      byWcagVersion: {},
      byUnmappedRule: {},
      byPage: []
    },
    issues
  };
}

function issue(overrides: Partial<DedupedIssue> = {}): DedupedIssue {
  return {
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    wcag: ["4.1.2"],
    wcagCriteria: [{
      id: "4.1.2",
      title: "Name, Role, Value",
      level: "A",
      principle: "robust",
      introducedIn: "2.0",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    }],
    tags: [],
    severity: "warning",
    confidence: "high",
    confidenceScore: 95,
    confidenceReason: "Detected by axe.",
    category: "aria",
    selector: "#menu",
    url: "http://localhost:3000",
    message: "Give every button an accessible name.",
    remediation: {
      summary: "Give every button an accessible name.",
      howToFix: [
        "Use visible button text when possible.",
        "For icon-only buttons, add aria-label or aria-labelledby."
      ],
      docs: [
        "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
      ]
    },
    fingerprint: "axe:button-name:http://localhost:3000:#menu",
    duplicateCount: 0,
    ...overrides
  };
}
