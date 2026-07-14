import test from "node:test";
import assert from "node:assert/strict";
import {
  createManualChecklist,
  summarizeManualReviewRecords,
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
  assert.equal(checklist.items.some((item) => item.id === "zoom-reflow"), true);
  assert.equal(checklist.items.some((item) => item.id === "alternative-text-quality"), true);
  assert.equal(checklist.items.some((item) => item.id === "brand-logo-accessibility"), true);
  assert.equal(checklist.items.some((item) => item.id === "media-motion"), true);
  assert.equal(checklist.items.some((item) => item.id === "representative-user-test"), true);
  assert.equal(checklist.items.some((item) => item.id === "screen-reader-dynamic-content"), true);
  assert.equal(checklist.items.every((item) => item.review.status === "not-reviewed"), true);
  assert.deepEqual(checklist.items[0].review.environmentDetails, {
    operatingSystem: "",
    browser: "",
    assistiveTechnology: "",
    inputMethod: "",
    viewportOrZoom: "",
    colorMode: ""
  });
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

test("createManualChecklist creates an assisted queue from exploration evidence", () => {
  const checklist = createManualChecklist({
    framework: "react",
    exploration: {
      generatedAt: "2026-06-22T00:00:00.000Z",
      startUrl: "http://localhost:3000",
      states: [{
        id: "state-2",
        url: "http://localhost:3000/contact",
        depth: 1,
        fingerprint: "contact",
        actionLabel: "Contact",
        issueCount: 1,
        actionCount: 0,
        formErrors: {
          formCount: 1,
          fieldCount: 2,
          invalidFieldCount: 1,
          associatedErrorCount: 0,
          unassociatedInvalidCount: 1,
          errorSummaryCount: 0,
          invalidFields: [{
            selector: "#email",
            accessibleName: "Email address",
            errorReferenceIds: [],
            focused: false
          }]
        },
        imageAlternatives: {
          imageCount: 1,
          decorativeCount: 0,
          informativeCount: 1,
          suspiciousCount: 1,
          repeatedAlternativeGroups: 0,
          samples: [{ selector: "#hero", alt: "hero.png", concerns: ["filename"] }]
        }
      }],
      edges: [],
      skippedActions: [],
      summary: {
        statesVisited: 1,
        actionsTried: 0,
        skippedActions: 0,
        screenshots: 0,
        duplicateScreenshots: 0,
        maxDepth: 1,
        maxStates: 10
      }
    },
    generatedAt: "2026-06-22T00:00:00.000Z"
  });

  const formReview = checklist.items.find((item) => item.id === "form-label-quality");
  const imageReview = checklist.items.find((item) => item.id === "alternative-text-quality");
  assert.equal(formReview?.targets?.[0].selector, "#email");
  assert.equal(formReview?.targets?.[0].stateId, "state-2");
  assert.equal(imageReview?.targets?.[0].kind, "image");
  assert.equal(checklist.items[0].id, "form-label-quality");
  assert.match(toManualChecklistMarkdown(checklist), /Observed targets:\n- \[ \] form: Email address/);
  assert.match(toManualChecklistMarkdown(checklist), /state-2, #email/);
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
  assert.match(markdown, /Zoom the browser to 200%/);
  assert.match(markdown, /accurate synchronized captions/);
  assert.match(markdown, /Logo purpose and accessible name/);
  assert.match(markdown, /NVDA with Chrome or Firefox/);
  assert.match(markdown, /Screen reader forms, dialogs, and dynamic updates/);
  assert.match(markdown, /logo links to the home page/);
  assert.match(markdown, /Activate the skip link/);
  assert.match(markdown, /Automated accessibility tools do not prove full WCAG conformance/);
  assert.match(markdown, /Status: `not-reviewed`/);
  assert.match(markdown, /## Review Status/);
  assert.match(markdown, /Not reviewed \| 13/);
  assert.match(markdown, /Environment summary:/);
  assert.match(markdown, /Operating system:/);
  assert.match(markdown, /Assistive technology and version:/);
  assert.match(markdown, /Viewport or zoom level:/);
  assert.match(markdown, /Color mode:/);
  assert.match(markdown, /Remediation owner:/);
});

test("summarizeManualReviewRecords counts review outcomes", () => {
  const checklist = createManualChecklist({
    framework: "react",
    generatedAt: "2026-06-04T00:00:00.000Z",
    issues: []
  });

  checklist.items[0].review.status = "pass";
  checklist.items[1].review.status = "fail";
  checklist.items[2].review.status = "not-applicable";

  assert.deepEqual(summarizeManualReviewRecords(checklist), {
    total: checklist.items.length,
    notReviewed: checklist.items.length - 3,
    pass: 1,
    fail: 1,
    notApplicable: 1
  });
});
