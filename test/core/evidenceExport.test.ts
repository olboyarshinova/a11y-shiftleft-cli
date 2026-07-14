import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvidenceExport,
  serializeEvidenceExport
} from "../../dist/core/evidenceExport.js";
import type { A11yReport } from "../../dist/types.js";

test("createEvidenceExport normalizes findings into portable evidence records", () => {
  const evidence = createEvidenceExport(report(), "2026-07-14T00:00:00.000Z");

  assert.equal(evidence.version, 1);
  assert.equal(evidence.localOnly, true);
  assert.equal(evidence.summary.total, 2);
  assert.equal(evidence.summary.critical, 1);
  assert.equal(evidence.summary.wcagMapped, 1);
  assert.equal(evidence.summary.needsReview, 1);
  assert.equal(evidence.records[0]?.wcag[0]?.id, "4.1.2");
  assert.equal(evidence.records[0]?.ownership?.kind, "first-party");
  assert.equal(evidence.records[0]?.confidence?.score, 95);
  assert.deepEqual(evidence.records[0]?.remediation?.howToFix, ["Add accessible text."]);
});

test("serializeEvidenceExport supports JSON and JSONL", () => {
  const evidence = createEvidenceExport(report(), "2026-07-14T00:00:00.000Z");
  const json = serializeEvidenceExport(evidence, "json");
  const jsonl = serializeEvidenceExport(evidence, "jsonl");

  assert.equal(JSON.parse(json).records.length, 2);
  const lines = jsonl.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).generatedAt, "2026-07-14T00:00:00.000Z");
  assert.equal(JSON.parse(lines[0]).ruleId, "button-name");
});

function report(): A11yReport {
  return {
    generatedAt: "2026-07-13T00:00:00.000Z",
    summary: {
      total: 2,
      critical: 1,
      warning: 1,
      info: 0,
      rawCount: 2,
      uniqueCount: 2,
      duplicateCount: 0,
      duplicateRate: 0,
      scanDurationMs: 120,
      framework: "react",
      urls: ["https://example.test"],
      auditTrail: {
        version: 1,
        tool: {
          name: "a11y-shiftleft-cli",
          version: "0.0.0-test",
          nodeVersion: "v22.0.0"
        },
        command: {
          name: "audit",
          profile: "validation"
        },
        requestedUrls: ["https://example.test"],
        includedUrls: ["https://example.test"],
        outputFormats: ["json"],
        generatedFiles: [],
        automation: {
          staticAnalysis: false,
          browserAutomation: true,
          keyboardTraversal: false,
          lighthouseComparison: false,
          manualChecklist: false
        },
        boundaries: ["Automated findings are evidence for triage."]
      },
      complianceEvidence: {
        totalFindings: 2,
        wcagMappedFindings: 1,
        needsReviewFindings: 1,
        bestPracticeFindings: 0,
        unmappedFindings: 1,
        affectedPages: 1,
        topAffectedPages: []
      },
      bySource: { axe: 2 },
      bySeverity: { critical: 1, warning: 1 },
      byConfidence: { high: 1, medium: 1 },
      byCategory: { semantics: 1, contrast: 1 },
      byPour: {},
      byWcagLevel: {},
      byWcagVersion: {},
      byUnmappedRule: {},
      byPage: []
    },
    issues: [
      {
        source: "axe",
        framework: "react",
        ruleId: "button-name",
        wcag: ["4.1.2"],
        wcagCriteria: [{
          id: "4.1.2",
          title: "Name, Role, Value",
          level: "A",
          principle: "Robust",
          introducedIn: "2.0",
          url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
        }],
        tags: ["wcag412"],
        severity: "critical",
        confidence: "high",
        confidenceScore: 95,
        confidenceReason: "Rendered DOM evidence.",
        findingType: "wcag",
        category: "semantics",
        message: "Buttons must have discernible text",
        selector: ".icon-button",
        url: "https://example.test",
        stateId: "state-1",
        ownership: {
          kind: "first-party",
          label: "First-party code"
        },
        remediation: {
          summary: "Name the button.",
          howToFix: ["Add accessible text."],
          docs: ["https://example.test/docs"]
        },
        fingerprint: "button-name::.icon-button",
        duplicateCount: 1
      },
      {
        source: "axe",
        framework: "react",
        ruleId: "color-contrast-needs-review",
        wcag: [],
        wcagCriteria: [],
        tags: [],
        severity: "warning",
        confidence: "medium",
        confidenceScore: 75,
        confidenceReason: "Complex background.",
        findingType: "needs-review",
        category: "contrast",
        message: "Potential contrast issue needs manual review",
        fingerprint: "color-review::.hero",
        duplicateCount: 1
      }
    ]
  };
}
