import test from "node:test";
import assert from "node:assert/strict";
import { mapRuleToWcag } from "../../src/core/wcagMap.js";

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
