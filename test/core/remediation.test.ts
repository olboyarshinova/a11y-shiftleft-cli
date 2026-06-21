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

test("normalizeIssue restores display metadata for previously unmapped axe checks", () => {
  const checks = [
    ["audio-caption", "wcag121", "1.2.1"],
    ["video-caption", "wcag122", "1.2.2"],
    ["css-orientation-lock", "wcag134", "1.3.4"],
    ["link-in-text-block", "wcag141", "1.4.1"],
    ["no-autoplay-audio", "wcag142", "1.4.2"],
    ["meta-viewport", "wcag144", "1.4.4"],
    ["avoid-inline-spacing", "wcag1412", "1.4.12"],
    ["meta-refresh", "wcag221", "2.2.1"],
    ["blink", "wcag222", "2.2.2"],
    ["bypass", "wcag241", "2.4.1"],
    ["label-content-name-mismatch", "wcag253", "2.5.3"],
    ["valid-lang", "wcag312", "3.1.2"]
  ] as const;

  for (const [ruleId, tag, criterionId] of checks) {
    const issue = normalizeIssue({
      source: "axe",
      framework: "unknown",
      ruleId,
      wcag: [tag],
      selector: "#example",
      message: `Example ${ruleId} finding`
    });

    assert.deepEqual(issue.wcag, [criterionId]);
    assert.equal(issue.wcagCriteria[0]?.id, criterionId);
    assert.equal(issue.remediation?.docs.some((url) => url.includes("w3.org/WAI/WCAG22")), true);
  }
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

test("getRemediationHint explains reflow and clipped text findings", () => {
  const overflow = getRemediationHint("layout-horizontal-overflow", getWcagCriteria(["1.4.10"]), "react");
  const clipped = getRemediationHint("layout-clipped-text", getWcagCriteria(["1.4.10"]), "unknown");

  assert.match(overflow.summary, /320 CSS pixel/);
  assert.equal(overflow.docs.some((url) => url.includes("reflow")), true);
  assert.match(clipped.summary, /clipped/);
  assert.equal(clipped.howToFix.some((step) => step.includes("fixed heights")), true);
});

test("getRemediationHint explains invalid field error association", () => {
  const hint = getRemediationHint(
    "form-invalid-error-not-associated",
    getWcagCriteria(["3.3.1", "3.3.2"]),
    "unknown"
  );

  assert.match(hint.summary, /invalid field/);
  assert.equal(hint.howToFix.some((step) => step.includes("aria-errormessage")), true);
  assert.equal(hint.docs.some((url) => url.includes("error-identification")), true);
});

test("getRemediationHint explains alternative-text quality findings", () => {
  const filename = getRemediationHint("image-alt-filename", getWcagCriteria(["1.1.1"]), "react");
  const duplicate = getRemediationHint("image-alt-duplicates-nearby-text", getWcagCriteria(["1.1.1"]), "react");

  assert.match(filename.summary, /filename/);
  assert.equal(filename.docs.some((url) => url.includes("non-text-content")), true);
  assert.match(duplicate.summary, /same nearby label twice/);
});

test("getRemediationHint explains media evidence findings", () => {
  const captions = getRemediationHint("media-video-captions-not-detected", getWcagCriteria(["1.2.2"]), "unknown");
  const autoplay = getRemediationHint("media-autoplay-control-risk", getWcagCriteria(["1.4.2"]), "unknown");

  assert.match(captions.summary, /captions/);
  assert.equal(captions.howToFix.some((step) => step.includes("captions track")), true);
  assert.match(autoplay.summary, /autoplay/);
});

test("getRemediationHint explains embedded content findings", () => {
  const canvas = getRemediationHint("canvas-alternative-not-detected", getWcagCriteria(["1.1.1"]), "unknown");
  const frame = getRemediationHint("iframe-scan-unavailable", [], "unknown");

  assert.match(canvas.summary, /canvas/);
  assert.equal(canvas.howToFix.some((step) => step.includes("fallback")), true);
  assert.match(frame.summary, /embedded document/);
});

test("getRemediationHint explains modal focus findings", () => {
  const name = getRemediationHint("modal-accessible-name-missing", getWcagCriteria(["4.1.2"]), "react");
  const initial = getRemediationHint("modal-initial-focus-outside", getWcagCriteria(["2.4.3"]), "react");
  const restored = getRemediationHint("modal-focus-not-restored", getWcagCriteria(["2.4.3"]), "react");
  const escape = getRemediationHint("modal-escape-no-effect", [], "react");

  assert.match(name.summary, /accessible name/);
  assert.match(initial.summary, /inside the dialog/);
  assert.match(restored.summary, /Restore focus/);
  assert.equal(escape.docs.some((url) => url.includes("dialog-modal")), true);
});

test("getRemediationHint explains Angular button type findings", () => {
  const hint = getRemediationHint("@angular-eslint/template/button-has-type", [], "angular");

  assert.equal(hint?.summary.includes("type"), true);
  assert.equal(hint?.frameworkExamples?.angular?.includes("type=\"button\""), true);
});

test("getRemediationHint explains keyboard focus loss and unreachable controls", () => {
  const lostFocus = getRemediationHint("keyboard-focus-lost", getWcagCriteria(["2.1.1", "2.4.3"]), "unknown");
  const unreachable = getRemediationHint("keyboard-control-unreachable", getWcagCriteria(["2.1.1"]), "react");

  assert.match(lostFocus.summary, /meaningful interactive target/);
  assert.equal(lostFocus.docs.some((url) => url.includes("focus-order")), true);
  assert.match(unreachable.summary, /reachable/);
  assert.equal(unreachable.howToFix.some((step) => step.includes("tabindex")), true);
});

test("getRemediationHint explains stateful keyboard activation failures", () => {
  const hint = getRemediationHint("keyboard-activation-no-effect", getWcagCriteria(["2.1.1"]), "unknown");

  assert.match(hint.summary, /documented keyboard interaction/);
  assert.equal(hint.docs.some((url) => url.includes("ARIA/apg")), true);
});

test("getRemediationHint explains document metadata findings", () => {
  const titleHint = getRemediationHint("document-title", getWcagCriteria(["2.4.2"]), "react");
  const langHint = getRemediationHint("html-has-lang", getWcagCriteria(["3.1.1"]), "react");

  assert.equal(titleHint?.summary.includes("title"), true);
  assert.equal(titleHint?.docs.some((url) => url.includes("page-titled")), true);
  assert.equal(langHint?.summary.includes("language"), true);
  assert.equal(langHint?.frameworkExamples?.react?.includes("lang=\"en\""), true);
});

test("getRemediationHint explains cross-page title findings", () => {
  const duplicateHint = getRemediationHint(
    "page-title-duplicate",
    getWcagCriteria(["2.4.2"]),
    "unknown"
  );
  const placeholderHint = getRemediationHint(
    "page-title-placeholder",
    getWcagCriteria(["2.4.2"]),
    "react"
  );

  assert.match(duplicateHint.summary, /each distinct page/);
  assert.match(duplicateHint.howToFix[0], /page-specific description/);
  assert.match(placeholderHint.summary, /starter template title/);
  assert.match(placeholderHint.howToFix[0], /Vite \+ React/);
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
