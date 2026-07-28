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
  assert.equal(checklist.items.some((item) => item.id === "sensory-color-instructions"), true);
  assert.equal(checklist.items.some((item) => item.id === "text-spacing-resilience"), true);
  assert.equal(checklist.items.some((item) => item.id === "account-authentication-flow"), true);
  assert.equal(checklist.items.some((item) => item.id === "time-limits-recovery"), true);
  assert.equal(checklist.items.some((item) => item.id === "cognitive-clarity"), true);
  assert.equal(checklist.items.some((item) => item.id === "status-messages-live-updates"), true);
  assert.equal(checklist.items.some((item) => item.id === "media-motion"), true);
  assert.equal(checklist.items.some((item) => item.id === "embedded-content-complex-graphics"), true);
  assert.equal(checklist.items.some((item) => item.id === "voice-switch-readiness"), true);
  assert.equal(checklist.items.some((item) => item.id === "hover-focus-content"), true);
  assert.equal(checklist.items.some((item) => item.id === "pointer-dragging-alternatives"), true);
  assert.equal(checklist.items.some((item) => item.id === "representative-user-test"), true);
  assert.equal(checklist.items.some((item) => item.id === "task-completion-worksheet"), true);
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
  assert.equal(checklist.items[0].review.taskOutcome, "");
  assert.equal(checklist.items[0].review.firstBlocker, "");
  assert.equal(checklist.items[0].review.blockerSeverity, "");
  assert.deepEqual(checklist.items[0].review.missingStates, []);
  assert.equal(checklist.items[0].review.stepReviews?.length, checklist.items[0].steps.length);
  assert.equal(checklist.items[0].review.stepReviews?.[0].index, 1);
  assert.equal(checklist.items[0].review.stepReviews?.[0].status, "not-reviewed");
  assert.equal(checklist.items[0].review.stepReviews?.[0].step, checklist.items[0].steps[0]);
  assert.deepEqual(checklist.items[0].review.taskEvidence, []);
  assert.deepEqual(checklist.items[0].review.temporaryAcceptance, {
    accepted: false,
    acceptedBy: "",
    acceptedUntil: "",
    reason: "",
    followUp: ""
  });
  assert.equal(checklist.items[0].review.retestDate, "");
  assert.equal(checklist.items[0].review.retestResult, "");
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

