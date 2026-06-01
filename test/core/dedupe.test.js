import test from "node:test";
import assert from "node:assert/strict";
import { dedupeIssues } from "../../src/core/dedupe.js";

test("dedupeIssues collapses matching rule, target, and severity", () => {
  const issues = dedupeIssues([
    {
      source: "axe",
      ruleId: "color-contrast",
      selector: ".primary",
      severity: "critical"
    },
    {
      source: "eslint",
      ruleId: "color-contrast",
      selector: ".primary",
      severity: "critical"
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].fingerprint, "color-contrast::.primary::critical");
  assert.equal(issues[0].duplicateCount, 1);
  assert.deepEqual(issues[0].sources.sort(), ["axe", "eslint"]);
});

test("dedupeIssues keeps different targets separate", () => {
  const issues = dedupeIssues([
    {
      source: "axe",
      ruleId: "button-name",
      selector: ".icon-button",
      severity: "critical"
    },
    {
      source: "axe",
      ruleId: "button-name",
      selector: ".menu-button",
      severity: "critical"
    }
  ]);

  assert.equal(issues.length, 2);
});
