import test from "node:test";
import assert from "node:assert/strict";
import {
  getWcagCriteria,
  mapRuleToWcag,
  matchesWcagLevel,
  matchesWcagVersion,
  normalizeWcagReferences
} from "../../dist/core/wcagMap.js";

const restoredAxeMappings = [
  ["audio-caption", "1.2.1", "Audio-only and Video-only (Prerecorded)", "A", "perceivable"],
  ["video-caption", "1.2.2", "Captions (Prerecorded)", "A", "perceivable"],
  ["css-orientation-lock", "1.3.4", "Orientation", "AA", "perceivable"],
  ["link-in-text-block", "1.4.1", "Use of Color", "A", "perceivable"],
  ["no-autoplay-audio", "1.4.2", "Audio Control", "A", "perceivable"],
  ["meta-viewport", "1.4.4", "Resize Text", "AA", "perceivable"],
  ["avoid-inline-spacing", "1.4.12", "Text Spacing", "AA", "perceivable"],
  ["meta-refresh", "2.2.1", "Timing Adjustable", "A", "operable"],
  ["blink", "2.2.2", "Pause, Stop, Hide", "A", "operable"],
  ["bypass", "2.4.1", "Bypass Blocks", "A", "operable"],
  ["label-content-name-mismatch", "2.5.3", "Label in Name", "A", "operable"],
  ["valid-lang", "3.1.2", "Language of Parts", "AA", "understandable"]
] as const;

test("mapRuleToWcag maps exact known rules", () => {
  assert.deepEqual(mapRuleToWcag("color-contrast"), ["1.4.3"]);
  assert.deepEqual(mapRuleToWcag("button-name"), ["4.1.2"]);
  assert.deepEqual(mapRuleToWcag("document-title"), ["2.4.2"]);
  assert.deepEqual(mapRuleToWcag("page-title-duplicate"), ["2.4.2"]);
  assert.deepEqual(mapRuleToWcag("page-title-placeholder"), ["2.4.2"]);
  assert.deepEqual(mapRuleToWcag("html-has-lang"), ["3.1.1"]);
  assert.deepEqual(mapRuleToWcag("aria-valid-attr-value"), ["4.1.2"]);
  assert.deepEqual(mapRuleToWcag("autocomplete-valid"), ["1.3.5"]);
  assert.deepEqual(mapRuleToWcag("listitem"), ["1.3.1"]);
  assert.deepEqual(mapRuleToWcag("@angular-eslint/template/alt-text"), ["1.1.1"]);
  assert.deepEqual(mapRuleToWcag("@angular-eslint/template/valid-aria"), ["4.1.2"]);
  assert.deepEqual(mapRuleToWcag("keyboard-focus-stuck"), ["2.1.2"]);
  assert.deepEqual(mapRuleToWcag("keyboard-focus-lost"), ["2.1.1", "2.4.3"]);
  assert.deepEqual(mapRuleToWcag("keyboard-control-unreachable"), ["2.1.1"]);
  assert.deepEqual(mapRuleToWcag("keyboard-activation-no-effect"), ["2.1.1"]);
  assert.deepEqual(mapRuleToWcag("keyboard-focus-indicator-missing"), ["2.4.7"]);
  assert.deepEqual(mapRuleToWcag("keyboard-focus-obscured"), ["2.4.11"]);
  assert.deepEqual(mapRuleToWcag("keyboard-reverse-order-mismatch"), ["2.4.3"]);
  assert.deepEqual(mapRuleToWcag("layout-horizontal-overflow"), ["1.4.10"]);
  assert.deepEqual(mapRuleToWcag("layout-clipped-text"), ["1.4.10"]);
  assert.deepEqual(mapRuleToWcag("modal-accessible-name-missing"), ["4.1.2"]);
  assert.deepEqual(mapRuleToWcag("modal-initial-focus-outside"), ["2.4.3"]);
  assert.deepEqual(mapRuleToWcag("modal-focus-not-restored"), ["2.4.3"]);
  assert.deepEqual(mapRuleToWcag("modal-focus-escapes"), ["2.4.3"]);
  assert.deepEqual(mapRuleToWcag("form-invalid-error-not-associated"), ["3.3.1", "3.3.2"]);
  assert.deepEqual(mapRuleToWcag("image-alt-filename"), ["1.1.1"]);
  assert.deepEqual(mapRuleToWcag("image-alt-generic"), ["1.1.1"]);
  assert.deepEqual(mapRuleToWcag("image-alt-duplicates-nearby-text"), ["1.1.1"]);
  assert.deepEqual(mapRuleToWcag("image-alt-repeated"), ["1.1.1"]);
  assert.deepEqual(mapRuleToWcag("image-alt-excessive-length"), ["1.1.1"]);
  assert.deepEqual(mapRuleToWcag("media-video-captions-not-detected"), ["1.2.2"]);
  assert.deepEqual(mapRuleToWcag("media-audio-transcript-not-detected"), ["1.2.1"]);
  assert.deepEqual(mapRuleToWcag("media-autoplay-control-risk"), ["1.4.2"]);
  assert.deepEqual(mapRuleToWcag("canvas-alternative-not-detected"), ["1.1.1"]);
  assert.deepEqual(mapRuleToWcag("frame-title"), ["4.1.2"]);
});

