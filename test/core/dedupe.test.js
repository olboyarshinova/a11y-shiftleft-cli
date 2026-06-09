import test from "node:test";
import assert from "node:assert/strict";
import { dedupeIssues } from "../../dist/core/dedupe.js";

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
  assert.equal(issues[0].fingerprint, "color-contrast::selector=.primary::critical");
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

test("dedupeIssues keeps matching selectors on different pages separate", () => {
  const issues = dedupeIssues([
    {
      source: "axe",
      ruleId: "page-has-heading-one",
      selector: "html",
      url: "http://localhost:3000/",
      severity: "warning"
    },
    {
      source: "axe",
      ruleId: "page-has-heading-one",
      selector: "html",
      url: "http://localhost:3000/settings",
      severity: "warning"
    }
  ]);

  assert.equal(issues.length, 2);
});

test("dedupeIssues keeps matching static rules on different lines separate", () => {
  const issues = dedupeIssues([
    {
      source: "eslint",
      ruleId: "jsx-a11y/alt-text",
      file: "src/App.jsx",
      line: 10,
      column: 5,
      severity: "warning"
    },
    {
      source: "eslint",
      ruleId: "jsx-a11y/alt-text",
      file: "src/App.jsx",
      line: 22,
      column: 5,
      severity: "warning"
    }
  ]);

  assert.equal(issues.length, 2);
});
