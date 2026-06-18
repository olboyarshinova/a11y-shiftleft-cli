import test from "node:test";
import assert from "node:assert/strict";
import { issuesForFocusStep } from "../../dist/adapters/keyboardPlaywrightAdapter.js";
import type { KeyboardFocusStep } from "../../dist/types.js";

function focusStep(overrides: Partial<KeyboardFocusStep> = {}): KeyboardFocusStep {
  return {
    index: 1,
    selector: "#save",
    tagName: "button",
    role: "button",
    accessibleName: "Save",
    tabIndex: 0,
    visible: true,
    focusVisible: true,
    indicatorVisible: true,
    obscured: false,
    ...overrides
  };
}

test("issuesForFocusStep reports missing keyboard focus indicators", () => {
  const issues = issuesForFocusStep(focusStep({ indicatorVisible: false }), "react", "http://localhost:3000");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "keyboard-focus-indicator-missing");
  assert.deepEqual(issues[0].wcag, ["2.4.7"]);
  assert.equal(issues[0].severity, "warning");
});

test("issuesForFocusStep reports invisible and obscured focus without duplication", () => {
  const invisible = issuesForFocusStep(focusStep({ visible: false, obscured: true }), "vue", "http://localhost:3000");
  const obscured = issuesForFocusStep(focusStep({ obscured: true }), "angular", "http://localhost:4200");

  assert.deepEqual(invisible.map((issue) => issue.ruleId), ["keyboard-focus-not-visible"]);
  assert.deepEqual(invisible[0].wcag, ["2.4.7", "2.4.11"]);
  assert.deepEqual(obscured.map((issue) => issue.ruleId), ["keyboard-focus-obscured"]);
  assert.deepEqual(obscured[0].wcag, ["2.4.11"]);
});

test("issuesForFocusStep keeps a visible focus treatment clean", () => {
  assert.deepEqual(issuesForFocusStep(focusStep(), "unknown", "http://localhost:3000"), []);
});
