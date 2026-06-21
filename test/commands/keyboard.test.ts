import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_KEYBOARD_BASELINE_FILE, keyboardSummary, validateKeyboardComparisonOptions } from "../../dist/commands/keyboard.js";

test("keyboardSummary reports bounded traversal coverage", () => {
  const summary = keyboardSummary({
    focusableCount: 3,
    maxTabs: 10,
    completedCycle: true,
    reverseOrderMatches: true,
    backwardSteps: [{ selector: "#two" }, { selector: "#one" }] as never,
    steps: [
      { selector: "#one" },
      { selector: "#two" },
      { selector: "#one" }
    ] as never
  });

  assert.deepEqual(summary, {
    focusableCount: 3,
    focusSteps: 3,
    uniqueFocusTargets: 2,
    completedCycle: true,
    reverseFocusSteps: 2,
    reverseOrderMatches: true,
    maxTabs: 10,
    activationAttempts: 0,
    activationChanges: 0,
    activationSkipped: 0
  });
});

test("keyboard comparison modes use a dedicated baseline and reject ambiguous comparisons", () => {
  assert.equal(DEFAULT_KEYBOARD_BASELINE_FILE, ".a11y-keyboard-baseline.json");
  assert.doesNotThrow(() => validateKeyboardComparisonOptions({ baseline: true }));
  assert.doesNotThrow(() => validateKeyboardComparisonOptions({ retest: "previous/a11y-report.json" }));
  assert.throws(
    () => validateKeyboardComparisonOptions({ baseline: true, retest: "previous/a11y-report.json" }),
    /either --retest or keyboard baseline mode/
  );
});
