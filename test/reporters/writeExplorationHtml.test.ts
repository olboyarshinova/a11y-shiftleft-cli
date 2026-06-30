import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  renderExplorationHtml,
  transformBoundsForContainedPreview,
  writeExplorationHtml
} from "../../dist/reporters/writeExplorationHtml.js";

const graph = {
  generatedAt: "2026-06-09T00:00:00.000Z",
  startUrl: "http://localhost:3000",
  states: [
    {
      id: "state-1",
      url: "http://localhost:3000/",
      title: "Demo",
      depth: 0,
      fingerprint: "abc123",
      actionLabel: "Initial page",
      colorScheme: "dark",
      screenshot: "screenshots/state-1.png",
      screenshotFullPage: true,
      issueCount: 1,
      actionCount: 2,
      accessibilityTree: {
        totalNodes: 12,
        namedNodes: 8,
        interactiveNodes: 3,
        unnamedInteractiveNodes: 1,
        landmarks: [{ role: "main", name: "Main content" }],
        headings: [{ role: "heading", name: "Demo", level: 1 }],
        interactiveSample: [{ role: "button", name: "Open menu" }]
      },
      reflow: {
        viewportWidth: 320,
        viewportHeight: 800,
        documentWidth: 360,
        horizontalOverflowPx: 40,
        clippedTextCount: 1,
        clippedTextSample: [{
          selector: ".clipped",
          text: "Clipped account instructions",
          horizontalOverflowPx: 24,
          verticalOverflowPx: 0
        }]
      },
      modalFocus: {
        dialogCount: 1,
        dialogSelector: "[role=\"dialog\"]",
        accessibleName: "Account settings",
        hasAccessibleName: true,
        initialFocusSelector: "#close-dialog",
        initialFocusInside: true,
        isModal: true,
        containmentTested: true,
        containmentSteps: 3,
        forwardFocusContained: true,
        backwardFocusContained: false,
        escapedFocusSelector: "#background-link",
        triggerSelector: "#open-dialog",
        escapeTested: true,
        escapeClosed: true,
        focusReturnedToTrigger: true
      },
      formErrors: {
        formCount: 1,
        fieldCount: 2,
        invalidFieldCount: 1,
        associatedErrorCount: 1,
        unassociatedInvalidCount: 0,
        errorSummaryCount: 1,
        invalidFields: [{
          selector: "#email",
          accessibleName: "Email address",
          errorReferenceIds: ["email-error"],
          associatedErrorText: "Enter a valid email address",
          focused: true
        }]
      },
      imageAlternatives: {
        imageCount: 3,
        decorativeCount: 1,
        informativeCount: 2,
        suspiciousCount: 1,
        repeatedAlternativeGroups: 0,
        samples: [{
          selector: "#hero",
          alt: "hero-banner.png",
          concerns: ["filename"]
        }]
      },
      media: {
        audioCount: 1,
        videoCount: 1,
        videosWithCaptions: 1,
        audioWithTranscriptCandidate: 1,
        autoplayRiskCount: 0,
        activeAnimationCount: 2,
        reducedMotionQueryDetected: true,
        unreadableStylesheetCount: 0,
        elements: [{
          selector: "#demo-video",
          kind: "video",
          autoplay: false,
          muted: false,
          controls: true,
          captionTrackCount: 1,
          transcriptCandidate: true
        }]
      },
      embeddedContent: {
        iframeCount: 1,
        sameOriginIframeCount: 1,
        crossOriginIframeCount: 0,
        inaccessibleIframeCount: 0,
        canvasCount: 1,
        canvasWithAlternativeCount: 0,
        canvasWithoutAlternativeCount: 1,
        iframes: [{
          selector: "#help-frame",
          url: "http://localhost:3000/help",
          sameOrigin: true,
          title: "Help",
          browserAccessible: true
        }],
        canvases: [{
          selector: "#sales-chart",
          width: 600,
          height: 400,
          decorative: false,
          hasAccessibleAlternative: false
        }]
      }
    },
    {
      id: "state-2",
      url: "http://localhost:3000/",
      title: "Demo",
      depth: 1,
      fingerprint: "def456",
      actionLabel: "Click: Open menu",
      screenshot: "screenshots/state-2.png",
      issueCount: 0,
      actionCount: 0,
      dynamicAnnouncements: {
        actionLabel: "Click: Open menu",
        regionsBefore: 1,
        regionsAfter: 1,
        updatesObserved: 1,
        meaningfulUpdates: 1,
        updates: [{
          selector: "[role=\"status\"]",
          role: "status",
          politeness: "polite",
          text: "Menu opened"
        }]
      }
    },
    {
      id: "state-3",
      url: "http://localhost:3000/",
      title: "Demo",
      depth: 1,
      fingerprint: "ghi789",
      actionLabel: "Click: Close menu",
      screenshot: "screenshots/state-1.png",
      screenshotFullPage: true,
      visualDuplicateOf: "state-1",
      issueCount: 0,
      actionCount: 0
    }
  ],
  edges: [
    {
      from: "state-1",
      to: "state-2",
      action: {
        id: "open-menu",
        type: "click",
        selector: "[aria-label=\"Open menu\"]",
        label: "Click: Open menu",
        text: "Open menu",
        role: "button"
      }
    }
  ],
  skippedActions: [
    {
      stateId: "state-1",
      type: "click",
      selector: "button[type=\"submit\"]",
      label: "Submit order",
      text: "Submit order",
      role: "button",
      reason: "Submit/reset controls are blocked by safe mode unless explicitly allowed."
    }
  ],
  summary: {
    statesVisited: 3,
    actionsTried: 1,
    skippedActions: 1,
    screenshots: 2,
    duplicateScreenshots: 1,
    maxDepth: 2,
    maxStates: 20
  }
};

