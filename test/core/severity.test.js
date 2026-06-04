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
      ruleId: "color-contrast",
      impact: "serious",
      severity: "warning"
    }
  ]);

  assert.equal(issue.severity, "warning");
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
