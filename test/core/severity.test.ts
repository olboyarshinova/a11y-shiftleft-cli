import test from "node:test";
import assert from "node:assert/strict";
import { triageIssues } from "../../dist/core/severity.js";

test("triageIssues maps axe impact to severity", () => {
  const issues = triageIssues([
    { ruleId: "image-alt", impact: "critical" },
    { ruleId: "color-contrast", impact: "serious" },
    { ruleId: "landmark-one-main", impact: "moderate" },
    { ruleId: "html-has-lang", impact: "minor" }
  ]);

  assert.deepEqual(issues.map((issue) => issue.severity), [
    "critical",
    "critical",
    "warning",
    "info"
  ]);
});

test("triageIssues preserves explicit severity", () => {
  const [issue] = triageIssues([
    {
      source: "axe",
      framework: "react",
      ruleId: "color-contrast",
      wcag: ["1.4.3"],
      wcagCriteria: [{
        id: "1.4.3",
        title: "Contrast (Minimum)",
        level: "AA",
        principle: "perceivable",
        introducedIn: "2.0",
        url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
      }],
      tags: ["wcag143"],
      selector: ".button",
      message: "Elements must meet contrast requirements",
      impact: "serious",
      severity: "warning"
    }
  ]);

  assert.equal(issue.severity, "warning");
  assert.equal(issue.confidence, "high");
  assert.equal(issue.category, "contrast");
});

test("triageIssues infers severity from rule hints", () => {
  const issues = triageIssues([
    { ruleId: "jsx-a11y/label-has-associated-control" },
    { ruleId: "jsx-a11y/alt-text" },
    { ruleId: "unknown-rule" }
  ]);

  assert.deepEqual(issues.map((issue) => issue.severity), [
    "critical",
    "warning",
    "info"
  ]);
});
