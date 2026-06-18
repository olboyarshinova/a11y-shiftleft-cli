import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRootCauses } from "../../dist/core/rootCauses.js";

test("summarizeRootCauses groups repeated active navigation contrast findings", () => {
  const pages = ["about", "shop", "blog", "contact"];
  const issues = pages.map((page, index) => ({
    source: "axe",
    framework: "unknown",
    ruleId: "color-contrast",
    wcag: ["1.4.3"],
    wcagCriteria: [],
    tags: ["wcag143"],
    severity: "critical",
    confidence: "high",
    confidenceScore: 95,
    confidenceReason: "Rendered WCAG finding",
    findingType: "wcag",
    category: "contrast",
    selector: `.margin-right\\:8:nth-child(${index + 1}) > .is-selected[aria-current="page"][href$="${page}/"]`,
    url: `https://binaryville.com/${page}/`,
    stateId: `state-${index + 1}`,
    message: "Elements must meet minimum color contrast ratio thresholds",
    fingerprint: `contrast-${page}`,
    duplicateCount: 0
  }));
  issues.push({
    ...issues[0],
    selector: ".is-selected.\\&\\:hocus--text-decoration\\:underline[href$=\"about/\"]",
    url: "https://binaryville.com/about/rex/",
    stateId: "state-5",
    fingerprint: "contrast-rex"
  });

  const groups = summarizeRootCauses(issues);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].ruleId, "color-contrast");
  assert.equal(groups[0].targetPattern, "state-class:is-selected");
  assert.equal(groups[0].occurrenceCount, 5);
  assert.equal(groups[0].affectedPages.length, 5);
  assert.equal(groups[0].affectedStates.length, 5);
});

test("summarizeRootCauses keeps unrelated selectors separate", () => {
  const base = {
    source: "axe",
    framework: "unknown",
    ruleId: "color-contrast",
    wcag: ["1.4.3"],
    wcagCriteria: [],
    tags: ["wcag143"],
    severity: "critical",
    confidence: "high",
    confidenceScore: 95,
    confidenceReason: "Rendered WCAG finding",
    findingType: "wcag",
    category: "contrast",
    url: "https://example.com/",
    message: "Contrast failure",
    duplicateCount: 0
  };

  const groups = summarizeRootCauses([
    { ...base, selector: ".muted-copy", fingerprint: "one" },
    { ...base, selector: ".secondary-link", fingerprint: "two" }
  ]);

  assert.equal(groups.length, 2);
});
