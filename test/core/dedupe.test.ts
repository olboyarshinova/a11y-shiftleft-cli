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

test("dedupeIssues keeps light and dark findings separate", () => {
  const issues = dedupeIssues([
    {
      source: "axe",
      ruleId: "color-contrast",
      selector: ".primary",
      url: "http://localhost:3000/",
      colorScheme: "light",
      severity: "critical"
    },
    {
      source: "axe",
      ruleId: "color-contrast",
      selector: ".primary",
      url: "http://localhost:3000/",
      colorScheme: "dark",
      severity: "critical"
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

test("dedupeIssues preserves browser evidence from a later duplicate", () => {
  const issues = dedupeIssues([
    {
      source: "eslint",
      framework: "react",
      ruleId: "button-name",
      message: "Button has no accessible name",
      wcag: [],
      wcagCriteria: [],
      tags: [],
      severity: "critical",
      confidence: "high",
      confidenceScore: 95,
      confidenceReason: "Static rule",
      findingType: "wcag",
      category: "aria",
      selector: ".icon-button",
      url: "http://localhost:3000/"
    },
    {
      source: "axe",
      framework: "react",
      ruleId: "button-name",
      message: "Button has no accessible name",
      wcag: [],
      wcagCriteria: [],
      tags: [],
      severity: "critical",
      confidence: "high",
      confidenceScore: 95,
      confidenceReason: "Rendered DOM rule",
      findingType: "wcag",
      category: "aria",
      selector: ".icon-button",
      url: "http://localhost:3000/",
      stateId: "state-1",
      stateLabel: "Initial page",
      screenshot: "screenshots/state-1.jpg",
      elementBounds: {
        x: 10,
        y: 20,
        width: 30,
        height: 40,
        coordinateSpace: "document"
      }
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].stateId, "state-1");
  assert.equal(issues[0].screenshot, "screenshots/state-1.jpg");
  assert.deepEqual(issues[0].elementBounds, {
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    coordinateSpace: "document"
  });
  assert.deepEqual(issues[0].sources?.sort(), ["axe", "eslint"]);
});