const issues = [
  {
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
    tags: [],
    severity: "critical",
    selector: ".icon-button",
    url: "http://localhost:3000/",
    stateId: "state-1",
    stateLabel: "Initial page",
    colorScheme: "dark",
    ownership: {
      kind: "third-party-embed",
      label: "Third-party embedded content",
      source: "youtube.com",
      url: "https://www.youtube.com",
      note: "Third-party embedded content. Manual verification recommended."
    },
    screenshot: "screenshots/state-1.png",
    elementBounds: {
      x: 10,
      y: 20,
      width: 30,
      height: 12,
      coordinateSpace: "viewport"
    },
    message: "Buttons must have discernible text",
    fingerprint: "button-name::state-1",
    duplicateCount: 0
  }
];

test("renderExplorationHtml renders state screenshots, issues, and edges", () => {
  const html = renderExplorationHtml(graph, issues);

  assert.match(html, /a11y-shiftleft exploration report/);
  assert.match(html, /Generated: <time datetime="2026-06-09T00:00:00.000Z">9 June 2026, 00:00 UTC<\/time>/);
  assert.doesNotMatch(html, />Generated 2026-06-09T/);
  assert.match(html, /Scan scope: depth 2, up to 20 states, 3 rendered/);
  assert.match(html, /UI states explored/);
  assert.match(html, /Rendered states/);
  assert.match(html, /screenshots\/state-1\.png/);
  assert.match(html, /Unique screenshots/);
  assert.match(html, /Duplicate screenshots skipped/);
  assert.match(html, /Duplicate visual not stored again/);
  assert.match(html, /visual reused from state-1/);
  assert.match(html, /Open this state's annotated evidence/);
  assert.match(html, /button-name/);
  assert.match(html, /WCAG Level A/);
  assert.match(html, /WCAG 4\.1\.2 Name, Role, Value/);
  assert.match(html, /dark color scheme/);
  assert.match(html, /Buttons must have discernible text/);
  assert.doesNotMatch(html, /1 occurrence/);
  assert.match(html, /button-name[\s\S]*?<span class="badge">WCAG violation<\/span>[\s\S]*?WCAG Level A/);
  assert.doesNotMatch(html, /finding-occurrence">\s*<div><span class="badge badge-critical">critical<\/span> <span class="badge">WCAG violation<\/span><\/div>/);
  assert.doesNotMatch(html, /Grouped Fix Guidance/);
  assert.match(html, /<summary>How to fix<\/summary>/);
  assert.match(html, /<details class="remediation">\s*<summary>How to fix<\/summary>/);
  assert.doesNotMatch(html, /<details class="remediation" open>/);
  assert.match(html, /class="copy-issue"/);
  assert.match(html, />Copy issue<\/button>/);
  assert.match(html, /data-copy-issue-status aria-live="polite"/);
  assert.match(html, /navigator\.clipboard/);
  const copyPayload = html.match(/data-copy-issue="([^"]+)"/)?.[1];
  assert.ok(copyPayload);
  const decodedCopyPayload = decodeURIComponent(copyPayload);
  assert.match(decodedCopyPayload, /## button-name/);
  assert.match(decodedCopyPayload, /WCAG 4\.1\.2 Name, Role, Value \(A\)/);
  assert.match(decodedCopyPayload, /Ownership/);
  assert.match(html, /Give every button an accessible name/);
  assert.match(html, /Use visible button text when possible/);
  assert.match(html, /react example/);
  assert.match(html, /aria-label/);
  assert.match(html, /<th scope="col">Findings<\/th>/);
  assert.match(html, /npx a11y-shiftleft-cli audit --url 'http:\/\/localhost:3000' --out reports/);
  assert.doesNotMatch(html, /Run audit without --no-keyboard/);
  assert.match(html, /class="coverage-findings">&mdash;<\/td>/);
  assert.match(html, /Guidance 1/);
  assert.match(html, /Triage Overview/);
  assert.match(html, /Most Affected States/);
  assert.match(html, /Top Rules/);
  assert.match(html, /score 5/);
  assert.match(html, /WCAG 4\.1\.2 Name, Role, Value, Level A/);
  assert.match(html, /annotation annotation-critical/);
  assert.equal((html.match(/annotation annotation-critical/g) ?? []).length, 2);
  assert.match(html, /class="annotation-layer" aria-hidden="true"/);
  assert.match(html, /\.annotation-layer/);
  assert.match(html, /screenshot-frame screenshot-frame-full/);
  assert.match(html, /Open full-page evidence/);
  assert.match(html, /screenshot-frame-full[\s\S]*?object-fit: contain/);
  assert.match(html, /screenshot-frame-full[\s\S]*?aspect-ratio: auto/);
  assert.match(html, /screenshot-frame-full[\s\S]*?overflow: hidden/);
  assert.match(html, /screenshot-frame-full \.screenshot-scroll[\s\S]*?overflow: auto/);
  assert.match(html, /<div class="screenshot-scroll">\s*<div class="screenshot-stage">/);
  assert.match(html, /full-page evidence/);
  assert.match(html, /class="state state-critical" id="state-1"/);
  assert.match(html, /class="state state-ok state-compact" id="state-2"/);
  assert.match(html, /state-compact-summary/);
  assert.match(html, /No automated findings in this state\./);
  assert.match(html, /\.state-critical/);
  assert.doesNotMatch(html, /\.states \{[^}]*align-items: start/);
  assert.match(html, /grid-template-rows: auto auto/);
  assert.match(html, /min-height: 0/);
  assert.match(html, /summary::before/);
  assert.match(html, /flex: 0 0 24px/);
  assert.match(html, /summary::-webkit-details-marker/);
  assert.match(html, /\.issue:has\(details\[open\]\)/);
  assert.match(html, /\.remediation\[open\] \.remediation-body/);
  assert.match(html, /\.contrast-guidance\[open\] \.contrast-guidance-body/);
  assert.match(html, /position: absolute/);
  assert.match(html, /max-height: min\(380px, 60vh\)/);
  assert.match(html, /background: rgb\(180 35 24 \/ 10%\)/);
  assert.match(html, /--warning-marker: #f97316/);
  assert.match(html, /border-color: var\(--warning-marker\)/);
  assert.doesNotMatch(html, /9999px rgb\(30 36 48 \/ 4%\)/);
  assert.match(html, /Open annotated screenshot/);
  assert.match(html, /id="screenshot-state-1"/);
  assert.match(html, /Annotated screenshot for state-1/);
  assert.match(html, /left: 10%; top: 20%; width: 30%; height: 12%/);
  assert.match(html, /Exploration Details/);
  assert.match(html, /Start with Triage Overview and Checked States/);
  assert.match(html, /State transitions: 1/);
  assert.match(html, /state-1.*->.*state-2/s);
  assert.match(html, /Skipped actions: 1/);
  assert.match(html, /Submit\/reset controls are blocked by safe mode/);
  assert.match(html, /Coverage Note/);
});

test("renderExplorationHtml groups repeated remediation by rule", () => {
  const html = renderExplorationHtml(graph, [
    issues[0],
    {
      ...issues[0],
      selector: ".second-icon-button",
      fingerprint: "button-name::state-1::second"
    }
  ]);

  assert.match(html, /button-name<\/code>[\s\S]*?2 occurrences/);
  assert.match(html, /Affected findings \(2\)/);
  assert.equal((html.match(/<summary>How to fix<\/summary>/g) || []).length, 1);
});

test("renderExplorationHtml explains human verification blockers", () => {
  const html = renderExplorationHtml(graph, [{
    ...issues[0],
    ruleId: "adapter/human-verification",
    wcag: [],
    wcagCriteria: [],
    severity: "info",
    ownership: undefined,
    selector: "body",
    message: "Human verification challenge detected",
    fingerprint: "adapter/human-verification::state-1"
  }]);

  assert.match(html, /class="finding-context finding-context-blocked"/);
  assert.match(html, /Scan blocked by human verification/);
  assert.match(html, /CAPTCHA, bot protection, or a verify-you-are-human challenge/);
  assert.match(html, /Use a staging, preview, or allowlisted URL/);
});

test("renderExplorationHtml marks unavailable coverage evidence", () => {
  const html = renderExplorationHtml({
    ...graph,
    states: [{
      ...graph.states[0],
      embeddedContent: {
        ...graph.states[0].embeddedContent,
        inaccessibleIframeCount: 1,
        iframes: [{
          selector: "#video",
          url: "https://www.youtube.com/embed/demo",
          sameOrigin: false,
          title: "Video",
          browserAccessible: false
        }]
      }
    }]
  }, []);

  assert.match(html, /Embedded content/);
  assert.match(html, /coverage-state-unavailable/);
  assert.match(html, /1 unavailable document/);
});

test("renderExplorationHtml keeps source findings outside visual state groups", () => {
  const html = renderExplorationHtml(graph, [{
    ...issues[0],
    source: "eslint",
    stateId: undefined,
    screenshot: undefined,
    selector: undefined,
    file: "src/components/IconButton.tsx",
    fingerprint: "jsx-a11y/button-has-type::IconButton"
  }]);

  assert.match(html, /Non-visual Findings/);
  assert.match(html, /src\/components\/IconButton\.tsx/);
  assert.match(html, /<summary>How to fix<\/summary>/);
});

test("renderExplorationHtml escapes dynamic content", () => {
  const html = renderExplorationHtml({
    ...graph,
    startUrl: "http://localhost:3000/?q=<script>",
    states: [{
      ...graph.states[0],
      actionLabel: "Click: <script>alert(1)</script>",
      url: "http://localhost:3000/?q=<script>"
    }]
  }, issues);

  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("renderExplorationHtml renders color contrast evidence and suggestions", () => {
  const html = renderExplorationHtml(graph, [{
    ...issues[0],
    ruleId: "color-contrast",
    contrast: {
      actualRatio: 2.32,
      requiredRatio: 4.5,
      foreground: "#aaaaaa",
      background: "#ffffff",
      fontSize: "12.0pt (16px)",
      fontWeight: "normal",
      suggestions: [
        { target: "foreground", purpose: "minimum", color: "#767676", contrastRatio: 4.54 },
        { target: "foreground", purpose: "recommended", color: "#6F6F6F", contrastRatio: 5.02 },
        { target: "foreground", purpose: "enhanced", color: "#595959", contrastRatio: 7 }
      ]
    }
  }]);

  assert.match(html, /Contrast 2\.32:1/);
  assert.match(html, /required 4\.5:1/);
  assert.match(html, /Text <code>#aaaaaa<\/code>/);
  assert.match(html, /Background <code>#ffffff<\/code>/);
  assert.match(html, /Keep background #ffffff and change the text color/);
  assert.match(html, /<details class="contrast-evidence contrast-guidance">\s*<summary>Color recommendations<\/summary>/);
  assert.match(html, /<div class="contrast-guidance-body">\s*<div class="contrast-measurement">/);
  assert.match(html, /<summary>Color recommendations<\/summary>[\s\S]*?Contrast 2\.32:1[\s\S]*?Suggested accessible colors/);
  assert.match(html, /Minimum change: <code>#767676<\/code> → 4\.54:1/);
  assert.match(html, /Recommended: <code>#6F6F6F<\/code> → 5\.02:1/);
  assert.match(html, /Enhanced contrast: <code>#595959<\/code> → 7:1/);
  assert.match(html, /background-color: #767676/);
});

test("renderExplorationHtml shows identical contrast guidance once per screenshot", () => {
  const contrast = {
    actualRatio: 2.32,
    requiredRatio: 4.5,
    foreground: "#aaaaaa",
    background: "#ffffff",
    fontSize: "12.0pt (16px)",
    fontWeight: "normal",
    suggestions: [
      { target: "foreground" as const, purpose: "minimum" as const, color: "#767676", contrastRatio: 4.54 },
      { target: "foreground" as const, purpose: "recommended" as const, color: "#6F6F6F", contrastRatio: 5.02 }
    ]
  };
  const html = renderExplorationHtml(graph, [
    {
      ...issues[0],
      ruleId: "color-contrast",
      selector: ".first-muted-label",
      fingerprint: "color-contrast::first",
      contrast
    },
    {
      ...issues[0],
      ruleId: "color-contrast",
      selector: ".second-muted-label",
      fingerprint: "color-contrast::second",
      contrast
    }
  ]);

  assert.equal((html.match(/Contrast 2\.32:1/g) || []).length, 1);
  assert.equal((html.match(/Suggested accessible colors/g) || []).length, 1);
  assert.equal((html.match(/Minimum change: <code>#767676<\/code>/g) || []).length, 1);
  assert.match(html, /Shared recommendation for 2 findings/);
});

test("renderExplorationHtml renders focused evidence crops for long pages", () => {
  const focusedGraph = {
    ...graph,
    states: [{
      ...graph.states[0],
      screenshot: "screenshots/state-1-evidence-1.jpg",
      screenshotFullPage: false,
      screenshotEvidence: [
        {
          path: "screenshots/state-1-evidence-1.jpg",
          kind: "evidence-crop",
          issueCount: 1,
          width: 1280,
          height: 900
        },
        {
          path: "screenshots/state-1-evidence-2.jpg",
          kind: "evidence-crop",
          issueCount: 1,
          width: 1280,
          height: 900
        }
      ]
    }]
  };
  const focusedIssues = [
    {
      ...issues[0],
      screenshot: "screenshots/state-1-evidence-1.jpg"
    },
    {
      ...issues[0],
      ruleId: "link-name",
      fingerprint: "link-name::state-1",
      screenshot: "screenshots/state-1-evidence-2.jpg"
    }
  ];
  const html = renderExplorationHtml(focusedGraph, focusedIssues);

  assert.match(html, /2 focused evidence captures/);
  assert.match(html, /state-1-evidence-1\.jpg/);
  assert.match(html, /state-1-evidence-2\.jpg/);
  assert.match(html, /Open focused evidence 1/);
  assert.match(html, /Open focused evidence 2/);
  assert.match(html, /id="screenshot-state-1-2"/);
  assert.equal((html.match(/annotation annotation-critical/g) ?? []).length, 4);
});

test("transformBoundsForContainedPreview aligns annotations on tall screenshots", () => {
  const transformed = transformBoundsForContainedPreview({
    x: 10,
    y: 20,
    width: 30,
    height: 12,
    coordinateSpace: "document"
  }, 1280, 2400);

  assert.deepEqual(transformed, {
    x: 38,
    y: 20,
    width: 9,
    height: 12,
    coordinateSpace: "document"
  });
});

test("renderExplorationHtml keeps full-page preview annotations in document coordinates", () => {
  const html = renderExplorationHtml(graph, issues);
  const frameStart = html.indexOf('<div class="screenshot-frame screenshot-frame-full">');
  const frameEnd = html.indexOf('<a class="screenshot-open"', frameStart);
  const frameHtml = html.slice(frameStart, frameEnd);

  assert.match(frameHtml, /left: 10%; top: 20%; width: 30%; height: 12%/);
  assert.doesNotMatch(frameHtml, /left: 38%; top: 20%; width: 9%; height: 12%/);
});

test("transformBoundsForContainedPreview aligns annotations on wide screenshots", () => {
  const transformed = transformBoundsForContainedPreview({
    x: 10,
    y: 20,
    width: 30,
    height: 12,
    coordinateSpace: "viewport"
  }, 1600, 800);

  assert.deepEqual(transformed, {
    x: 10,
    y: 23.333,
    width: 30,
    height: 10.667,
    coordinateSpace: "viewport"
  });
});

test("renderExplorationHtml labels best practices separately from WCAG findings", () => {
  const html = renderExplorationHtml(graph, [{
    ...issues[0],
    ruleId: "heading-order",
    wcag: [],
    wcagCriteria: [],
    tags: ["best-practice"],
    severity: "warning",
    confidence: undefined,
    confidenceScore: undefined,
    confidenceReason: undefined,
    findingType: undefined,
    category: undefined,
    selector: "h3",
    message: "Heading levels should only increase by one"
  }]);

  assert.match(html, /Best practices<\/span>/);
  assert.match(html, /best practice<\/span>/);
  assert.doesNotMatch(html, /Likely Root Causes/);
  assert.doesNotMatch(html, /WCAG 1\.3\.1/);
});

test("renderExplorationHtml provides fallback guidance for unknown rules", () => {
  const html = renderExplorationHtml(graph, [{
    ...issues[0],
    ruleId: "custom-unmapped-rule",
    wcag: [],
    wcagCriteria: [],
    helpUrl: "https://example.com/custom-rule",
    remediation: undefined,
    message: "Review this custom accessibility condition"
  }]);

  assert.match(html, /resolve the custom-unmapped-rule accessibility rule/);
  assert.match(html, /Inspect the reported selector or source location/);
  assert.match(html, /href="https:\/\/example\.com\/custom-rule"/);
});

test("renderExplorationHtml keeps overflow report data in collapsed sections", () => {
  const overflowIssues = Array.from({ length: 9 }, (_, index) => ({
    ...issues[0],
    ruleId: `test-rule-${index + 1}`,
    message: `Finding ${index + 1}`,
    fingerprint: `finding-${index + 1}`,
    elementBounds: undefined
  }));
  const overflowEdges = Array.from({ length: 13 }, (_, index) => ({
    ...graph.edges[0],
    action: {
      ...graph.edges[0].action,
      id: `action-${index + 1}`,
      label: `Transition ${index + 1}`
    }
  }));
  const overflowActions = Array.from({ length: 21 }, (_, index) => ({
    ...graph.skippedActions[0],
    label: `Skipped action ${index + 1}`
  }));

  const html = renderExplorationHtml({
    ...graph,
    edges: overflowEdges,
    skippedActions: overflowActions
  }, overflowIssues);

  assert.match(html, /Show 1 more rule group/);
  assert.match(html, /Finding 9/);
  assert.match(html, /Show 1 more transition/);
  assert.match(html, /Transition 13/);
  assert.match(html, /Show 1 more skipped action/);
  assert.match(html, /Skipped action 21/);
});

test("writeExplorationHtml writes exploration.html", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-exploration-html-"));

  await writeExplorationHtml(outputDir, graph, issues);

  const html = await fs.readFile(path.join(outputDir, "exploration.html"), "utf8");
  assert.match(html, /state-1/);
  assert.match(html, /button-name/);
});

test("writeExplorationHtml can create a unified audit report", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-audit-html-"));
  await writeExplorationHtml(outputDir, graph, issues, {
    fileName: "a11y-report.html",
    title: "Accessibility Audit Report",
    keyboard: {
      url: "http://localhost:3000",
      generatedAt: "2026-06-21T00:00:00.000Z",
      durationMs: 10,
      maxTabs: 40,
      focusableCount: 2,
      completedCycle: false,
      steps: [{
        index: 1,
        direction: "forward",
        selector: "#search",
        tagName: "input",
        role: "searchbox",
        accessibleName: "Search products",
        tabIndex: 0,
        visible: true,
        focusVisible: true,
        indicatorVisible: true,
        obscured: false,
        pageState: {
          id: "keyboard-state-1",
          url: "http://localhost:3000",
          title: "Demo",
          heading: "Demo",
          scrollX: 0,
          scrollY: 0,
          viewportWidth: 1280,
          viewportHeight: 720,
          openDialogs: 0,
          expandedControls: 0
        }
      }, {
        index: 2,
        direction: "forward",
        selector: "#buy",
        tagName: "button",
        role: "button",
        accessibleName: "Buy now",
        tabIndex: 0,
        visible: true,
        focusVisible: false,
        indicatorVisible: false,
        obscured: true,
        pageState: {
          id: "keyboard-state-1",
          url: "http://localhost:3000",
          title: "Demo",
          heading: "Demo",
          scrollX: 0,
          scrollY: 0,
          viewportWidth: 1280,
          viewportHeight: 720,
          openDialogs: 0,
          expandedControls: 0
        }
      }],
      backwardSteps: [],
      reverseOrderMatches: null,
      activationAttempts: [],
      issues: []
    },
    manualChecklist: {
      generatedAt: "2026-06-21T00:00:00.000Z",
      framework: "react",
      urls: ["http://localhost:3000"],
      items: [{
        id: "form-label-quality",
        title: "Meaningful form labels and instructions",
        principle: "understandable",
        wcag: ["1.3.1", "3.3.2"],
        whyManual: "Label quality requires human review.",
        steps: ["Review each form label."],
        evidence: ["Form review notes"],
        targets: [{
          id: "state-1:form:#email",
          kind: "form",
          label: "Email address",
          url: "http://localhost:3000",
          stateId: "state-1",
          selector: "#email",
          evidence: "1 invalid field without an exposed associated error"
        }],
        review: {
          status: "not-reviewed",
          tester: "",
          testedAt: "",
          environment: "",
          notes: "",
          evidenceLinks: [],
          remediationOwner: ""
        }
      }]
    },
    lighthouse: [{
      url: "http://localhost:3000",
      finalUrl: "http://localhost:3000/",
      accessibilityScore: 91,
      failedAudits: [{
        id: "color-contrast",
        title: "Background and foreground colors have sufficient contrast",
        score: 0,
        scoreDisplayMode: "binary",
        description: "Low-contrast text can be difficult to read.",
        documentationUrl: "https://example.com/contrast"
      }],
      manualAudits: [{
        id: "logical-tab-order",
        title: "The page has a logical tab order",
        score: null,
        scoreDisplayMode: "manual",
        description: "Confirm focus order manually.",
        documentationUrl: "https://example.com/tab-order"
      }],
      notApplicableAudits: 3,
      durationMs: 1500
    }]
  });

  const html = await fs.readFile(path.join(outputDir, "a11y-report.html"), "utf8");
  assert.match(html, /Accessibility Audit Report/);
  assert.match(html, /Evaluation Scope/);
  assert.match(html, /class="panel evaluation-scope"/);
  assert.match(html, /Reproducibility scope, not a WCAG conformance claim/);
  assert.match(html, /not a WCAG conformance claim/);
  assert.match(html, /evaluation-scope\.json/);
  assert.match(html, /Share Review Copy/);
  assert.match(html, /\.share-review \{[\s\S]*?grid-column: 1 \/ -1/);
  assert.match(html, /npx a11y-shiftleft-cli share prepare --report reports --out a11y-share/);
  assert.match(html, /share-summary\.md/);
  assert.match(html, /Keep screenshots, full visual HTML, raw keyboard traces, and raw browser evidence inside the project/);
  assert.match(html, /Evidence collected[\s\S]*?axe/);
  assert.match(html, /keyboard traversal/);
  assert.match(html, /Lighthouse comparison/);
  assert.match(html, /Quick Review/);
  assert.match(html, /Fix First/);
  assert.match(html, /First Tab Stops/);
  assert.match(html, /Human Review Next/);
  assert.match(html, /WCAG Level A/);
  assert.match(html, /Third-party embedded content/);
  assert.match(html, /class="finding-context finding-context-third-party"/);
  assert.match(html, /Ownership: Third-party embedded content/);
  assert.match(html, /Source: <a href="https:\/\/www\.youtube\.com\/" target="_blank" rel="noopener noreferrer">youtube\.com<\/a>/);
  assert.match(html, /Third-party embedded content\. Manual verification recommended\./);
  assert.match(html, /1\. Search products/);
  assert.match(html, /review focus visibility/);
  assert.match(html, /1 observed target/);
  assert.match(html, /Keyboard Audit/);
  assert.match(html, /Visual Tab Order/);
  assert.match(html, /Search products/);
  assert.match(html, /Buy now/);
  assert.match(html, /focus indicator not detected; control may be obscured/);
  assert.match(html, /class="focus-path-item focus-path-item-risk"/);
  assert.match(html, /Complete focus path data/);
  assert.match(html, /Manual Review Checklist/);
  assert.match(html, /Observed review targets/);
  assert.match(html, /form: Email address/);
  assert.match(html, /href="#state-1">Open state-1/);
  assert.match(html, /1 review area has observed targets from this audit/);
  assert.match(html, /Audit Coverage/);
  assert.match(html, /Lighthouse Comparison/);
  assert.match(html, /Lighthouse is a score-oriented comparison signal/);
  assert.match(html, /Average score[\s\S]*?91/);
  assert.match(html, /Background and foreground colors have sufficient contrast/);
  assert.match(html, /href="https:\/\/example\.com\/contrast"/);
  assert.match(html, /Lighthouse score/);
  assert.match(html, /1 page score captured/);
  assert.match(html, /Lighthouse and pipeline comparison/);
  assert.match(html, /Same rule IDs/);
  assert.match(html, /No matching failed rule IDs/);
  assert.match(html, /Lighthouse-only failed audits/);
  assert.match(html, /Pipeline-only rules/);
  assert.match(html, /button-name<\/code> 1 finding · critical · axe/);
  assert.match(html, /Lighthouse recommendations/);
  assert.match(html, /Failed audit/);
  assert.match(html, /Low-contrast text can be difficult to read/);
  assert.match(html, /Open Lighthouse guidance/);
  assert.match(html, /Manual review/);
  assert.match(html, /Confirm focus order manually/);
  assert.match(html, /class="coverage-table"/);
  assert.match(html, /Audit coverage evidence state summary/);
  assert.match(html, /coverage-legend-item coverage-legend-failed/);
  assert.match(html, /Failed evidence/);
  assert.match(html, /Needs review/);
  assert.match(html, /Not tested/);
  assert.match(html, /Unavailable/);
  assert.match(html, /Passed evidence/);
  assert.match(html, /Evidence state/);
  assert.match(html, /class="coverage-state-cell"/);
  assert.match(html, /class="coverage-status-cell"/);
  assert.match(html, /coverage-state-failed/);
  assert.match(html, /coverage-state-passed/);
  assert.match(html, /coverage-state-needs-review/);
  assert.match(html, /data-coverage-state data-default-state="needs-review"/);
  assert.match(html, /\.coverage-row-review:not\(\.coverage-row-reviewed\):hover/);
  assert.match(html, /coverage-row-state-/);
  assert.match(html, /Browser automation: evidence collected automatically/);
  assert.match(html, /type="checkbox" checked disabled/);
  assert.match(html, /data-coverage-review="screen-reader"/);
  assert.match(html, /Screen reader: mark manual review complete/);
  assert.ok(html.indexOf("Browser automation") < html.indexOf("Screen reader"));
  assert.match(html, /data-coverage-progress aria-live="polite"/);
  assert.match(html, /a11y-shiftleft:coverage:/);
  assert.match(html, /class="coverage-findings">0<\/td>/);
  assert.match(html, /Accessibility tree evidence/);
  assert.match(html, /Unnamed interactive/);
  assert.match(html, /Reflow evidence at 400% \(320 CSS px simulation\)/);
  assert.match(html, /Clipped account instructions/);
  assert.match(html, /Modal focus evidence/);
  assert.match(html, /Account settings/);
  assert.match(html, /returned to trigger/);
  assert.match(html, /Modal semantics/);
  assert.match(html, /forward contained; reverse escaped \(3 bounded steps per direction\)/);
  assert.match(html, /#background-link/);
  assert.doesNotMatch(html, /Dynamic announcement evidence/);
  assert.doesNotMatch(html, /Menu opened/);
  assert.match(html, /Form error evidence/);
  assert.match(html, /Email address/);
  assert.match(html, /Enter a valid email address/);
  assert.match(html, /Image alternative-text evidence/);
  assert.match(html, /hero-banner\.png/);
  assert.match(html, /Media and motion evidence/);
  assert.match(html, /#demo-video/);
  assert.match(html, /Reduced-motion CSS query detected: yes/);
  assert.match(html, /Iframe and canvas evidence/);
  assert.match(html, /#sales-chart/);
  assert.match(html, /Modern axe scans accessible frame documents recursively/);
});

test("renderExplorationHtml hides successful per-state diagnostic details", () => {
  const cleanGraph = {
    ...graph,
    states: [{
      ...graph.states[0],
      accessibilityTree: {
        ...graph.states[0].accessibilityTree,
        unnamedInteractiveNodes: 0
      },
      reflow: {
        ...graph.states[0].reflow,
        documentWidth: 320,
        horizontalOverflowPx: 0,
        clippedTextCount: 0,
        clippedTextSample: []
      },
      formErrors: {
        ...graph.states[0].formErrors,
        invalidFieldCount: 0,
        associatedErrorCount: 0,
        unassociatedInvalidCount: 0,
        errorSummaryCount: 0,
        invalidFields: []
      },
      imageAlternatives: {
        ...graph.states[0].imageAlternatives,
        suspiciousCount: 0,
        repeatedAlternativeGroups: 0,
        samples: []
      }
    }]
  };

  const html = renderExplorationHtml(cleanGraph, []);

  assert.doesNotMatch(html, /<summary>Accessibility tree evidence<\/summary>/);
  assert.doesNotMatch(html, /<summary>Reflow evidence at 400% \(320 CSS px simulation\)<\/summary>/);
  assert.doesNotMatch(html, /<summary>Form error evidence<\/summary>/);
  assert.doesNotMatch(html, /<summary>Image alternative-text evidence<\/summary>/);
  assert.match(html, /Audit Coverage/);
  assert.match(html, /1 state checked for overflow and clipped text/);
  assert.match(html, /0 image alternatives flagged for human review/);
  assert.match(html, /coverage-state-not-tested/);
  assert.match(html, /coverage-state-passed/);
});