test("createManualChecklist turns planned journeys into manual review targets", () => {
  const checklist = createManualChecklist({
    framework: "react",
    urls: ["http://localhost:3000"],
    generatedAt: "2026-06-04T00:00:00.000Z",
    plannedScope: {
      version: 1,
      generatedAt: "2026-06-04T00:00:00.000Z",
      product: {
        type: "ecommerce",
        languages: ["en"]
      },
      target: {
        standard: "wcag-2.2-aa",
        urls: ["http://localhost:3000"]
      },
      supportedPlatforms: ["Desktop Chrome"],
      assistiveTechnologies: ["Keyboard only"],
      representativeSample: [],
      randomSample: [],
      criticalJourneys: [{
        name: "Checkout",
        urls: ["http://localhost:3000/cart", "http://localhost:3000/checkout"],
        description: "Review checkout completion without mouse input.",
        notes: "Use a test account only."
      }],
      thirdPartyContent: [],
      exclusions: [],
      notes: []
    }
  });

  const taskWorksheet = checklist.items.find((item) => item.id === "task-completion-worksheet");
  const userTest = checklist.items.find((item) => item.id === "representative-user-test");

  assert.equal(taskWorksheet?.targets?.[0].kind, "journey");
  assert.equal(taskWorksheet?.targets?.[0].label, "Checkout");
  assert.match(taskWorksheet?.targets?.[0].evidence || "", /2 planned URL/);
  assert.match(taskWorksheet?.targets?.[0].evidence || "", /test account/);
  assert.equal(userTest?.targets?.[0].label, "Checkout");
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
        },
        textSpacing: {
          viewportWidth: 1280,
          viewportHeight: 720,
          documentWidth: 1300,
          horizontalOverflowPx: 20,
          clippedTextCount: 1,
          clippedTextSample: [{
            selector: "#card-title",
            text: "Long translated title",
            horizontalOverflowPx: 0,
            verticalOverflowPx: 12
          }]
        },
        sensoryInstructions: {
          sampleCount: 1,
          colorCueCount: 1,
          positionCueCount: 1,
          shapeCueCount: 0,
          soundCueCount: 0,
          samples: [{
            selector: "#instructions",
            text: "Click the green button below to continue.",
            cues: ["color", "position"]
          }]
        },
        hoverFocus: {
          triggerCount: 1,
          titleTriggerCount: 0,
          describedByTriggerCount: 1,
          disclosureTriggerCount: 0,
          popoverTriggerCount: 1,
          visibleTooltipCount: 0,
          samples: [{
            selector: "#help",
            triggerKinds: ["aria-describedby", "aria-haspopup"],
            label: "Help",
            describedBy: "Extra help text",
            hasPopup: "dialog"
          }]
        },
        pointerInteractions: {
          targetCount: 1,
          draggableCount: 1,
          sliderCount: 0,
          carouselCount: 0,
          mapOrCanvasCount: 0,
          swipeOrSortableCount: 1,
          pointerHandlerCount: 0,
          samples: [{
            selector: "#sort-handle",
            interactionKinds: ["draggable", "sortable"],
            label: "Move item",
            tagName: "button"
          }]
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
  const statusReview = checklist.items.find((item) => item.id === "status-messages-live-updates");
  const imageReview = checklist.items.find((item) => item.id === "alternative-text-quality");
  const textSpacingReview = checklist.items.find((item) => item.id === "text-spacing-resilience");
  const sensoryReview = checklist.items.find((item) => item.id === "sensory-color-instructions");
  const hoverFocusReview = checklist.items.find((item) => item.id === "hover-focus-content");
  const pointerReview = checklist.items.find((item) => item.id === "pointer-dragging-alternatives");
  assert.equal(formReview?.targets?.[0].selector, "#email");
  assert.equal(statusReview?.targets?.[0].selector, "#email");
  assert.equal(formReview?.targets?.[0].stateId, "state-2");
  assert.equal(imageReview?.targets?.[0].kind, "image");
  assert.equal(textSpacingReview?.targets?.[0].kind, "text-spacing");
  assert.equal(sensoryReview?.targets?.[0].kind, "sensory");
  assert.equal(sensoryReview?.targets?.[0].selector, "#instructions");
  assert.equal(hoverFocusReview?.targets?.[0].kind, "hover-focus");
  assert.equal(hoverFocusReview?.targets?.[0].selector, "#help");
  assert.equal(pointerReview?.targets?.[0].kind, "pointer");
  assert.equal(pointerReview?.targets?.[0].selector, "#sort-handle");
  assert.equal(checklist.items[0].id, "form-label-quality");
  assert.match(toManualChecklistMarkdown(checklist), /Observed targets:\n- \[ \] form: Email address/);
  assert.match(toManualChecklistMarkdown(checklist), /state-2, #email/);
  assert.match(toManualChecklistMarkdown(checklist), /hover-focus: Help/);
  assert.match(toManualChecklistMarkdown(checklist), /text-spacing: Text-spacing findings require review/);
  assert.match(toManualChecklistMarkdown(checklist), /sensory: Click the green button below to continue/);
  assert.match(toManualChecklistMarkdown(checklist), /pointer: Move item/);
});

test("createManualChecklist keeps motion review targets when media elements also exist", () => {
  const checklist = createManualChecklist({
    framework: "react",
    exploration: {
      generatedAt: "2026-07-23T00:00:00.000Z",
      startUrl: "http://localhost:3000",
      states: [{
        id: "state-4",
        url: "http://localhost:3000/media",
        depth: 1,
        fingerprint: "media",
        actionLabel: "Media page",
        issueCount: 0,
        actionCount: 0,
        media: {
          audioCount: 0,
          videoCount: 1,
          videosWithCaptions: 0,
          audioWithTranscriptCandidate: 0,
          autoplayRiskCount: 0,
          activeAnimationCount: 2,
          reducedMotionQueryDetected: false,
          unreadableStylesheetCount: 0,
          elements: [{
            selector: "#promo-video",
            kind: "video",
            autoplay: false,
            muted: false,
            controls: true,
            captionTrackCount: 0,
            transcriptCandidate: false
          }]
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
    generatedAt: "2026-07-23T00:00:00.000Z"
  });

  const mediaReview = checklist.items.find((item) => item.id === "media-motion");
  assert.equal(mediaReview?.targets?.some((target) => target.selector === "#promo-video"), true);
  assert.equal(mediaReview?.targets?.some((target) => target.label === "Animated content"), true);
});

test("createManualChecklist maps iframe and canvas evidence to embedded-content review", () => {
  const checklist = createManualChecklist({
    framework: "react",
    exploration: {
      generatedAt: "2026-07-23T00:00:00.000Z",
      startUrl: "http://localhost:3000",
      states: [{
        id: "state-5",
        url: "http://localhost:3000/chart",
        depth: 1,
        fingerprint: "chart",
        actionLabel: "Chart page",
        issueCount: 0,
        actionCount: 0,
        embeddedContent: {
          iframeCount: 1,
          sameOriginIframeCount: 0,
          crossOriginIframeCount: 1,
          inaccessibleIframeCount: 1,
          canvasCount: 1,
          canvasWithAlternativeCount: 0,
          canvasWithoutAlternativeCount: 1,
          iframes: [{
            selector: "#video-frame",
            url: "https://www.youtube.com/embed/demo",
            sameOrigin: false,
            title: "Product video",
            browserAccessible: false
          }],
          canvases: [{
            selector: "#sales-chart",
            width: 640,
            height: 320,
            decorative: false,
            hasAccessibleAlternative: false
          }]
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
    generatedAt: "2026-07-23T00:00:00.000Z"
  });

  const embeddedReview = checklist.items.find((item) => item.id === "embedded-content-complex-graphics");
  assert.equal(embeddedReview?.targets?.[0].kind, "embedded-content");
  assert.equal(embeddedReview?.targets?.some((target) => target.selector === "#video-frame"), true);
  assert.equal(embeddedReview?.targets?.some((target) => target.selector === "#sales-chart"), true);
  assert.match(toManualChecklistMarkdown(checklist), /embedded-content: Product video/);
  assert.match(toManualChecklistMarkdown(checklist), /cross-origin iframe; DOM unavailable/);
  assert.match(toManualChecklistMarkdown(checklist), /Canvas or complex graphic/);
});

test("createManualChecklist maps observed live-region updates to status-message review", () => {
  const checklist = createManualChecklist({
    framework: "react",
    exploration: {
      generatedAt: "2026-07-23T00:00:00.000Z",
      startUrl: "http://localhost:3000",
      states: [{
        id: "state-3",
        url: "http://localhost:3000/search",
        depth: 1,
        fingerprint: "search-results",
        actionLabel: "Search",
        issueCount: 0,
        actionCount: 0,
        dynamicAnnouncements: {
          actionLabel: "Search products",
          meaningfulUpdates: 1,
          updates: [{
            selector: "[role='status']",
            text: "12 results loaded",
            role: "status",
            politeness: "polite"
          }]
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
    generatedAt: "2026-07-23T00:00:00.000Z"
  });

  const statusReview = checklist.items.find((item) => item.id === "status-messages-live-updates");
  assert.equal(statusReview?.targets?.[0].kind, "live-region");
  assert.equal(statusReview?.targets?.[0].selector, "[role='status']");
  assert.equal(statusReview?.targets?.[0].stateId, "state-3");
  assert.match(toManualChecklistMarkdown(checklist), /live-region: 12 results loaded/);
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
  assert.match(markdown, /Instructions do not rely only on color, shape, or position/);
  assert.match(markdown, /do not rely only on color, size, shape, sound, location, or visual orientation/);
  assert.match(markdown, /Text spacing resilience/);
  assert.match(markdown, /WCAG text-spacing overrides/);
  assert.match(markdown, /Account, checkout, and authentication flow/);
  assert.match(markdown, /not asked to re-enter information already provided/);
  assert.match(markdown, /Time limits, interruption recovery, and data loss prevention/);
  assert.match(markdown, /warned before time expires/);
  assert.match(markdown, /Predictable next actions and calm error recovery/);
  assert.match(markdown, /without blaming or alarming the user/);
  assert.match(markdown, /Zoom the browser to 200%/);
  assert.match(markdown, /accurate synchronized captions/);
  assert.match(markdown, /Hover and focus-triggered content/);
  assert.match(markdown, /dismissed without moving pointer or keyboard focus/);
  assert.match(markdown, /Pointer cancellation and dragging alternatives/);
  assert.match(markdown, /single-pointer alternative/);
  assert.match(markdown, /Embedded content and complex graphics/);
  assert.match(markdown, /document ownership and test the embedded source directly/);
  assert.match(markdown, /Voice and switch control readiness/);
  assert.match(markdown, /visible label is included in the accessible name/);
  assert.match(markdown, /Task completion evidence worksheet/);
  assert.match(markdown, /without sound, without precise pointer movement, keyboard only, 200% zoom, reduced motion, or elevated cognitive load/);
  assert.match(markdown, /completed with assistance, blocked, abandoned, or not applicable/);
  assert.match(markdown, /Logo purpose and accessible name/);
  assert.match(markdown, /NVDA with Chrome or Firefox/);
  assert.match(markdown, /Screen reader forms, dialogs, and dynamic updates/);
  assert.match(markdown, /Status messages and live updates/);
  assert.match(markdown, /Trigger loading, success, error, cart, search-result, filter, save, and validation updates/);
  assert.match(markdown, /logo links to the home page/);
  assert.match(markdown, /Activate the skip link/);
  assert.match(markdown, /Automated accessibility tools do not prove full WCAG conformance/);
  assert.match(markdown, /Status: `not-reviewed`/);
  assert.match(markdown, /## Review Status/);
  assert.match(markdown, /Not reviewed \| 24/);
  assert.match(markdown, /Step records \| \d+/);
  assert.match(markdown, /Task evidence attachments \| 0/);
  assert.match(markdown, /Environment summary:/);
  assert.match(markdown, /Operating system:/);
  assert.match(markdown, /Assistive technology and version:/);
  assert.match(markdown, /Viewport or zoom level:/);
  assert.match(markdown, /Color mode:/);
  assert.match(markdown, /Remediation owner:/);
  assert.match(markdown, /Task outcome: ``/);
  assert.match(markdown, /Step review records:/);
  assert.match(markdown, /Step 1: `not-reviewed`/);
  assert.match(markdown, /Evidence links:/);
  assert.match(markdown, /First blocker:/);
  assert.match(markdown, /Blocker severity: ``/);
  assert.match(markdown, /Missing states:/);
  assert.match(markdown, /Task evidence attachments:/);
  assert.match(markdown, /redact sensitive data before sharing/);
  assert.match(markdown, /Temporary acceptance:/);
  assert.match(markdown, /Accepted: no/);
  assert.match(markdown, /Accepted until:/);
  assert.match(markdown, /Retest date:/);
  assert.match(markdown, /Retest result:/);
});

test("summarizeManualReviewRecords counts review outcomes", () => {
  const checklist = createManualChecklist({
    framework: "react",
    generatedAt: "2026-06-04T00:00:00.000Z",
    issues: []
  });

  checklist.items[0].review.status = "pass";
  if (checklist.items[0].review.stepReviews?.[0]) {
    checklist.items[0].review.stepReviews[0].status = "pass";
  }
  checklist.items[0].review.taskEvidence = [{
    kind: "screenshot",
    label: "Keyboard checkout evidence",
    url: "reports/manual/checkout.png",
    notes: "Sensitive values redacted.",
    redacted: true
  }];
  checklist.items[0].review.temporaryAcceptance = {
    accepted: true,
    acceptedBy: "QA owner",
    acceptedUntil: "2099-01-01",
    reason: "Third-party content fix is scheduled.",
    followUp: "Retest after vendor update."
  };
  checklist.items[1].review.status = "fail";
  checklist.items[2].review.status = "not-applicable";

  assert.deepEqual(summarizeManualReviewRecords(checklist), {
    total: checklist.items.length,
    notReviewed: checklist.items.length - 3,
    pass: 1,
    fail: 1,
    notApplicable: 1,
    stepRecords: checklist.items.reduce((sum, item) => sum + (item.review.stepReviews?.length || 0), 0),
    reviewedSteps: 1,
    taskEvidenceAttachments: 1,
    redactedTaskEvidence: 1,
    temporaryAcceptances: 1,
    temporaryAcceptanceExpiring: 0
  });
});
