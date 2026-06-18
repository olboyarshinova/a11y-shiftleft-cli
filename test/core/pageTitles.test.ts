import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzePageTitles,
  isPlaceholderPageTitle
} from "../../dist/core/pageTitles.js";

test("analyzePageTitles reports duplicate titles across distinct pages", () => {
  const issues = analyzePageTitles([
    { url: "https://example.com/", title: "Products - Example" },
    { url: "https://example.com/pricing", title: "Products - Example" },
    { url: "https://example.com/contact", title: "Contact - Example" }
  ], "react");

  assert.equal(issues.length, 2);
  assert.deepEqual(issues.map((issue) => issue.url), [
    "https://example.com/",
    "https://example.com/pricing"
  ]);
  assert.equal(issues.every((issue) => issue.ruleId === "page-title-duplicate"), true);
  assert.equal(issues.every((issue) => issue.wcag?.includes("2.4.2")), true);
});

test("analyzePageTitles ignores repeated UI states for the same URL", () => {
  const issues = analyzePageTitles([
    { url: "https://example.com/#menu", title: "Home - Example" },
    { url: "https://example.com/", title: "Home - Example" },
    { url: "https://example.com/", title: "Home - Example" }
  ], "vue");

  assert.deepEqual(issues, []);
});

test("analyzePageTitles reports common framework placeholder titles once per page", () => {
  const issues = analyzePageTitles([
    { url: "https://example.com/", title: "  Vite   +   React  " },
    { url: "https://example.com/#dialog", title: "Vite + React" }
  ], "react");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "page-title-placeholder");
  assert.match(issues[0].message || "", /framework or document placeholder/);
});

test("isPlaceholderPageTitle stays conservative for product titles", () => {
  assert.equal(isPlaceholderPageTitle("React App"), true);
  assert.equal(isPlaceholderPageTitle("Home"), false);
  assert.equal(isPlaceholderPageTitle("App Store"), false);
});
