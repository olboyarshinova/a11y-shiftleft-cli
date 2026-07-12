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
    maxStates: 20,
    browser: {
      engine: "chromium",
      name: "Chromium",
      version: "141.0.0.0",
      source: "exploration"
    }
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

function issueBlockForRule(html: string, ruleId: string, stateId = "state-1"): string {
  const stateStart = html.indexOf(`id="${stateId}"`);
  const issueStart = html.indexOf(`<code>${ruleId}</code>`, stateStart);
  assert.ok(issueStart >= 0, `Expected ${ruleId} in ${stateId}`);

  const nextIssue = html.indexOf('<li class="issue">', issueStart + 1);
  const stateEnd = html.indexOf("</article>", issueStart);
  const endCandidates = [nextIssue, stateEnd].filter((index) => index >= 0);
  const issueEnd = Math.min(...endCandidates);
  return html.slice(issueStart, issueEnd);
}

test("renderExplorationHtml renders state screenshots, issues, and edges", () => {
  const html = renderExplorationHtml(graph, issues);

  assert.match(html, /a11y-shiftleft exploration report/);
  assert.match(html, /<strong>a11y-shiftleft-cli<\/strong>/);
  assert.match(html, /Visual accessibility report generated by the open-source project/);
  assert.match(html, /href="https:\/\/github\.com\/olboyarshinova\/a11y-shiftleft-cli"/);
  assert.match(html, /Generated: <time datetime="2026-06-09T00:00:00.000Z">9 June 2026, 00:00 UTC<\/time>/);
  assert.doesNotMatch(html, />Generated 2026-06-09T/);
  assert.match(html, /Scan depth: 2 interaction levels from the start page/);
  assert.match(html, /Scan scope: up to 20 states, 3 rendered/);
  assert.match(html, /<span>Exploration depth<\/span>/);
  assert.match(html, /2 interaction levels from the start page[\s\S]*?<span>Exploration depth<\/span>/);
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
  assert.match(html, /<div class="triage-title">\s*<div class="triage-title-main">\s*<code>button-name<\/code>[\s\S]*?<\/div>\s*<div class="issue-actions">/);
  assert.match(html, /\.triage-title \.issue-actions \{[\s\S]*?margin-top: 0/);
  assert.match(html, /\.copy-issue-ticket \{[\s\S]*?width: 72px/);
  assert.match(html, /\.copy-issue-ticket span \{[\s\S]*?display: block/);
  assert.match(html, /class="copy-issue copy-issue-ticket"/);
  assert.match(html, /title="Copy a GitHub\/Jira-ready Markdown summary"/);
  assert.match(html, /<span>Copy for<\/span><span>ticket<\/span><\/button>/);
  assert.match(html, /data-copy-issue-status aria-live="polite"/);
  assert.match(html, /navigator\.clipboard/);
  assert.match(html, /Copied ticket draft/);
  assert.match(html, /Ticket Drafts/);
  assert.ok(html.indexOf("Ticket Drafts") < html.indexOf("Exploration summary"));
  assert.match(html, /class="report-header-grid"/);
  assert.match(html, /\.report-header-grid \{/);
  assert.match(html, /\.ticket-drafts \{[\s\S]*?align-self: start/);
  assert.match(html, /\.ticket-drafts \{[\s\S]*?margin-top: 0/);
  assert.match(html, /@media \(min-width: 1100px\) \{[\s\S]*?\.ticket-drafts \{[\s\S]*?margin-top: 44px/);
  assert.ok(html.indexOf('aria-label="Exploration summary"') < html.indexOf('aria-label="Finding summary"'));
  assert.match(html, /main \{[\s\S]*?gap: 12px[\s\S]*?padding: 12px/);
  assert.match(html, /\.panel \{[\s\S]*?padding: 12px/);
  assert.match(html, /\.metric \{[\s\S]*?padding: 8px 10px/);
  assert.match(html, /\.metric strong \{[\s\S]*?font-size: 20px/);
  assert.match(html, /\.metric span \{[\s\S]*?font-size: 12px/);
  assert.match(html, /\.state-body \{[\s\S]*?gap: 8px[\s\S]*?padding: 10px/);
  assert.match(html, /class="metric metric-critical(?: metric-zero)?"/);
  assert.match(html, /class="metric metric-warning(?: metric-zero)?"/);
  assert.match(html, /class="metric metric-info(?: metric-zero)?"/);
  assert.match(html, /class="metric metric-wcag(?: metric-zero)?"/);
  assert.match(html, /class="metric metric-needs-review(?: metric-zero)?"/);
  assert.match(html, /class="metric metric-best-practice(?: metric-zero)?"/);
  assert.match(html, /class="metric metric-info metric-zero"/);
  assert.match(html, /\.metric-critical strong,[\s\S]*?\.metric-wcag strong \{[\s\S]*?color: var\(--critical\)/);
  assert.match(html, /\.metric-warning strong,[\s\S]*?\.metric-needs-review strong \{[\s\S]*?color: var\(--warning-marker\)/);
  assert.match(html, /\.metric-info strong,[\s\S]*?\.metric-best-practice strong \{[\s\S]*?color: var\(--info\)/);
  assert.match(html, /\.metric-zero strong \{[\s\S]*?color: var\(--ok\)/);
  assert.doesNotMatch(html, /\.metric-wcag \{[\s\S]*?background:/);
  assert.match(html, /Copy all ticket drafts \(1\)/);
  assert.match(html, /Copy local Markdown drafts grouped by issue type/);
  assert.match(html, /title="Copy Markdown drafts grouped by issue type"/);
  assert.match(html, /data-copy-all-ticket-drafts-status aria-live="polite"><\/span>\s*<button class="copy-issue" type="button" title="Copy Markdown drafts grouped by issue type" data-copy-all-ticket-drafts>/);
  assert.match(html, /data-copy-all-ticket-drafts/);
  assert.match(html, /data-copy-all-ticket-drafts-status aria-live="polite"/);
  assert.match(html, /id="all-ticket-drafts"/);
  assert.match(html, /allTicketsTemplate\.content\?\.textContent/);
  assert.match(html, /Nothing to copy/);
  assert.match(html, /Copied all ticket drafts/);
  const copyPayload = html.match(/data-copy-issue="([^"]+)"/)?.[1];
  assert.ok(copyPayload);
  const decodedCopyPayload = decodeURIComponent(copyPayload);
  assert.match(decodedCopyPayload, /## button-name/);
  assert.match(decodedCopyPayload, /WCAG 4\.1\.2 Name, Role, Value \(A\)/);
  assert.match(decodedCopyPayload, /Ownership/);
  assert.match(html, /# Accessibility Ticket Drafts/);
  assert.match(html, /&lt;!-- Ticket draft 1 of 1 --&gt;/);
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
  assert.doesNotMatch(html, /score 5/);
  assert.match(html, /WCAG 4\.1\.2 Name, Role, Value, Level A/);
  assert.match(html, /annotation annotation-critical/);
  assert.equal((html.match(/annotation annotation-critical/g) ?? []).length, 2);
  assert.match(html, /<span class="annotation-number">1<\/span><\/span>/);
  assert.match(html, /<span class="finding-marker finding-marker-critical" title="Screenshot marker 1">1<\/span>/);
  assert.match(html, /class="annotation-layer" aria-hidden="true"/);
  assert.match(html, /\.annotation-layer/);
  assert.match(html, /class="screenshot-lightbox-backdrop" href="#state-1" aria-label="Close annotated screenshot"/);
  assert.match(html, /\.screenshot-lightbox-backdrop \{/);
  assert.match(html, /screenshot-frame screenshot-frame-full/);
  assert.match(html, /Open scrollable full-page screenshot/);
  assert.match(html, /screenshot-frame-full[\s\S]*?object-fit: contain/);
  assert.match(html, /screenshot-frame-full[\s\S]*?aspect-ratio: auto/);
  assert.match(html, /screenshot-frame-full[\s\S]*?overflow: hidden/);
  assert.match(html, /screenshot-frame-full \.screenshot-scroll[\s\S]*?overflow: auto/);
  assert.match(html, /screenshot-frame-full \.screenshot-scroll[\s\S]*?scrollbar-gutter: stable both-edges/);
  assert.match(html, /screenshot-frame-full \.screenshot-stage[\s\S]*?min-height: 0/);
  assert.match(html, /<div class="screenshot-scroll">\s*<div class="screenshot-stage">/);
  assert.match(html, /\.screenshot-evidence-grid \.screenshot-frame \{[\s\S]*?align-self: start/);
  assert.doesNotMatch(html, /<span class="badge">full-page evidence<\/span>/);
  assert.doesNotMatch(html, /actions queued/);
  assert.match(html, /class="state state-critical" id="state-1"/);
  assert.match(html, /class="state state-ok state-compact" id="state-2"/);
  assert.match(html, /state-compact-summary/);
  assert.match(html, /No automated findings in this state\./);
  assert.match(html, /\.state-critical/);
  assert.match(html, /\.states \{[\s\S]*?align-items: start/);
  assert.match(html, /\.screenshot-evidence-grid \{[\s\S]*?align-items: start/);
  assert.match(html, /\.state-body \{[\s\S]*?align-content: start/);
  assert.match(html, /\.state-body \{[\s\S]*?align-items: start/);
  assert.match(html, /\.state-body > \* \{[\s\S]*?align-self: start/);
  assert.match(html, /\.issue-list,[\s\S]*?align-items: start/);
  assert.match(html, /\.issue \{[\s\S]*?align-self: start/);
  assert.match(html, /aspect-ratio: var\(--screenshot-aspect, 16 \/ 9\)/);
  assert.match(html, /grid-template-rows: auto auto/);
  assert.match(html, /min-height: 0/);
  assert.match(html, /summary::before/);
  assert.match(html, /flex: 0 0 24px/);
  assert.match(html, /summary::-webkit-details-marker/);
  assert.match(html, /\.panel:has\(\.remediation\[open\]\)/);
  assert.match(html, /\.state:has\(details\[open\]\)/);
  assert.match(html, /\.state:has\(\.remediation\[open\]\)/);
  assert.match(html, /\.issue-list:has\(details\[open\]\)/);
  assert.match(html, /\.issue-list:has\(\.remediation\[open\]\)/);
  assert.match(html, /\.states:has\(\.screenshot-lightbox:target\)/);
  assert.match(html, /\.state:has\(\.screenshot-lightbox:target\)/);
  assert.match(html, /\.screenshot-lightbox \{[\s\S]*?z-index: 1001/);
  assert.match(html, /\.issue:has\(details\[open\]\)/);
  assert.match(html, /\.issue:has\(\.remediation\[open\]\)/);
  assert.match(html, /\.remediation\[open\] \.remediation-body/);
  assert.match(html, /\.remediation\[open\][\s\S]*?z-index: 90/);
  assert.match(html, /\.remediation\[open\] \.remediation-body[\s\S]*?z-index: 100/);
  assert.match(html, /\.contrast-guidance-title/);
  assert.doesNotMatch(html, /\.contrast-guidance\[open\] \.contrast-guidance-body/);
  assert.match(html, /position: absolute/);
  assert.match(html, /max-height: min\(380px, 60vh\)/);
  assert.match(html, /--critical: #d0001b/);
  assert.match(html, /background: rgb\(208 0 27 \/ 12%\)/);
  assert.match(html, /--warning-marker: #f97316/);
  assert.match(html, /border-color: var\(--warning-marker\)/);
  assert.doesNotMatch(html, /9999px rgb\(30 36 48 \/ 4%\)/);
  assert.match(html, /Open annotated screenshot/);
  assert.match(html, /id="screenshot-state-1"/);
  assert.match(html, /Annotated screenshot for state-1/);
  assert.match(html, /left: 10%; top: 20%; width: 30%; height: 12%/);
  assert.doesNotMatch(html, /Exploration Details/);
  assert.doesNotMatch(html, /State transitions and skipped actions can be saved to <code>exploration-graph\.json<\/code> with <code>--raw<\/code>/);
  assert.match(html, /Coverage Note/);
  assert.match(html, /\.panel-full-width \{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?width: 100%;/);
  assert.match(html, /class="panel panel-full-width coverage-note" aria-label="Manual review note"/);
});

test("renderExplorationHtml groups all ticket drafts by issue type across states", () => {
  const html = renderExplorationHtml(graph, [
    issues[0],
    {
      ...issues[0],
      stateId: "state-2",
      stateLabel: "Click: Open menu",
      selector: ".menu-icon-button",
      fingerprint: "button-name::state-2",
      url: "http://localhost:3000/menu"
    }
  ]);

  assert.match(html, /Copy all ticket drafts \(1\)/);
  assert.match(html, /Generated by a11y-shiftleft-cli for 1 finding group/);
  assert.match(html, /Findings in group: 2/);
  assert.match(html, /`\.icon-button` \(page: http:\/\/localhost:3000\/; state: state-1 \(Initial page\)\)/);
  assert.match(html, /`\.menu-icon-button` \(page: http:\/\/localhost:3000\/menu; state: state-2 \(Click: Open menu\)\)/);
});

test("renderExplorationHtml gives every table an accessible name for PDF export", () => {
  const html = renderExplorationHtml(graph, issues);
  const tableTags = html.match(/<table\b[^>]*>/g) || [];
  const unlabeledTables = tableTags.filter((tag) => (
    !/aria-label=/.test(tag) &&
    !/aria-labelledby=/.test(tag)
  ));

  assert.ok(tableTags.length > 0);
  assert.deepEqual(unlabeledTables, []);
});

test("renderExplorationHtml hides findings already shown in earlier states", () => {
  const modalGraph = {
    ...graph,
    states: graph.states.map((state) => state.id === "state-2"
      ? {
        ...state,
        modalFocus: {
          dialogCount: 1,
          dialogSelector: "[role=\"dialog\"]",
          dialogBounds: {
            x: 60,
            y: 20,
            width: 30,
            height: 50,
            coordinateSpace: "document" as const
          },
          isModal: true,
          hasAccessibleName: false,
          initialFocusInside: false,
          escapeTested: true
        }
      }
      : state)
  };
  const repeatedBackgroundIssue = {
    ...issues[0],
    selector: "article:nth-child(7) > .icon-button",
    stateId: "state-2",
    stateLabel: "Click: Open audit modal",
    screenshot: "screenshots/state-2.png",
    fingerprint: "button-name::state-2::background-repeat",
    elementBounds: {
      x: 10,
      y: 20,
      width: 30,
      height: 12,
      coordinateSpace: "document" as const
    }
  };
  const modalIssue = {
    ...issues[0],
    selector: "main > div > div > div > button",
    stateId: "state-2",
    stateLabel: "Click: Open audit modal",
    screenshot: "screenshots/state-2.png",
    fingerprint: "button-name::state-2::modal-close",
    elementBounds: {
      x: 70,
      y: 25,
      width: 8,
      height: 8,
      coordinateSpace: "viewport" as const
    }
  };
  const html = renderExplorationHtml(modalGraph, [issues[0], repeatedBackgroundIssue, modalIssue]);
  const state1Start = html.indexOf('id="state-1"');
  const state1End = html.indexOf("</article>", state1Start);
  const state1Html = html.slice(state1Start, state1End);
  const state2Start = html.indexOf('id="state-2"');
  const state2End = html.indexOf("</article>", state2Start);
  const state2Html = html.slice(state2Start, state2End);

  assert.match(state1Html, /\.icon-button/);
  assert.doesNotMatch(state2Html, /\.icon-button/);
  assert.doesNotMatch(state2Html, /article:nth-child\(7\)/);
  assert.match(state2Html, /main &gt; div &gt; div &gt; div &gt; button/);
  assert.match(state2Html, /1 critical/);
});

test("renderExplorationHtml sorts rule triage by severity and WCAG level", () => {
  const criterion = (
    id: string,
    title: string,
    level: "A" | "AA" | "AAA"
  ) => ({
    id,
    title,
    level,
    principle: "perceivable",
    introducedIn: "2.0",
    url: `https://example.com/wcag-${id}`
  });
  const triageIssues = [
    {
      ...issues[0],
      ruleId: "warning-a",
      severity: "warning",
      wcagCriteria: [criterion("1.1.1", "Non-text Content", "A")],
      message: "Warning level A issue",
      fingerprint: "warning-a"
    },
    {
      ...issues[0],
      ruleId: "critical-aa",
      severity: "critical",
      wcagCriteria: [criterion("1.4.3", "Contrast (Minimum)", "AA")],
      message: "Critical level AA issue",
      fingerprint: "critical-aa"
    },
    {
      ...issues[0],
      ruleId: "info-aaa",
      severity: "info",
      wcagCriteria: [criterion("2.2.6", "Timeouts", "AAA")],
      message: "Info level AAA issue",
      fingerprint: "info-aaa"
    },
    {
      ...issues[0],
      ruleId: "critical-a",
      severity: "critical",
      wcagCriteria: [criterion("2.1.1", "Keyboard", "A")],
      message: "Critical level A issue",
      fingerprint: "critical-a"
    }
  ];
  const html = renderExplorationHtml(graph, triageIssues);
  const topRules = html.match(/<h3>Top Rules<\/h3>\s*<ol class="triage-list">([\s\S]*?)<\/ol>/)?.[1] || "";
  const stateOne = html.slice(
    html.indexOf('<article class="state state-critical" id="state-1"'),
    html.indexOf('<article class="state state-ok state-compact" id="state-2"')
  );
  const stateGroupOrder = [...stateOne.matchAll(/<li class="issue">[\s\S]*?<code>(critical-a|critical-aa|warning-a|info-aaa)<\/code>/g)]
    .map((match) => match[1]);

  assert.match(topRules, /critical-a/);
  assert.match(topRules, /critical-aa/);
  assert.match(topRules, /warning-a/);
  assert.doesNotMatch(topRules, /info-aaa/);
  assert.match(html, /\+ 1 more rule shown in the state findings below\./);
  assert.deepEqual(stateGroupOrder, ["critical-a", "critical-aa", "warning-a", "info-aaa"]);
});

test("renderExplorationHtml ranks repeated warning rules before one-off warning rules", () => {
  const criterion = (
    id: string,
    title: string,
    level: "A" | "AA"
  ) => ({
    id,
    title,
    level,
    principle: "operable",
    introducedIn: "2.0",
    url: `https://example.com/wcag-${id}`
  });
  const triageIssues = [
    {
      ...issues[0],
      ruleId: "keyboard-focus-cycle",
      severity: "warning",
      wcagCriteria: [criterion("2.1.1", "Keyboard", "A")],
      message: "One keyboard warning",
      fingerprint: "keyboard-focus-cycle"
    },
    {
      ...issues[0],
      ruleId: "color-contrast",
      severity: "warning",
      duplicateCount: 27,
      wcagCriteria: [criterion("1.4.3", "Contrast (Minimum)", "AA")],
      message: "Repeated contrast warning",
      fingerprint: "color-contrast"
    }
  ];
  const html = renderExplorationHtml(graph, triageIssues);
  const topRules = html.match(/<h3>Top Rules<\/h3>\s*<ol class="triage-list">([\s\S]*?)<\/ol>/)?.[1] || "";

  assert.match(topRules, /color-contrast/);
  assert.match(topRules, /keyboard-focus-cycle/);
  assert.match(topRules, /28 occurrences/);
});

test("renderExplorationHtml keeps Top Rules close to Most Affected States height", () => {
  const manyRuleIssues = Array.from({ length: 6 }, (_, index) => ({
    ...issues[0],
    ruleId: `rule-${index + 1}`,
    severity: "warning" as const,
    message: `Warning rule ${index + 1}`,
    fingerprint: `rule-${index + 1}`,
    stateId: "state-1"
  }));
  const html = renderExplorationHtml(graph, manyRuleIssues);
  const topRulesBlock = html.match(/<h3>Top Rules<\/h3>\s*<ol class="triage-list">([\s\S]*?)<\/ol>\s*<p class="muted triage-more">([\s\S]*?)<\/p>/);
  assert.ok(topRulesBlock);
  const topRules = topRulesBlock[1];
  const hiddenMessage = topRulesBlock[2];

  assert.match(topRules, /rule-1/);
  assert.match(topRules, /rule-2/);
  assert.match(topRules, /rule-3/);
  assert.doesNotMatch(topRules, /rule-4/);
  assert.match(hiddenMessage, /\+ 3 more rules shown in the state findings below\./);
  assert.match(html, /\.triage-more \{[\s\S]*?margin: 10px 0 0/);
});

test("renderExplorationHtml shows up to five affected states in triage", () => {
  const manyStateGraph = {
    ...graph,
    states: Array.from({ length: 6 }, (_, index) => ({
      ...graph.states[0],
      id: `state-${index + 1}`,
      title: `State ${index + 1}`,
      fingerprint: `state-${index + 1}`,
      actionLabel: `State ${index + 1}`,
      issueCount: 1
    }))
  };
  const manyStateIssues = Array.from({ length: 6 }, (_, index) => ({
    ...issues[0],
    selector: `.button-${index + 1}`,
    fingerprint: `button-name::state-${index + 1}`,
    stateId: `state-${index + 1}`,
    stateLabel: `State ${index + 1}`,
    elementBounds: {
      ...issues[0].elementBounds,
      y: issues[0].elementBounds.y + (index * 20)
    }
  }));
  const html = renderExplorationHtml(manyStateGraph, manyStateIssues);
  const topStates = html.match(/<h3>Most Affected States<\/h3>\s*<ol class="triage-list">([\s\S]*?)<\/ol>/)?.[1] || "";

  assert.match(topStates, /href="#state-5"/);
  assert.doesNotMatch(topStates, /href="#state-6"/);
});

test("renderExplorationHtml shows every affected state for a top rule", () => {
  const repeatedStateIssues = Array.from({ length: 5 }, (_, index) => ({
    ...issues[0],
    ruleId: "button-name",
    fingerprint: `button-name::state-${index + 1}`,
    stateId: `state-${index + 1}`,
    stateLabel: `State ${index + 1}`
  }));
  const html = renderExplorationHtml(graph, repeatedStateIssues);
  const topRules = html.match(/<h3>Top Rules<\/h3>\s*<ol class="triage-list">([\s\S]*?)<\/ol>/)?.[1] || "";

  assert.match(topRules, /States: /);
  for (let index = 1; index <= 5; index += 1) {
    assert.match(topRules, new RegExp(`href="#state-${index}">state-${index}<\\/a>`));
  }
  assert.doesNotMatch(topRules, /\+\d+ more/);
});

test("renderExplorationHtml summarizes cross-page rule impact in triage", () => {
  const repeatedPageIssues = [
    {
      ...issues[0],
      ownership: { kind: "first-party" as const, label: "First-party application code" },
      fingerprint: "button-name::home",
      url: "http://localhost:3000/",
      selector: ".icon-button",
      stateId: "state-1"
    },
    {
      ...issues[0],
      ownership: { kind: "first-party" as const, label: "First-party application code" },
      fingerprint: "button-name::settings",
      url: "http://localhost:3000/settings",
      selector: ".icon-button",
      stateId: "state-2"
    }
  ];
  const html = renderExplorationHtml(graph, repeatedPageIssues);
  const topRules = html.match(/<h3>Top Rules<\/h3>\s*<ol class="triage-list">([\s\S]*?)<\/ol>/)?.[1] || "";

  assert.match(topRules, /2 occurrences/);
  assert.match(topRules, /2 pages affected/);
  assert.match(topRules, /2 states affected/);
  assert.match(topRules, /likely shared component or template/);
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

test("renderExplorationHtml groups identical issue messages into numbered locations", () => {
  const message = "Potential color contrast issue needs manual review because the rendered background may include an image, gradient, video, overlay, or other complex visual treatment.";
  const html = renderExplorationHtml(graph, [
    {
      ...issues[0],
      ruleId: "color-contrast",
      severity: "warning",
      findingType: "needs-review",
      tags: ["wcag143", "needs-review", "axe-incomplete"],
      message,
      selector: ".py-4.active\\:scale-\\[0\\.97\\].text-base",
      contrast: undefined,
      fingerprint: "color-contrast::complex-background::first"
    },
    {
      ...issues[0],
      ruleId: "color-contrast",
      severity: "warning",
      findingType: "needs-review",
      tags: ["wcag143", "needs-review", "axe-incomplete"],
      message,
      selector: ".text-amber-signal",
      contrast: undefined,
      fingerprint: "color-contrast::complex-background::second",
      elementBounds: {
        x: 55,
        y: 35,
        width: 18,
        height: 6,
        coordinateSpace: "viewport" as const
      }
    }
  ]);
  const issueHtml = issueBlockForRule(html, "color-contrast");

  assert.match(issueHtml, /2 locations/);
  assert.match(issueHtml, /<ol class="finding-targets">/);
  assert.match(issueHtml, /<li><div class="finding-target"><span class="finding-marker finding-marker-warning" title="Screenshot marker 1">1<\/span><div class="url">\.py-4\.active\\:scale-\\\[0\\\.97\\\]\.text-base<\/div><\/div><\/li>/);
  assert.match(issueHtml, /<li><div class="finding-target"><span class="finding-marker finding-marker-warning" title="Screenshot marker 2">2<\/span><div class="url">\.text-amber-signal<\/div><\/div><\/li>/);
  assert.match(issueHtml, /Needs review means axe could not complete this check automatically/);
  assert.equal((issueHtml.match(new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1);
});

test("renderExplorationHtml explains when not every target has a screenshot marker", () => {
  const message = "Potential color contrast issue needs manual review because the rendered background may include an image, gradient, video, overlay, or other complex visual treatment.";
  const manyIssues = Array.from({ length: 13 }, (_, index) => ({
    ...issues[0],
    ruleId: "color-contrast",
    severity: "warning" as const,
    findingType: "needs-review" as const,
    tags: ["wcag143", "needs-review", "axe-incomplete"],
    message,
    selector: `.contrast-${index}`,
    fingerprint: `color-contrast::complex-background::${index}`,
    elementBounds: {
      x: 5 + index,
      y: 10 + index,
      width: 8,
      height: 4,
      coordinateSpace: "viewport" as const
    },
    contrast: undefined
  }));
  const html = renderExplorationHtml(graph, manyIssues);
  const issueHtml = issueBlockForRule(html, "color-contrast");

  assert.match(issueHtml, /12 of 13 shown on screenshots/);
});

test("renderExplorationHtml numbers screenshot annotations from top to bottom", () => {
  const bottomIssue = {
    ...issues[0],
    ruleId: "image-alt",
    selector: ".bottom-card",
    message: "Images must have alternative text",
    fingerprint: "image-alt::bottom",
    elementBounds: {
      x: 8,
      y: 70,
      width: 20,
      height: 8,
      coordinateSpace: "viewport" as const
    }
  };
  const topIssue = {
    ...issues[0],
    ruleId: "button-name",
    selector: ".top-button",
    message: "Buttons must have discernible text",
    fingerprint: "button-name::top",
    elementBounds: {
      x: 40,
      y: 10,
      width: 20,
      height: 8,
      coordinateSpace: "viewport" as const
    }
  };
  const html = renderExplorationHtml(graph, [bottomIssue, topIssue]);
  const annotationMatches = [...html.matchAll(/<span class="annotation-number">(\d+)<\/span><\/span>/g)].map((match) => match[1]);

  assert.deepEqual(annotationMatches.slice(0, 2), ["1", "2"]);
  assert.match(issueBlockForRule(html, "button-name"), /title="Screenshot marker 1">1<\/span>/);
  assert.match(issueBlockForRule(html, "image-alt"), /title="Screenshot marker 2">2<\/span>/);
});

test("renderExplorationHtml numbers same-row annotations from left to right", () => {
  const rightIssue = {
    ...issues[0],
    ruleId: "target-size",
    selector: ".right-icon",
    message: "Interactive targets must be large enough",
    fingerprint: "target-size::right-icon",
    elementBounds: {
      x: 74,
      y: 66.9,
      width: 4,
      height: 4,
      coordinateSpace: "viewport" as const
    }
  };
  const leftIssue = {
    ...issues[0],
    ruleId: "button-name",
    selector: ".left-button",
    message: "Buttons must have discernible text",
    fingerprint: "button-name::left-button",
    elementBounds: {
      x: 30,
      y: 68.5,
      width: 12,
      height: 4,
      coordinateSpace: "viewport" as const
    }
  };
  const html = renderExplorationHtml(graph, [rightIssue, leftIssue]);
  const annotationMatches = [...html.matchAll(/<span class="annotation-number">(\d+)<\/span><\/span>/g)].map((match) => match[1]);

  assert.deepEqual(annotationMatches.slice(0, 2), ["1", "2"]);
  assert.match(issueBlockForRule(html, "button-name"), /title="Screenshot marker 1">1<\/span>/);
  assert.match(issueBlockForRule(html, "target-size"), /title="Screenshot marker 2">2<\/span>/);
});

test("renderExplorationHtml reuses one marker number for multiple findings at the same visual location", () => {
  const sameBounds = {
    x: 74.8,
    y: 67,
    width: 1.6,
    height: 1.8,
    coordinateSpace: "document" as const
  };
  const html = renderExplorationHtml(graph, [
    {
      ...issues[0],
      ruleId: "target-size",
      selector: "button[aria-label=\"Previous tip\"]",
      message: "Interactive targets must be large enough",
      fingerprint: "target-size::previous-tip",
      elementBounds: sameBounds
    },
    {
      ...issues[0],
      ruleId: "color-contrast",
      selector: "button[aria-label=\"Previous tip\"]",
      message: "Elements must meet minimum color contrast ratio thresholds",
      fingerprint: "color-contrast::previous-tip",
      severity: "warning",
      elementBounds: sameBounds
    }
  ]);

  assert.equal((html.match(/<span class="annotation-number">1<\/span>/g) || []).length, 2);
  assert.doesNotMatch(html, /<span class="annotation-number">2<\/span>/);
  assert.match(issueBlockForRule(html, "target-size"), /title="Screenshot marker 1">1<\/span>/);
  assert.match(issueBlockForRule(html, "color-contrast"), /title="Screenshot marker 1">1<\/span>/);
});

test("renderExplorationHtml groups color contrast findings with different ratios but keeps target measurements", () => {
  const html = renderExplorationHtml(graph, [
    {
      ...issues[0],
      ruleId: "color-contrast",
      severity: "critical",
      message: "Elements must meet minimum color contrast ratio thresholds",
      selector: ".muted-link",
      contrast: {
        actualRatio: 3.77,
        requiredRatio: 4.5,
        foreground: "#888888",
        background: "#2f2f2f",
        fontSize: "12.0pt (16px)",
        fontWeight: "normal",
        suggestions: []
      },
      fingerprint: "color-contrast::muted-link"
    },
    {
      ...issues[0],
      ruleId: "color-contrast",
      severity: "critical",
      message: "Elements must meet minimum color contrast ratio thresholds",
      selector: ".brand-link",
      contrast: {
        actualRatio: 3.81,
        requiredRatio: 4.5,
        foreground: "#6d7cff",
        background: "#2f2f2f",
        fontSize: "12.0pt (16px)",
        fontWeight: "normal",
        suggestions: []
      },
      fingerprint: "color-contrast::brand-link"
    }
  ]);
  const issueHtml = issueBlockForRule(html, "color-contrast");

  assert.match(issueHtml, /2 locations/);
  assert.equal((issueHtml.match(/Elements must meet minimum color contrast ratio thresholds/g) || []).length, 1);
  assert.match(issueHtml, /\.muted-link · Contrast 3\.77:1, required 4\.5:1/);
  assert.match(issueHtml, /\.brand-link · Contrast 3\.81:1, required 4\.5:1/);
});

test("renderExplorationHtml groups forced-colors focus findings and keeps each label", () => {
  const baseMessage = "No outline, border, or shadow focus indicator was detected while forced-colors was active.";
  const html = renderExplorationHtml(graph, [
    {
      ...issues[0],
      ruleId: "forced-colors-focus-indicator-risk",
      source: "forced-colors",
      severity: "warning",
      findingType: "best-practice",
      message: `${baseMessage} Label: "Skip to main content".`,
      selector: "div > div > header > a",
      fingerprint: "forced-colors::skip-link"
    },
    {
      ...issues[0],
      ruleId: "forced-colors-focus-indicator-risk",
      source: "forced-colors",
      severity: "warning",
      findingType: "best-practice",
      message: `${baseMessage} Label: "Solutions".`,
      selector: "header > div > div > nav > button:nth-of-type(1)",
      fingerprint: "forced-colors::solutions"
    }
  ]);
  const issueHtml = issueBlockForRule(html, "forced-colors-focus-indicator-risk");

  assert.match(issueHtml, /2 locations/);
  assert.equal((issueHtml.match(new RegExp(baseMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1);
  assert.match(issueHtml, /div &gt; div &gt; header &gt; a · Label: "Skip to main content"/);
  assert.match(issueHtml, /header &gt; div &gt; div &gt; nav &gt; button:nth-of-type\(1\) · Label: "Solutions"/);
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

test("renderExplorationHtml shows helpful empty-state messages for not-tested and needs-review coverage", () => {
  const emptyGraph = {
    ...graph,
    states: [{
      id: "state-1",
      url: "http://localhost:3000/",
      title: "Demo",
      depth: 0,
      fingerprint: "abc123",
      actionLabel: "Initial page",
      screenshot: "screenshots/state-1.png",
      screenshotFullPage: true,
      issueCount: 0,
      actionCount: 0,
      accessibilityTree: {
        totalNodes: 1,
        namedNodes: 1,
        interactiveNodes: 0,
        unnamedInteractiveNodes: 0,
        landmarks: [],
        headings: [],
        interactiveSample: []
      }
    }],
    summary: { ...graph.summary, statesVisited: 1 }
  };
  const html = renderExplorationHtml(emptyGraph, []);

  assert.match(html, /This audit did not collect reflow evidence/);
  assert.match(html, /No modal opened during this audit/);
});

test("renderExplorationHtml renders source findings as a state card", () => {
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
  assert.match(html, /class="state state-critical non-visual-findings" aria-label="Non-visual findings"/);
  assert.match(html, /Source and keyboard findings/);
  assert.doesNotMatch(html, /\.non-visual-findings \{[\s\S]*?grid-column: 1 \/ -1/);
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
        { target: "background", purpose: "minimum", color: "#222222", contrastRatio: 5.5 },
        { target: "foreground", purpose: "recommended", color: "#6F6F6F", contrastRatio: 5.02 },
        { target: "foreground", purpose: "enhanced", color: "#595959", contrastRatio: 7 }
      ]
    }
  }]);

  assert.match(html, /Contrast 2\.32:1/);
  assert.match(html, /needs 4\.5:1/);
  assert.doesNotMatch(html, /12\.0pt \(16px\), normal/);
  assert.match(html, /Text <code>#aaaaaa<\/code>/);
  assert.match(html, /Background <code>#ffffff<\/code>/);
  assert.match(html, /<div class="contrast-evidence contrast-guidance">\s*<div class="contrast-guidance-title"><span>Color recommendations<\/span>/);
  assert.match(html, /<div class="contrast-guidance-body">\s*<div class="contrast-measurement">/);
  assert.doesNotMatch(html, /<strong>Try:<\/strong>/);
  assert.match(html, /Text color Minimum <code>#767676<\/code> \(4\.54:1\)/);
  assert.match(html, /Background color Minimum <code>#222222<\/code> \(5\.5:1\)/);
  assert.doesNotMatch(html, /Text color Recommended <code>#6F6F6F<\/code> \(5\.02:1\)/);
  assert.doesNotMatch(html, /Enhanced contrast/);
  assert.doesNotMatch(html, /<code>#595959<\/code>/);
  assert.match(html, /background-color: #767676/);
  assert.match(html, /background-color: #222222/);
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
      elementBounds: {
        x: 52,
        y: 38,
        width: 22,
        height: 8,
        coordinateSpace: "viewport" as const
      },
      contrast
    }
  ]);

  assert.equal((html.match(/<div class="contrast-measurement">\s*<div><strong>Contrast 2\.32:1<\/strong>/g) || []).length, 1);
  assert.match(html, /2 locations/);
  assert.doesNotMatch(html, /<strong>Try:<\/strong>/);
  assert.equal((html.match(/Text color Minimum <code>#767676<\/code>/g) || []).length, 1);
  assert.match(html, /Shared recommendation for 2 findings/);
  assert.doesNotMatch(html, /Applies to/);
  assert.doesNotMatch(html, /contrast-guidance-targets/);
  assert.match(html, /<div class="contrast-guidance-title"><span>Color recommendations<\/span><span class="contrast-guidance-markers" aria-label="Screenshot markers">/);
  assert.match(html, /<span class="finding-marker finding-marker-critical" title="Screenshot marker 1">1<\/span><div class="url">\.first-muted-label/);
  assert.match(html, /<span class="finding-marker finding-marker-critical" title="Screenshot marker 2">2<\/span><div class="url">\.second-muted-label/);
  assert.match(html, /<div class="contrast-guidance-title">[\s\S]*?<span class="finding-marker finding-marker-critical" title="Screenshot marker 1">1<\/span>[\s\S]*?<span class="finding-marker finding-marker-critical" title="Screenshot marker 2">2<\/span>[\s\S]*?<\/div>/);
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
  assert.match(html, /style="--screenshot-aspect: 1280 \/ 900"/);
  assert.equal((html.match(/annotation annotation-critical/g) ?? []).length, 4);
});

test("renderExplorationHtml does not place annotations on unrelated evidence screenshots", () => {
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
          height: 720
        },
        {
          path: "screenshots/state-1-evidence-2.jpg",
          kind: "evidence-crop",
          issueCount: 0,
          width: 1280,
          height: 240
        }
      ]
    }]
  };
  const html = renderExplorationHtml(focusedGraph, [{
    ...issues[0],
    screenshot: "screenshots/state-1-evidence-1.jpg"
  }]);
  const secondFrameStart = html.indexOf("screenshots/state-1-evidence-2.jpg");
  const secondFrameEnd = html.indexOf("screenshot-state-1-2", secondFrameStart);
  const secondFrame = html.slice(secondFrameStart, secondFrameEnd);

  assert.match(html, /screenshots\/state-1-evidence-2\.jpg/);
  assert.doesNotMatch(secondFrame, /annotation annotation-critical/);
});

test("renderExplorationHtml hides repeated selector annotations in later states", () => {
  const repeatedGraph = {
    ...graph,
    states: [
      {
        ...graph.states[0],
        id: "state-1",
        screenshot: "screenshots/state-1.png"
      },
      {
        ...graph.states[1],
        id: "state-2",
        screenshot: "screenshots/state-2.png"
      }
    ],
    summary: { ...graph.summary, statesVisited: 2, screenshots: 2, duplicateScreenshots: 0 }
  };
  const repeatedIssues = [
    {
      ...issues[0],
      stateId: "state-1",
      ruleId: "color-contrast",
      selector: ".shared-nav-link",
      screenshot: "screenshots/state-1.png",
      severity: "critical",
      fingerprint: "color-contrast::shared::critical"
    },
    {
      ...issues[0],
      stateId: "state-2",
      ruleId: "color-contrast",
      selector: ".shared-nav-link",
      screenshot: "screenshots/state-2.png",
      severity: "warning",
      fingerprint: "color-contrast::shared::warning"
    }
  ];
  const html = renderExplorationHtml(repeatedGraph, repeatedIssues);
  const state2Start = html.indexOf('id="state-2"');
  const state2End = html.indexOf("</article>", state2Start);
  const state2Html = html.slice(state2Start, state2End);

  assert.match(state2Html, /no findings/);
  assert.doesNotMatch(state2Html, /annotation annotation-critical/);
  assert.doesNotMatch(state2Html, /annotation annotation-warning/);
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

test("renderExplorationHtml keeps diagnostic exploration data out of the visual report", () => {
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
  assert.doesNotMatch(html, /State transitions and skipped actions can be saved to <code>exploration-graph\.json<\/code> with <code>--raw<\/code>/);
  assert.doesNotMatch(html, /Show 1 more transition/);
  assert.doesNotMatch(html, /Transition 13/);
  assert.doesNotMatch(html, /Show 1 more skipped action/);
  assert.doesNotMatch(html, /Skipped action 21/);
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
  const journeyIssues = issues.map((issue) => (
    issue.ruleId === "button-name"
      ? { ...issue, journeys: ["Checkout"] }
      : issue
  ));
  await writeExplorationHtml(outputDir, graph, journeyIssues, {
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
  assert.doesNotMatch(html, /What Was Checked/);
  assert.doesNotMatch(html, /class="panel evaluation-scope"/);
  assert.doesNotMatch(html, /aria-label="What was checked"/);
  assert.doesNotMatch(html, /Show scope evidence/);
  assert.doesNotMatch(html, /Report Completeness/);
  assert.doesNotMatch(html, /completeness-status/);
  assert.match(html, /Share Review Copy/);
  assert.ok(html.indexOf("Share Review Copy") > html.indexOf("Manual Review Checklist"));
  assert.ok(html.indexOf("Share Review Copy") < html.indexOf("Coverage Note"));
  assert.match(html, /\.share-review \{[\s\S]*?grid-column: 1 \/ -1/);
  assert.match(html, /npx a11y-shiftleft-cli share prepare --report reports --out a11y-share/);
  assert.match(html, /npx a11y-shiftleft-cli share prepare --report reports --out a11y-share --include-html/);
  assert.match(html, /share-report\.html/);
  assert.match(html, /share-summary\.md/);
  assert.match(html, /Add <code>--include-html<\/code> only when screenshots are approved for sharing/);
  assert.match(html, /Lighthouse comparison/);
  assert.doesNotMatch(html, /Quick Review/);
  assert.doesNotMatch(html, /quick-review/);
  assert.match(html, /WCAG Level A/);
  assert.match(html, /Third-party embedded content/);
  assert.match(html, /class="finding-context finding-context-third-party"/);
  assert.match(html, /Ownership: Third-party embedded content/);
  assert.match(html, /Source: <a href="https:\/\/www\.youtube\.com\/" target="_blank" rel="noopener noreferrer">youtube\.com<\/a>/);
  assert.match(html, /Third-party embedded content\. Manual verification recommended\./);
  assert.match(html, /Visual Tab Order/);
  assert.match(html, /<span class="focus-path-number" aria-hidden="true">1<\/span>/);
  assert.match(html, /Search products/);
  assert.match(html, /Meaningful form labels and instructions \(1\.3\.1, 3\.3\.2\) — 1 target/);
  assert.match(html, /Keyboard Audit/);
  assert.match(html, /class="panel keyboard-audit" id="keyboard-audit" aria-label="Keyboard audit"/);
  assert.match(html, /\.keyboard-audit \{[\s\S]*?grid-column: 1 \/ -1/);
  assert.match(html, /Keyboard review summary/);
  assert.match(html, /2 focus steps? need review|1 focus step need review/);
  assert.match(html, /Tab cycle incomplete/);
  assert.match(html, /Reverse order not checked/);
  assert.match(html, /keyboard-review-card-warning/);
  assert.match(html, /Visual Tab Order/);
  assert.match(html, /\.visual-tab-order \{[\s\S]*?margin-top: 16px/);
  assert.match(html, /<div class="visual-tab-order" aria-label="Visual Tab order">/);
  assert.match(html, /<div class="focus-path-scroll-wrapper">/);
  assert.match(html, /<ol class="focus-path" tabindex="0" aria-label="Forward keyboard focus path" data-focus-path-scroll>/);
  assert.match(html, /data-focus-path-scrollbar/);
  assert.match(html, /data-focus-path-scrollbar-thumb/);
  assert.match(html, /focus-path-scrollbar-disabled/);
  assert.match(html, /\.focus-path-note \{[\s\S]*?margin: 10px 0 0/);
  assert.match(html, /Search products/);
  assert.match(html, /Buy now/);
  assert.match(html, /Focus not visible/);
  assert.match(html, /Obscured/);
  assert.match(html, /focus-path-risk/);
  assert.match(html, /class="focus-path-item focus-path-item-risk"/);
  assert.match(html, /Complete focus path data/);
  assert.match(html, /Manual Review Checklist/);
  assert.match(html, /class="panel panel-full-width manual-review-checklist" id="manual-review-checklist"/);
  assert.match(html, /data-manual-checklist-progress/);
  assert.match(html, /Manual checks remaining: 1 of 1/);
  assert.match(html, /data-manual-checklist-item="form-label-quality"/);
  assert.match(html, /data-manual-checklist-checkbox/);
  assert.match(html, /Mark Meaningful form labels and instructions as reviewed/);
  assert.match(html, /Review guidance/);
  assert.match(html, /a11y-shiftleft:manual-checklist:/);
  assert.match(html, /manual-checklist-item-reviewed/);
  assert.match(html, /event\.stopPropagation\(\)/);
  assert.match(html, /Manual test environment fields/);
  assert.match(html, /Operating system/);
  assert.match(html, /Assistive technology/);
  assert.match(html, /Viewport or zoom/);
  assert.match(html, /Color mode/);
  assert.match(html, /Observed review targets/);
  assert.match(html, /form: Email address/);
  assert.match(html, /href="#state-1">Open state-1/);
  assert.match(html, /1 review area has observed targets from this audit/);
  assert.match(html, /Audit Coverage/);
  assert.doesNotMatch(html, /Tracked WCAG Coverage/);
  assert.doesNotMatch(html, /Tracked WCAG evidence coverage/);
  assert.doesNotMatch(html, /not a WCAG conformance score/);
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
  assert.match(html, /\.coverage-table th,[\s\S]*?\.coverage-table td \{[\s\S]*?padding: 6px 9px/);
  assert.match(html, /\.coverage-table input\[type="checkbox"\] \{[\s\S]*?height: 16px[\s\S]*?width: 16px/);
  assert.match(html, /\.coverage-legend-item \{[\s\S]*?min-height: 32px/);
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
