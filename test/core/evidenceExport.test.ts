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
  assert.deepEqual(evidence.provenance.command, { name: "audit", profile: "validation" });
  assert.deepEqual(evidence.provenance.requestedUrls, ["https://example.test"]);
  assert.equal(evidence.provenance.automation?.browserAutomation, true);
  assert.equal(evidence.provenance.standard?.id, "wcag22-aa");
  assert.equal(evidence.review?.manualChecklist?.total, 1);
  assert.equal(evidence.review?.manualChecklist?.fail, 1);
  assert.equal(evidence.review?.manualChecklist?.targetCount, 1);
  assert.equal(evidence.review?.manualChecklist?.journeyTargetCount, 1);
  assert.equal(evidence.review?.journeys?.[0]?.name, "Checkout");
  assert.equal(evidence.review?.journeys?.[0]?.findingCount, 1);
  assert.equal(evidence.summary.total, 2);
  assert.equal(evidence.summary.critical, 1);
  assert.equal(evidence.summary.wcagMapped, 1);
  assert.equal(evidence.summary.needsReview, 1);
  assert.equal(evidence.summary.duplicateOccurrences, 2);
  assert.equal(evidence.summary.baselineNew, 1);
  assert.equal(evidence.summary.baselineExisting, 1);
  assert.equal(evidence.summary.retestNew, 1);
  assert.equal(evidence.summary.retestRemaining, 1);
  assert.deepEqual(evidence.summary.bySource, { axe: 2 });
  assert.deepEqual(evidence.summary.byCategory, { semantics: 1, contrast: 1 });
  assert.deepEqual(evidence.summary.byConfidence, { high: 1, medium: 1 });
  assert.deepEqual(evidence.summary.byFindingType, { wcag: 1, "needs-review": 1 });
  assert.deepEqual(evidence.summary.byUrl, { "https://example.test": 1 });
  assert.deepEqual(evidence.summary.byWcagCriterion, { "4.1.2": 1 });
  assert.deepEqual(evidence.summary.byWcagLevel, { A: 1 });
  assert.match(evidence.records[0]?.id || "", /^finding-[a-f0-9]{16}$/);
  assert.equal(evidence.records[0]?.id, createEvidenceExport(report(), "2026-07-15T00:00:00.000Z").records[0]?.id);
  assert.equal(evidence.records[0]?.wcag[0]?.id, "4.1.2");
  assert.equal(evidence.records[0]?.ownership?.kind, "first-party");
  assert.equal(evidence.records[0]?.confidence?.score, 95);
  assert.equal(evidence.records[0]?.duplicateCount, 2);
  assert.equal(evidence.records[0]?.baselineStatus, "new");
  assert.equal(evidence.records[0]?.retestStatus, "remaining");
  assert.deepEqual(evidence.records[0]?.remediation?.howToFix, ["Add accessible text."]);
});

test("serializeEvidenceExport supports JSON, JSONL, and JSON-LD", () => {
  const evidence = createEvidenceExport(report(), "2026-07-14T00:00:00.000Z");
  const json = serializeEvidenceExport(evidence, "json");
  const jsonl = serializeEvidenceExport(evidence, "jsonl");
  const jsonld = serializeEvidenceExport(evidence, "jsonld");

  assert.equal(JSON.parse(json).records.length, 2);
  const lines = jsonl.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).generatedAt, "2026-07-14T00:00:00.000Z");
  assert.equal(JSON.parse(lines[0]).provenance.command.name, "audit");
  assert.equal(JSON.parse(lines[0]).provenance.standard.id, "wcag22-aa");
  assert.match(JSON.parse(lines[0]).id, /^finding-[a-f0-9]{16}$/);
  assert.equal(JSON.parse(lines[0]).ruleId, "button-name");
  assert.equal(JSON.parse(lines[0]).duplicateCount, 2);
  assert.equal(JSON.parse(lines[0]).baselineStatus, "new");
  assert.equal(JSON.parse(lines[0]).retestStatus, "remaining");
  const linkedData = JSON.parse(jsonld);
  assert.equal(linkedData["@type"], "schema:Dataset");
  assert.equal(linkedData["schema:identifier"], "a11y-shiftleft-evidence-v1");
  assert.equal(linkedData["a11y:provenance"].command.name, "audit");
  assert.equal(linkedData["a11y:provenance"].standard.id, "wcag22-aa");
  assert.equal(linkedData["a11y:review"].manualChecklist.total, 1);
  assert.equal(linkedData["a11y:review"].journeys[0].name, "Checkout");
  assert.equal(linkedData["a11y:summary"].baselineNew, 1);
  assert.equal(linkedData["a11y:summary"].retestRemaining, 1);
  assert.deepEqual(linkedData["a11y:summary"].byCategory, { semantics: 1, contrast: 1 });
  assert.deepEqual(linkedData["a11y:summary"].byWcagCriterion, { "4.1.2": 1 });
  assert.equal(linkedData["earl:assertions"].length, 2);
  assert.equal(linkedData["earl:assertions"][0]["@id"], `a11y:${evidence.records[0]?.id}`);
  assert.equal(linkedData["earl:assertions"][0]["earl:result"]["earl:outcome"], "earl:failed");
  assert.equal(linkedData["earl:assertions"][0]["earl:result"]["a11y:duplicateCount"], 2);
  assert.equal(linkedData["earl:assertions"][0]["earl:result"]["a11y:baselineStatus"], "new");
  assert.equal(linkedData["earl:assertions"][0]["earl:result"]["a11y:retestStatus"], "remaining");
  assert.equal(linkedData["earl:assertions"][1]["earl:result"]["earl:outcome"], "earl:cantTell");
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
      standard: {
        id: "wcag22-aa",
        label: "WCAG 2.2 AA support mode",
        wcagVersion: "2.2",
        wcagLevel: "AA",
        automatedCoverage: "partial",
        requiresManualReview: true,
        disclaimer: "Automated evidence is not a conformance claim."
      },
      journeyImpact: [{
        name: "Checkout",
        urls: ["https://example.test"],
        findingCount: 1,
        critical: 1,
        warning: 0,
        info: 0
      }],
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
    manualChecklist: {
      generatedAt: "2026-07-13T00:00:00.000Z",
      framework: "react",
      urls: ["https://example.test"],
      items: [{
        id: "task-completion-worksheet",
        title: "Task completion worksheet",
        principle: "understandable",
        wcag: ["3.3.2"],
        whyManual: "Representative tasks require human confirmation.",
        steps: ["Complete the checkout task with keyboard only."],
        evidence: ["Task outcome and blocker notes."],
        targets: [{
          id: "journey:Checkout",
          kind: "journey",
          label: "Checkout",
          url: "https://example.test",
          stateId: "state-1",
          evidence: "Planned critical journey"
        }],
        review: {
          status: "fail",
          tester: "QA",
          testedAt: "2026-07-13",
          environment: "Desktop browser",
          notes: "Keyboard-only checkout blocked.",
          evidenceLinks: [],
          remediationOwner: "Frontend"
        }
      }]
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
        duplicateCount: 2,
        baselineStatus: "new",
        retestStatus: "remaining"
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
        duplicateCount: 2,
        baselineStatus: "existing",
        retestStatus: "new"
      }
    ]
  };
}
