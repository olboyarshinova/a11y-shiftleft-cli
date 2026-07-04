import test from "node:test";
import assert from "node:assert/strict";
import { annotateIssuesWithJourneys, summarizeJourneyImpact } from "../../dist/core/journeyImpact.js";
import type { DedupedIssue, PlannedEvaluationScope } from "../../dist/types.js";

test("annotateIssuesWithJourneys links findings to planned journeys by normalized URL", () => {
  const scope: PlannedEvaluationScope = {
    version: 1,
    generatedAt: "2026-06-30T00:00:00.000Z",
    product: {
      type: "web application",
      languages: ["en"]
    },
    target: {
      standard: "wcag22-aa",
      urls: ["https://example.com"]
    },
    supportedPlatforms: ["Desktop browser"],
    assistiveTechnologies: ["Keyboard only"],
    representativeSample: [],
    randomSample: [],
    criticalJourneys: [{
      name: "Checkout",
      urls: ["https://example.com/cart/"]
    }, {
      name: "Account",
      urls: ["https://example.com/account"]
    }],
    thirdPartyContent: [],
    exclusions: [],
    notes: []
  };
  const issues = [{
    url: "https://example.com/cart/#summary",
    severity: "critical",
    ruleId: "color-contrast"
  }, {
    url: "https://example.com/help",
    severity: "warning",
    ruleId: "page-has-heading-one"
  }] as DedupedIssue[];

  const annotated = annotateIssuesWithJourneys(issues, scope);
  const impact = summarizeJourneyImpact(annotated, scope);

  assert.deepEqual(annotated[0].journeys, ["Checkout"]);
  assert.equal(annotated[1].journeys, undefined);
  assert.deepEqual(impact.map((journey) => ({
    name: journey.name,
    findingCount: journey.findingCount,
    critical: journey.critical,
    warning: journey.warning
  })), [{
    name: "Checkout",
    findingCount: 1,
    critical: 1,
    warning: 0
  }, {
    name: "Account",
    findingCount: 0,
    critical: 0,
    warning: 0
  }]);
});
