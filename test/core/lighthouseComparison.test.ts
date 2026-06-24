import test from "node:test";
import assert from "node:assert/strict";
import { compareLighthouseWithFindings } from "../../dist/core/lighthouseComparison.js";
import type { DedupedIssue, LighthouseAuditResult } from "../../dist/types.js";

test("compareLighthouseWithFindings separates matching and tool-specific signals", () => {
  const issues: DedupedIssue[] = [
    issue("axe", "color-contrast", "warning", "contrast"),
    issue("keyboard", "keyboard/focus-indicator-missing", "critical", "focus"),
    issue("eslint", "jsx-a11y/alt-text", "warning", "images")
  ];
  const lighthouse: LighthouseAuditResult[] = [{
    url: "http://localhost:3000",
    finalUrl: "http://localhost:3000/",
    accessibilityScore: 91,
    failedAudits: [
      {
        id: "color-contrast",
        title: "Background and foreground colors have sufficient contrast",
        score: 0,
        scoreDisplayMode: "binary"
      },
      {
        id: "aria-valid-attr",
        title: "ARIA attributes are valid",
        score: 0,
        scoreDisplayMode: "binary"
      }
    ],
    manualAudits: [],
    notApplicableAudits: 0,
    durationMs: 100
  }];

  assert.deepEqual(compareLighthouseWithFindings(issues, lighthouse), {
    matchingRuleIds: ["color-contrast"],
    lighthouseOnlyAudits: [{
      id: "aria-valid-attr",
      title: "ARIA attributes are valid",
      score: 0,
      scoreDisplayMode: "binary"
    }],
    pipelineOnlyRules: [
      {
        ruleId: "keyboard/focus-indicator-missing",
        count: 1,
        sources: ["keyboard"],
        highestSeverity: "critical",
        findingType: "wcag",
        category: "focus"
      },
      {
        ruleId: "jsx-a11y/alt-text",
        count: 1,
        sources: ["eslint"],
        highestSeverity: "warning",
        findingType: "wcag",
        category: "images"
      }
    ]
  });
});

function issue(
  source: string,
  ruleId: string,
  severity: DedupedIssue["severity"],
  category: DedupedIssue["category"]
): DedupedIssue {
  return {
    source,
    ruleId,
    severity,
    confidence: "high",
    confidenceScore: 95,
    confidenceReason: "Deterministic test fixture.",
    findingType: "wcag",
    category,
    wcag: [],
    wcagCriteria: [],
    message: ruleId,
    fingerprint: ruleId,
    duplicateCount: 0
  };
}
