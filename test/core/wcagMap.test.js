import test from "node:test";
import assert from "node:assert/strict";
import {
  getWcagCriteria,
  mapRuleToWcag,
  matchesWcagLevel,
  normalizeWcagReferences
} from "../../dist/core/wcagMap.js";

test("mapRuleToWcag maps exact known rules", () => {
  assert.deepEqual(mapRuleToWcag("color-contrast"), ["1.4.3"]);
  assert.deepEqual(mapRuleToWcag("button-name"), ["4.1.2"]);
  assert.deepEqual(mapRuleToWcag("@angular-eslint/template/alt-text"), ["1.1.1"]);
  assert.deepEqual(mapRuleToWcag("@angular-eslint/template/valid-aria"), ["4.1.2"]);
});

test("mapRuleToWcag maps rule ids that contain known tokens", () => {
  assert.deepEqual(mapRuleToWcag("jsx-a11y/alt-text"), ["1.1.1"]);
});

test("mapRuleToWcag returns an empty list for unknown rules", () => {
  assert.deepEqual(mapRuleToWcag("custom-rule"), []);
});

test("getWcagCriteria returns title, level, principle, and documentation URL", () => {
  const [criterion] = getWcagCriteria(["1.4.3"]);

  assert.equal(criterion.id, "1.4.3");
  assert.equal(criterion.title, "Contrast (Minimum)");
  assert.equal(criterion.level, "AA");
  assert.equal(criterion.principle, "perceivable");
  assert.match(criterion.url, /WCAG22\/Understanding\/contrast-minimum/);
});

test("normalizeWcagReferences converts axe wcag tags to success criteria", () => {
  assert.deepEqual(
    normalizeWcagReferences(["wcag2aa", "wcag143", "wcag412"]),
    ["1.4.3", "4.1.2"]
  );
});

test("matchesWcagLevel includes lower conformance levels", () => {
  const criteria = getWcagCriteria(["1.1.1", "1.4.3"]);

  assert.equal(matchesWcagLevel(criteria, "A"), true);
  assert.equal(matchesWcagLevel(criteria, "AA"), true);
  assert.equal(matchesWcagLevel(getWcagCriteria(["1.4.3"]), "A"), false);
});
