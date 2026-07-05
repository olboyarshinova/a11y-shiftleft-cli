import test from "node:test";
import assert from "node:assert/strict";
import { summarizeWcagCoverage } from "../../dist/core/wcagCoverage.js";
import { getWcagCriteria } from "../../dist/core/wcagMap.js";
import type { DedupedIssue, ManualChecklist, ReportAuditTrail } from "../../dist/types.js";

test("summarizeWcagCoverage separates automated, heuristic, and manual evidence", () => {
  const coverage = summarizeWcagCoverage({
    issues: [
      issue("axe", "color-contrast", "1.4.3"),
      issue("layout", "layout-horizontal-overflow", "1.4.10")
    ],
    targetVersion: "2.2",
    targetLevel: "AA",
    auditTrail: auditTrail({
      browserAutomation: true,
      staticAnalysis: false,
      keyboardTraversal: true,
      lighthouseComparison: false,
      manualChecklist: true
    }),
    exploration: {
      startUrl: "http://localhost:3000",
      generatedAt: "2026-07-05T00:00:00.000Z",
      states: [{
        id: "state-1",
        url: "http://localhost:3000",
        depth: 0,
        fingerprint: "state-1",
        actionLabel: "Initial page",
        issueCount: 1,
        actionCount: 0,
        reflow: {
          viewportWidth: 320,
          viewportHeight: 640,
          documentWidth: 360,
          horizontalOverflowPx: 40,
          clippedTextCount: 0,
          clippedTextSample: []
        }
      }],
      edges: [],
      skippedActions: [],
      summary: {
        statesVisited: 1,
        actionsTried: 0,
        skippedActions: 0,
        screenshots: 0,
        maxDepth: 1,
        maxStates: 10
      }
    },
    manualChecklist: manualChecklist(["3.3.3"])
  });

  assert.equal(coverage.label, "Tracked WCAG evidence coverage");
  assert.equal(coverage.targetVersion, "2.2");
  assert.equal(coverage.targetLevel, "AA");
  assert.equal(coverage.totalCriteria > 0, true);
  assert.equal(coverage.automatedCriteria > 0, true);
  assert.equal(coverage.heuristicCriteria > 0, true);
  assert.equal(coverage.manualCriteria, 1);
  assert.equal(coverage.assistedCoverage > coverage.automatedCoverage, true);

  const contrast = coverage.criteria.find((criterion) => criterion.id === "1.4.3");
  assert.equal(contrast?.status, "automated");
  assert.equal(contrast?.findingCount, 1);
  assert.deepEqual(contrast?.evidenceSources.includes("browser automation"), true);

  const reflow = coverage.criteria.find((criterion) => criterion.id === "1.4.10");
  assert.equal(reflow?.status, "heuristic");
  assert.equal(reflow?.findingCount, 1);
  assert.deepEqual(reflow?.evidenceSources.includes("400% reflow heuristic"), true);

  const errorSuggestion = coverage.criteria.find((criterion) => criterion.id === "3.3.3");
  assert.equal(errorSuggestion?.status, "manual-required");
  assert.equal(errorSuggestion?.nextStep, "Complete the manual checklist item.");
});

function issue(source: string, ruleId: string, criterionId: string): DedupedIssue {
  const [criterion] = getWcagCriteria([criterionId]);

  return {
    source,
    framework: "react",
    ruleId,
    message: `${ruleId} finding`,
    wcag: [criterionId],
    wcagCriteria: criterion ? [criterion] : [],
    tags: [],
    severity: "warning",
    confidence: "high",
    confidenceScore: 95,
    confidenceReason: "test fixture",
    findingType: "wcag",
    category: "aria",
    fingerprint: `${source}:${ruleId}:${criterionId}`,
    duplicateCount: 0
  };
}

function auditTrail(automation: ReportAuditTrail["automation"]): ReportAuditTrail {
  return {
    version: 1,
    tool: {
      name: "a11y-shiftleft-cli",
      version: "0.7.2",
      nodeVersion: "v22.22.2"
    },
    command: {
      name: "audit",
      profile: "full-audit"
    },
    requestedUrls: ["http://localhost:3000"],
    includedUrls: ["http://localhost:3000"],
    outputFormats: ["json", "markdown"],
    generatedFiles: ["a11y-report.json", "a11y-comment.md"],
    automation,
    boundaries: ["Automated coverage is partial."]
  };
}

function manualChecklist(criteria: string[]): ManualChecklist {
  return {
    generatedAt: "2026-07-05T00:00:00.000Z",
    framework: "react",
    urls: ["http://localhost:3000"],
    items: criteria.map((criterion) => ({
      id: `manual-${criterion}`,
      title: `Manual review ${criterion}`,
      principle: "understandable",
      wcag: [criterion],
      whyManual: "Requires human review.",
      steps: ["Review manually."],
      evidence: ["Notes."],
      review: {
        status: "not-reviewed",
        tester: "",
        testedAt: "",
        environment: "",
        notes: "",
        evidenceLinks: [],
        remediationOwner: ""
      }
    }))
  };
}
