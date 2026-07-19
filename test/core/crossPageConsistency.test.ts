import test from "node:test";
import assert from "node:assert/strict";
import { analyzeControlNameConsistency } from "../../dist/core/crossPageConsistency.js";

test("analyzeControlNameConsistency reports same link destination with different names", () => {
  const issues = analyzeControlNameConsistency([
    {
      id: "state-1",
      url: "https://example.com/",
      actionLabel: "Home",
      interactiveControls: [{
        selector: "nav a:nth-child(1)",
        role: "link",
        name: "Support",
        href: "/help"
      }]
    },
    {
      id: "state-2",
      url: "https://example.com/pricing",
      actionLabel: "Pricing",
      interactiveControls: [{
        selector: "nav a:nth-child(1)",
        role: "link",
        name: "Help center",
        href: "https://example.com/help#top"
      }]
    }
  ], "react");

  assert.equal(issues.length, 2);
  assert.equal(issues.every((issue) => issue.ruleId === "control-name-inconsistent"), true);
  assert.equal(issues.every((issue) => issue.wcag?.includes("3.2.4")), true);
  assert.equal(issues.every((issue) => issue.tags?.includes("needs-review")), true);
  assert.match(issues[0].message || "", /support/);
  assert.match(issues[0].message || "", /help center/);
});

test("analyzeControlNameConsistency ignores repeated states for the same page", () => {
  const issues = analyzeControlNameConsistency([
    {
      id: "state-1",
      url: "https://example.com/#menu",
      interactiveControls: [{
        selector: "[id=\"account-link\"]",
        role: "link",
        name: "Account",
        href: "/account"
      }]
    },
    {
      id: "state-2",
      url: "https://example.com/",
      interactiveControls: [{
        selector: "[id=\"account-link\"]",
        role: "link",
        name: "Profile",
        href: "/account"
      }]
    }
  ], "vue");

  assert.deepEqual(issues, []);
});

test("analyzeControlNameConsistency uses stable non-link selectors conservatively", () => {
  const issues = analyzeControlNameConsistency([
    {
      id: "state-1",
      url: "https://example.com/",
      interactiveControls: [
        { selector: "main button:nth-child(1)", role: "button", name: "Open menu" },
        { selector: "[data-testid=\"theme-toggle\"]", role: "button", name: "Dark mode" }
      ]
    },
    {
      id: "state-2",
      url: "https://example.com/settings",
      interactiveControls: [
        { selector: "main button:nth-child(1)", role: "button", name: "Save settings" },
        { selector: "[data-testid=\"theme-toggle\"]", role: "button", name: "Switch theme" }
      ]
    }
  ], "unknown");

  assert.equal(issues.length, 2);
  assert.equal(issues.every((issue) => issue.selector === "[data-testid=\"theme-toggle\"]"), true);
});
