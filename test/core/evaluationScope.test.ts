import test from "node:test";
import assert from "node:assert/strict";
import { createEvaluationScopeManifest } from "../../dist/core/evaluationScope.js";
import type { A11yReport } from "../../dist/types.js";

test("createEvaluationScopeManifest records WCAG-EM-inspired browser exploration scope", () => {
  const report = {
    generatedAt: "2026-06-25T00:00:00.000Z",
    summary: {
      framework: "react",
      urls: ["https://example.com"],
      bySource: { axe: 2, keyboard: 1 },
      standard: {
        id: "en301549",
        label: "EN 301 549 web support mode",
        wcagVersion: "2.1",
        wcagLevel: "AA",
        automatedCoverage: "partial",
        requiresManualReview: true,
        evidenceGaps: [
          "PDF, office document, and non-HTML document accessibility evidence",
          "Software outside the browser, native app, and platform accessibility evidence"
        ],
        disclaimer: "Manual review is required."
      },
      plannedScope: {
        version: 1,
        generatedAt: "2026-06-25T00:00:00.000Z",
        product: {
          type: "web application",
          languages: ["en"]
        },
        target: {
          standard: "section508",
          urls: ["https://example.com"]
        },
        supportedPlatforms: ["Desktop Chrome"],
        assistiveTechnologies: ["Keyboard only"],
        representativeSample: [{
          type: "Search results",
          url: "https://example.com/search",
          reason: "Critical listing page"
        }],
        randomSample: [],
        criticalJourneys: [{
          name: "Search",
          urls: ["https://example.com/search"]
        }],
        thirdPartyContent: [],
        exclusions: [],
        notes: []
      }
    },
    issues: [
      { stateId: "state-2", ruleId: "color-contrast" },
      { stateId: "state-2", ruleId: "button-name" },
      { stateId: "state-1", ruleId: "page-has-heading-one" }
    ],
    exploration: {
      generatedAt: "2026-06-25T00:00:00.000Z",
      startUrl: "https://example.com",
      states: [{
        id: "state-1",
        url: "https://example.com",
        depth: 0,
        fingerprint: "one",
        actionLabel: "Initial page",
        issueCount: 1,
        actionCount: 1
      }, {
        id: "state-2",
        url: "https://example.com/menu",
        title: "Menu",
        depth: 1,
        fingerprint: "two",
        actionLabel: "Open menu",
        issueCount: 2,
        actionCount: 0
      }],
      edges: [],
      skippedActions: [],
      summary: {
        statesVisited: 2,
        pagesVisited: 2,
        actionsTried: 1,
        skippedActions: 0,
        screenshots: 2,
        maxDepth: 2,
        maxStates: 20
      }
    },
    keyboard: { steps: [] },
    manualChecklist: {
      generatedAt: "2026-06-25T00:00:00.000Z",
      framework: "react",
      urls: ["https://example.com"],
      items: [{
        id: "task-completion-worksheet",
        title: "Task completion evidence worksheet",
        principle: "understandable",
        wcag: ["2.1.1"],
        whyManual: "Task completion requires human review.",
        steps: ["Complete search with keyboard."],
        evidence: ["Task notes"],
        review: {
          status: "pass",
          tester: "",
          testedAt: "",
          environment: "",
          notes: "",
          evidenceLinks: [],
          remediationOwner: "",
          stepReviews: [{
            index: 1,
            step: "Complete search with keyboard.",
            status: "pass",
            notes: "Completed.",
            evidenceLinks: ["reports/manual/search.png"]
          }],
          taskEvidence: [{
            kind: "screenshot",
            label: "Search task evidence",
            url: "reports/manual/search.png",
            notes: "No personal data.",
            redacted: true
          }]
        }
      }]
    },
    lighthouse: [{}]
  } as unknown as A11yReport;

  const manifest = createEvaluationScopeManifest(report);

  assert.equal(manifest.methodology.conformanceClaim, false);
  assert.equal(manifest.target.standard?.id, "en301549");
  assert.deepEqual(manifest.target.standard?.evidenceGaps, [
    "PDF, office document, and non-HTML document accessibility evidence",
    "Software outside the browser, native app, and platform accessibility evidence"
  ]);
  assert.equal(manifest.plannedScope?.criticalJourneys[0].name, "Search");
  assert.equal(manifest.sample.strategy, "browser-exploration");
  assert.deepEqual(manifest.sample.discoveredUrls, ["https://example.com", "https://example.com/menu"]);
  assert.equal(manifest.sample.maxDepth, 2);
  assert.equal(manifest.sample.representativeStates[0].id, "state-2");
  assert.equal(manifest.sample.representativeStates[0].findingCount, 2);
  assert.deepEqual(manifest.evidence.automatedSources, ["axe", "keyboard"]);
  assert.equal(manifest.evidence.visualExploration, true);
  assert.equal(manifest.evidence.keyboardTraversal, true);
  assert.equal(manifest.evidence.lighthouseComparison, true);
  assert.equal(manifest.reviewStatus.manualReviewItems, 1);
  assert.equal(manifest.reviewStatus.manualReviewCompleted, 1);
  assert.equal(manifest.reviewStatus.manualStepRecords, 1);
  assert.equal(manifest.reviewStatus.manualStepsCompleted, 1);
  assert.equal(manifest.reviewStatus.manualTaskEvidenceAttachments, 1);
  assert.equal(manifest.reviewStatus.manualRedactedTaskEvidence, 1);
  assert.equal(manifest.reviewStatus.needsHumanEvaluation, true);
});
