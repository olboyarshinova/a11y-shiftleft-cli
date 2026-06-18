import test from "node:test";
import assert from "node:assert/strict";
import { keyboardSummary } from "../../dist/commands/keyboard.js";

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
    maxTabs: 10
  });
});
