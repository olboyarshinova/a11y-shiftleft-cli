import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIssue } from "../../dist/core/normalize.js";
import { getRemediationHint } from "../../dist/core/remediation.js";
import { getWcagCriteria } from "../../dist/core/wcagMap.js";

test("getRemediationHint returns framework-specific examples for known rules", () => {
  const hint = getRemediationHint(
    "jsx-a11y/alt-text",
    getWcagCriteria(["1.1.1"]),
    "react"
  );

  assert.equal(hint?.summary.includes("alternative text"), true);
  assert.equal(hint?.frameworkExamples?.react?.includes("alt="), true);
  assert.equal(hint?.docs.some((url) => url.includes("non-text-content")), true);
});

test("getRemediationHint falls back to mapped WCAG documentation", () => {
  const hint = getRemediationHint(
    "custom-rule",
    getWcagCriteria(["1.4.3"]),
    "unknown"
  );

  assert.equal(hint?.summary.includes("WCAG success criteria"), true);
  assert.equal(hint?.howToFix[0], "Address WCAG 1.4.3 Contrast (Minimum).");
  assert.equal(hint?.docs[0].includes("contrast-minimum"), true);
});

test("normalizeIssue attaches remediation hints", () => {
  const issue = normalizeIssue({
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    message: "Buttons must have discernible text"
  });

  assert.equal(issue.remediation?.summary.includes("accessible name"), true);
  assert.equal(issue.remediation?.frameworkExamples?.react?.includes("aria-label"), true);
});
