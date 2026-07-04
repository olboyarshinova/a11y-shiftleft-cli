import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSampleComparison } from "../../dist/core/sampleComparison.js";
import type { DedupedIssue, PlannedEvaluationScope } from "../../dist/types.js";

test("summarizeSampleComparison reports random-only issue types", () => {
  const scope: PlannedEvaluationScope = {
    version: 1,
    generatedAt: "2026-07-02T00:00:00.000Z",
    product: {
      type: "content site",
      languages: ["en"]
    },
    target: {
      standard: "wcag22-aa",
      urls: ["https://example.com"]
    },
    supportedPlatforms: ["Desktop browser"],
    assistiveTechnologies: ["Keyboard only"],
    representativeSample: [{
      type: "Core page",
      url: "https://example.com/",
      reason: "Primary page"
    }],
    randomSample: [{
      type: "Random article",
      url: "https://example.com/blog/random",
      reason: "Control page"
    }],
    criticalJourneys: [],
    thirdPartyContent: [],
    exclusions: [],
    notes: []
  };
  const issues = [{
    url: "https://example.com/",
    ruleId: "color-contrast",
    severity: "warning"
  }, {
    url: "https://example.com/blog/random#section",
    ruleId: "heading-order",
    severity: "warning"
  }] as DedupedIssue[];

  const comparison = summarizeSampleComparison(issues, scope);

  assert.equal(comparison?.enabled, true);
  assert.equal(comparison?.representativeSampleSize, 1);
  assert.equal(comparison?.randomSampleSize, 1);
  assert.equal(comparison?.structuredFindingCount, 1);
  assert.equal(comparison?.randomFindingCount, 1);
  assert.deepEqual(comparison?.uniqueRandomRules, ["heading-order"]);
  assert.match(comparison?.recommendation || "", /Expand the representative sample/);
});
