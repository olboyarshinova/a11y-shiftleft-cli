import test from "node:test";
import assert from "node:assert/strict";
import {
  createManualChecklist,
  toManualChecklistMarkdown
} from "../../dist/core/manualChecklist.js";

test("createManualChecklist generates human-review checklist items", () => {
  const checklist = createManualChecklist({
    framework: "react",
    urls: ["http://localhost:3000"],
    generatedAt: "2026-06-04T00:00:00.000Z",
    issues: []
  });

  assert.equal(checklist.generatedAt, "2026-06-04T00:00:00.000Z");
  assert.equal(checklist.framework, "react");
  assert.equal(checklist.urls[0], "http://localhost:3000");
  assert.equal(checklist.items.length > 0, true);
  assert.equal(checklist.items.some((item) => item.id === "complex-widget-focus"), true);
});

test("createManualChecklist prioritizes form review when form issues exist", () => {
  const checklist = createManualChecklist({
    framework: "react",
    issues: [
      {
        source: "eslint",
        framework: "react",
        ruleId: "jsx-a11y/label-has-associated-control",
        wcag: ["1.3.1", "3.3.2"],
        wcagCriteria: [],
        severity: "warning",
        message: "A form label must be associated with a control.",
        fingerprint: "label::src/App.jsx::warning",
        duplicateCount: 0
      }
    ],
    generatedAt: "2026-06-04T00:00:00.000Z"
  });

  assert.equal(checklist.items[0].id, "form-label-quality");
});

test("toManualChecklistMarkdown renders actionable Markdown checkboxes", () => {
  const checklist = createManualChecklist({
    framework: "vue",
    urls: ["http://localhost:3000"],
    generatedAt: "2026-06-04T00:00:00.000Z",
    issues: []
  });
  const markdown = toManualChecklistMarkdown(checklist);

  assert.match(markdown, /Semi-Automated Accessibility Review Checklist/);
  assert.match(markdown, /Framework: vue/);
  assert.match(markdown, /- \[ \] Navigate the page using only the keyboard\./);
  assert.match(markdown, /Automated accessibility tools do not prove full WCAG conformance/);
});