test("mapRuleToWcag maps rule ids that contain known tokens", () => {
  assert.deepEqual(mapRuleToWcag("jsx-a11y/alt-text"), ["1.1.1"]);
});

test("restored axe checks resolve to complete WCAG metadata", () => {
  for (const [ruleId, criterionId, title, level, principle] of restoredAxeMappings) {
    assert.deepEqual(mapRuleToWcag(ruleId), [criterionId], ruleId);

    const [criterion] = getWcagCriteria([criterionId]);
    assert.ok(criterion, `${ruleId} should resolve WCAG ${criterionId}`);
    assert.equal(criterion.title, title);
    assert.equal(criterion.level, level);
    assert.equal(criterion.principle, principle);
    assert.match(criterion.url, /^https:\/\/www\.w3\.org\/WAI\/WCAG22\/Understanding\//);
  }

  assert.equal(new Set(restoredAxeMappings.map(([, criterionId]) => criterionId)).size, 12);
  assert.deepEqual(mapRuleToWcag("marquee"), ["2.2.2"]);
});

test("mapRuleToWcag returns an empty list for unknown rules", () => {
  assert.deepEqual(mapRuleToWcag("custom-rule"), []);
  assert.deepEqual(mapRuleToWcag("heading-order"), []);
});

test("getWcagCriteria returns title, level, principle, and documentation URL", () => {
  const [criterion] = getWcagCriteria(["1.4.3"]);

  assert.equal(criterion.id, "1.4.3");
  assert.equal(criterion.title, "Contrast (Minimum)");
  assert.equal(criterion.level, "AA");
  assert.equal(criterion.principle, "perceivable");
  assert.equal(criterion.introducedIn, "2.0");
  assert.match(criterion.url, /WCAG22\/Understanding\/contrast-minimum/);
});

test("getWcagCriteria includes WCAG 2.2-only criteria", () => {
  const [criterion] = getWcagCriteria(["2.5.8"]);

  assert.equal(criterion.id, "2.5.8");
  assert.equal(criterion.title, "Target Size (Minimum)");
  assert.equal(criterion.level, "AA");
  assert.equal(criterion.introducedIn, "2.2");
});

test("getWcagCriteria includes WCAG 2.1 input purpose criteria", () => {
  const [criterion] = getWcagCriteria(["1.3.5"]);

  assert.equal(criterion.id, "1.3.5");
  assert.equal(criterion.title, "Identify Input Purpose");
  assert.equal(criterion.level, "AA");
  assert.equal(criterion.introducedIn, "2.1");
});

test("getWcagCriteria includes form error identification", () => {
  const [criterion] = getWcagCriteria(["3.3.1"]);

  assert.equal(criterion.title, "Error Identification");
  assert.equal(criterion.level, "A");
  assert.equal(criterion.principle, "understandable");
});

test("getWcagCriteria includes WCAG 2.1 reflow criteria", () => {
  const [criterion] = getWcagCriteria(["1.4.10"]);

  assert.equal(criterion.title, "Reflow");
  assert.equal(criterion.level, "AA");
  assert.equal(criterion.introducedIn, "2.1");
});

test("normalizeWcagReferences converts axe wcag tags to success criteria", () => {
  assert.deepEqual(
    normalizeWcagReferences(["wcag2aa", "wcag143", "wcag412"]),
    ["1.4.3", "4.1.2"]
  );
});

test("normalizeWcagReferences preserves all restored A and AA axe tags", () => {
  assert.deepEqual(
    normalizeWcagReferences([
      "wcag121",
      "wcag122",
      "wcag134",
      "wcag141",
      "wcag142",
      "wcag144",
      "wcag1412",
      "wcag221",
      "wcag222",
      "wcag241",
      "wcag253",
      "wcag312"
    ]),
    restoredAxeMappings.map(([, criterionId]) => criterionId)
  );
});

test("matchesWcagLevel includes lower conformance levels", () => {
  const criteria = getWcagCriteria(["1.1.1", "1.4.3"]);

  assert.equal(matchesWcagLevel(criteria, "A"), true);
  assert.equal(matchesWcagLevel(criteria, "AA"), true);
  assert.equal(matchesWcagLevel(getWcagCriteria(["1.4.3"]), "A"), false);
});

test("matchesWcagVersion excludes criteria introduced after the selected version", () => {
  const [wcag20Criterion] = getWcagCriteria(["1.4.3"]);
  const [wcag22Criterion] = getWcagCriteria(["2.5.8"]);

  assert.equal(matchesWcagVersion(wcag20Criterion, "2.0"), true);
  assert.equal(matchesWcagVersion(wcag22Criterion, "2.0"), false);
  assert.equal(matchesWcagVersion(wcag22Criterion, "2.2"), true);
});
