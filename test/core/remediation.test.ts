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

test("getRemediationHint always returns guidance for unmapped rules", () => {
  const hint = getRemediationHint("custom-unmapped-rule", [], "unknown", {
    helpUrl: "https://dequeuniversity.com/rules/axe/4.11/custom-unmapped-rule"
  });

  assert.match(hint.summary, /custom-unmapped-rule/);
  assert.equal(hint.howToFix.length, 3);
  assert.deepEqual(hint.docs, [
    "https://dequeuniversity.com/rules/axe/4.11/custom-unmapped-rule"
  ]);
});

test("getRemediationHint explains how to recover adapter failures", () => {
  const hint = getRemediationHint("adapter/axe-scan-error");

  assert.match(hint.summary, /scanner setup/);
  assert.match(hint.howToFix[0], /target URL/);
});

test("normalizeIssue attaches remediation hints", () => {
  const issue = normalizeIssue({
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    tags: ["wcag412", "cat.name-role-value"],
    message: "Buttons must have discernible text"
  });

  assert.deepEqual(issue.tags, ["wcag412", "cat.name-role-value"]);
  assert.equal(issue.remediation?.summary.includes("accessible name"), true);
  assert.equal(issue.remediation?.frameworkExamples?.react?.includes("aria-label"), true);
});

test("normalizeIssue preserves axe help URLs in remediation guidance", () => {
  const helpUrl = "https://dequeuniversity.com/rules/axe/4.11/button-name";
  const issue = normalizeIssue({
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    tags: ["wcag412"],
    helpUrl,
    message: "Buttons must have discernible text"
  });

  assert.equal(issue.helpUrl, helpUrl);
  assert.equal(issue.remediation?.docs[0], helpUrl);
});

test("normalizeIssue preserves visual element bounds", () => {
  const issue = normalizeIssue({
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    elementBounds: {
      x: 10,
      y: 20,
      width: 30,
      height: 12,
      coordinateSpace: "viewport"
    },
    message: "Buttons must have discernible text"
  });

  assert.deepEqual(issue.elementBounds, {
    x: 10,
    y: 20,
    width: 30,
    height: 12,
    coordinateSpace: "viewport"
  });
});

test("getRemediationHint explains page heading best-practice rules", () => {
  const hint = getRemediationHint("page-has-heading-one", [], "angular");

  assert.equal(hint?.summary.includes("h1"), true);
  assert.equal(hint?.frameworkExamples?.angular?.includes("<h1>"), true);
  assert.equal(hint?.docs.some((url) => url.includes("headings")), true);
});

test("getRemediationHint explains Angular button type findings", () => {
  const hint = getRemediationHint("@angular-eslint/template/button-has-type", [], "angular");

  assert.equal(hint?.summary.includes("type"), true);
  assert.equal(hint?.frameworkExamples?.angular?.includes("type=\"button\""), true);
});

test("getRemediationHint explains document metadata findings", () => {
  const titleHint = getRemediationHint("document-title", getWcagCriteria(["2.4.2"]), "react");
  const langHint = getRemediationHint("html-has-lang", getWcagCriteria(["3.1.1"]), "react");

  assert.equal(titleHint?.summary.includes("title"), true);
  assert.equal(titleHint?.docs.some((url) => url.includes("page-titled")), true);
  assert.equal(langHint?.summary.includes("language"), true);
  assert.equal(langHint?.frameworkExamples?.react?.includes("lang=\"en\""), true);
});

test("getRemediationHint explains ARIA validation findings", () => {
  const hint = getRemediationHint("aria-valid-attr-value", getWcagCriteria(["4.1.2"]), "unknown");

  assert.equal(hint?.summary.includes("valid values"), true);
  assert.equal(hint?.howToFix.some((step) => step.includes("aria-*")), true);
  assert.equal(hint?.docs.some((url) => url.includes("name-role-value")), true);
});

test("getRemediationHint explains form input purpose and naming findings", () => {
  const autocompleteHint = getRemediationHint("autocomplete-valid", getWcagCriteria(["1.3.5"]), "vue");
  const selectHint = getRemediationHint("select-name", getWcagCriteria(["4.1.2"]), "angular");

  assert.equal(autocompleteHint?.summary.includes("autocomplete"), true);
  assert.equal(autocompleteHint?.frameworkExamples?.vue?.includes("autocomplete=\"email\""), true);
  assert.equal(selectHint?.summary.includes("select"), true);
  assert.equal(selectHint?.frameworkExamples?.angular?.includes("<select"), true);
});

test("getRemediationHint explains heading and list structure findings", () => {
  const headingHint = getRemediationHint("heading-order", getWcagCriteria(["1.3.1"]), "react");
  const listHint = getRemediationHint("listitem", getWcagCriteria(["1.3.1"]), "unknown");

  assert.equal(headingHint?.summary.includes("logical order"), true);
  assert.equal(headingHint?.frameworkExamples?.react?.includes("<h2>"), true);
  assert.equal(listHint?.summary.includes("inside semantic lists"), true);
  assert.equal(listHint?.docs.some((url) => url.includes("info-and-relationships")), true);
});
