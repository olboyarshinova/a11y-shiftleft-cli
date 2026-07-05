import test from "node:test";
import assert from "node:assert/strict";
import {
  createAxeNeedsReviewIssues,
  createIssuesFromAxeResults
} from "../../dist/core/axeResults.js";

test("createIssuesFromAxeResults keeps violations and marks incomplete contrast as needs review", () => {
  const issues = createIssuesFromAxeResults({
    violations: [{
      id: "button-name",
      impact: "critical",
      tags: ["wcag412"],
      help: "Buttons must have discernible text",
      helpUrl: "https://dequeuniversity.com/rules/axe/button-name",
      nodes: [{ target: ["button.icon"] }]
    }],
    incomplete: [{
      id: "color-contrast",
      impact: "serious",
      tags: ["wcag2aa", "wcag143"],
      help: "Elements must meet minimum color contrast ratio thresholds",
      helpUrl: "https://dequeuniversity.com/rules/axe/color-contrast",
      nodes: [{ target: [".hero-title"] }]
    }]
  }, {
    framework: "react",
    url: "https://example.com/",
    frames: []
  });

  assert.equal(issues.length, 2);
  assert.equal(issues[0].ruleId, "button-name");
  assert.equal(issues[0].findingType, undefined);
  assert.equal(issues[1].ruleId, "color-contrast");
  assert.equal(issues[1].findingType, "needs-review");
  assert.equal(issues[1].severity, "warning");
  assert.equal(issues[1].confidence, "low");
  assert.deepEqual(issues[1].wcag, ["wcag2aa", "wcag143"]);
  assert.match(issues[1].message || "", /manual review/i);
});

test("createAxeNeedsReviewIssues ignores unsupported incomplete rules for now", () => {
  const issues = createAxeNeedsReviewIssues([{
    id: "frame-tested",
    impact: "critical",
    tags: ["best-practice"],
    help: "Frames should be tested with axe-core",
    nodes: [{ target: ["iframe"] }]
  }], {
    framework: "unknown",
    url: "https://example.com/"
  });

  assert.deepEqual(issues, []);
});
