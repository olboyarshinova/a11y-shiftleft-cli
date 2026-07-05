import test from "node:test";
import assert from "node:assert/strict";
import { enrichIssueEvidence, inferIssueCategory } from "../../dist/core/classification.js";

test("enrichIssueEvidence marks rendered axe WCAG findings as high confidence", () => {
  const issue = enrichIssueEvidence({
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    wcag: ["4.1.2"],
    wcagCriteria: [{
      id: "4.1.2",
      title: "Name, Role, Value",
      level: "A",
      principle: "robust",
      introducedIn: "2.0",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    }],
    tags: ["wcag412"],
    selector: "button",
    message: "Buttons must have discernible text"
  });

  assert.equal(issue.confidence, "high");
  assert.equal(issue.confidenceScore, 95);
  assert.equal(issue.category, "aria");
  assert.equal(issue.findingType, "wcag");
  assert.match(issue.confidenceReason, /rendered DOM/);
});

test("enrichIssueEvidence separates axe best practices from WCAG violations", () => {
  const issue = enrichIssueEvidence({
    source: "axe",
    framework: "unknown",
    ruleId: "heading-order",
    wcag: [],
    wcagCriteria: [],
    tags: ["cat.semantics", "best-practice"],
    selector: "h3",
    message: "Heading levels should only increase by one"
  });

  assert.equal(issue.findingType, "best-practice");
  assert.equal(issue.confidence, "medium");
  assert.equal(issue.confidenceScore, 75);
  assert.match(issue.confidenceReason, /best-practice rule/);
});

test("enrichIssueEvidence keeps axe incomplete findings as needs review", () => {
  const issue = enrichIssueEvidence({
    source: "axe",
    framework: "unknown",
    ruleId: "color-contrast",
    wcag: ["1.4.3"],
    wcagCriteria: [{
      id: "1.4.3",
      title: "Contrast (Minimum)",
      level: "AA",
      principle: "perceivable",
      introducedIn: "2.0",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    }],
    tags: ["wcag143", "needs-review", "axe-incomplete"],
    selector: ".hero-title",
    message: "Potential color contrast issue needs manual review"
  });

  assert.equal(issue.findingType, "needs-review");
  assert.equal(issue.confidence, "low");
  assert.equal(issue.confidenceScore, 55);
  assert.equal(issue.category, "contrast");
  assert.match(issue.confidenceReason, /incomplete/);
});

test("enrichIssueEvidence marks accessibility lint findings as medium confidence", () => {
  const issue = enrichIssueEvidence({
    source: "eslint",
    framework: "angular",
    ruleId: "@angular-eslint/template/button-has-type",
    wcag: [],
    wcagCriteria: [],
    tags: [],
    file: "src/app/list/list.component.html",
    line: 12,
    column: 5,
    message: "Type for <button> is missing"
  });

  assert.equal(issue.confidence, "medium");
  assert.equal(issue.confidenceScore, 70);
  assert.equal(issue.category, "forms");
});

test("enrichIssueEvidence marks adapter health findings as low confidence", () => {
  const issue = enrichIssueEvidence({
    source: "axe",
    framework: "react",
    ruleId: "adapter/axe-scan-error",
    wcag: [],
    wcagCriteria: [],
    tags: [],
    url: "http://localhost:3000",
    message: "Dynamic scan failed"
  });

  assert.equal(issue.confidence, "low");
  assert.equal(issue.confidenceScore, 40);
  assert.equal(issue.category, "adapter");
});

test("inferIssueCategory groups common accessibility families", () => {
  assert.equal(inferIssueCategory({
    source: "axe",
    framework: "react",
    ruleId: "color-contrast",
    wcag: [],
    wcagCriteria: [],
    tags: [],
    message: "Elements must meet contrast requirements"
  }), "contrast");

  assert.equal(inferIssueCategory({
    source: "eslint",
    framework: "react",
    ruleId: "jsx-a11y/alt-text",
    wcag: [],
    wcagCriteria: [],
    tags: [],
    message: "Image elements must have alternate text"
  }), "images");
});
