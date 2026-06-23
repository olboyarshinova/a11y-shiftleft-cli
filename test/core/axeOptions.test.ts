import test from "node:test";
import assert from "node:assert/strict";
import { getAxeRunOptions } from "../../dist/core/axeOptions.js";

test("getAxeRunOptions enables the WCAG 2.2 target-size rule", () => {
  assert.deepEqual(getAxeRunOptions(), {
    rules: {
      "target-size": { enabled: true }
    }
  });
});
