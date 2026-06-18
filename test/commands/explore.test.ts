import test from "node:test";
import assert from "node:assert/strict";
import {
  formatExploreConsoleSummary,
  formatExploreProgressMessage,
  formatVerboseExploreSummary,
  resolveFullPageScreenshots
} from "../../dist/commands/explore.js";
import type { A11yReport, ExplorationGraph } from "../../dist/types.js";

test("formatVerboseExploreSummary renders exploration context", () => {
  const output = formatVerboseExploreSummary({
    url: "http://localhost:3000",
    framework: "react",
    outputDir: "reports",
    maxDepth: 2,
    maxStates: 20,
    maxActionsPerState: 8,
    formats: ["json", "markdown"],
    html: true,
    pdf: true,
    screenshots: true,
    screenshotFormat: "jpeg",
    screenshotQuality: 70,
    screenshotFullPage: false,
    screenshotRedaction: true,
    waitMs: 1000,
    waitForSelector: "[data-loaded]",
    scrollEnabled: true,
    scrollStepPx: 800,
    scrollMaxSteps: 25,
    scrollWaitMs: 100,
    safeModeEnabled: true,
    safeModeDismissDialogs: true,
    safeModeIsolateCookies: true,
    safeModeBlockedText: ["logout", "delete"],
    safeModeBlockedRoles: [],
    safeModeBlockedUrls: ["*/checkout*"],
    safeModeBlockedSelectors: ["[data-danger]"],
    retentionEnabled: true,
    retentionDryRun: false
  });

  assert.match(output, /a11y-shiftleft explore/);
  assert.match(output, /url: http:\/\/localhost:3000/);
  assert.match(output, /framework: react/);
  assert.match(output, /limits: depth=2, states=20, actionsPerState=8/);
  assert.match(output, /pdf: on/);
  assert.match(output, /screenshots: jpeg quality=70/);
  assert.match(output, /screenshotCapture: automatic error regions/);
  assert.match(output, /screenshotRedaction: on/);
  assert.match(output, /wait: 1000ms selector=\[data-loaded\]/);
  assert.match(output, /scroll: on step=800px maxSteps=25 wait=100ms/);
  assert.match(output, /safeMode: on/);
  assert.match(output, /safeModeBlockedText: logout, delete/);
  assert.match(output, /safeModeIsolateCookies: on/);
  assert.match(output, /safeModeBlockedRoles: none/);
  assert.match(output, /safeModeBlockedUrls: \*\/checkout\*/);
  assert.match(output, /safeModeBlockedSelectors: \[data-danger\]/);
  assert.match(output, /retention: on/);
});

test("resolveFullPageScreenshots uses automatic evidence crops by default", () => {
  assert.equal(resolveFullPageScreenshots({}), false);
  assert.equal(resolveFullPageScreenshots({ compactScreenshots: true }), false);
  assert.equal(resolveFullPageScreenshots({
    screenshotFullPage: true
  }), true);
  assert.equal(resolveFullPageScreenshots({
    compactScreenshots: true,
    screenshotFullPage: true
  }), false);
});

test("formatExploreProgressMessage renders compact progress lines", () => {
  assert.equal(formatExploreProgressMessage({
    type: "state",
    visitedStates: 2,
    maxStates: 20,
    state: {
      id: "state-2",
      url: "http://localhost:3000/menu",
      depth: 1,
      fingerprint: "abc",
      actionLabel: "Click: Menu",
      screenshot: "screenshots/state-2.jpg",
      issueCount: 3,
      actionCount: 4
    }
  }), "[explore] rendered 2 state-2 depth=1 issues=3 screenshot=screenshots/state-2.jpg");

  assert.equal(formatExploreProgressMessage({
    type: "actions",
    stateId: "state-2",
    actionCount: 4,
    skippedActionCount: 1
  }), "[explore] state-2 queued=4 skipped=1");
});

test("formatExploreConsoleSummary renders a readable visual scan summary", () => {
  const report: A11yReport = {
    generatedAt: "2026-06-11T00:00:00.000Z",
    summary: {
      total: 2,
      critical: 0,
      warning: 2,
      info: 0,
      rawCount: 2,
      uniqueCount: 2,
      duplicateCount: 0,
      duplicateRate: 0,
      scanDurationMs: 500,
      framework: "react",
      urls: ["http://localhost:3000"],
      complianceEvidence: {
        automatedCoverage: "partial",
        requiresManualReview: true,
        totalFindings: 2,
        wcagMappedFindings: 1,
        unmappedFindings: 1,
        affectedPages: 1,
        topAffectedPages: []
      },
      bySource: {
        axe: 2
      },
      bySeverity: {
        warning: 2
      },
      byConfidence: {
        high: 1,
        medium: 1
      },
      byCategory: {
        contrast: 1,
        headings: 1
      },
      byPour: {
        perceivable: 1
      },
      byWcagLevel: {
        AA: 1
      },
      byWcagVersion: {
        "2.0": 1
      },
      byUnmappedRule: {
        "page-has-heading-one": 1
      },
      byPage: []
    },
    issues: [
      {
        source: "axe",
        framework: "react",
        ruleId: "color-contrast",
        wcag: ["1.4.3"],
        wcagCriteria: [{
          id: "1.4.3",
          title: "Contrast (Minimum)",
          level: "AA",
          principle: "perceivable",
          introducedIn: "2.0",
          url: "https://example.com"
        }],
        tags: [],
        severity: "warning",
        confidence: "high",
        confidenceScore: 95,
        confidenceReason: "Axe rule with direct WCAG mapping.",
        category: "contrast",
        message: "Text needs more contrast",
        fingerprint: "axe:color-contrast:html",
        duplicateCount: 0
      },
      {
        source: "axe",
        framework: "react",
        ruleId: "page-has-heading-one",
        wcag: [],
        wcagCriteria: [],
        tags: [],
        severity: "warning",
        confidence: "medium",
        confidenceScore: 70,
        confidenceReason: "Best-practice dynamic finding.",
        category: "headings",
        message: "Page should contain a level-one heading",
        fingerprint: "axe:page-has-heading-one:html",
        duplicateCount: 0
      }
    ]
  };
  const graph: ExplorationGraph = {
    generatedAt: "2026-06-11T00:00:00.000Z",
    startUrl: "http://localhost:3000",
    states: [
      {
        id: "state-1",
        url: "http://localhost:3000",
        depth: 0,
        fingerprint: "one",
        actionLabel: "Initial page",
        screenshot: "screenshots/state-1.jpg",
        issueCount: 2,
        actionCount: 1
      }
    ],
    edges: [],
    skippedActions: [],
    summary: {
      statesVisited: 1,
      actionsTried: 0,
      skippedActions: 0,
      screenshots: 1,
      maxDepth: 2,
      maxStates: 20
    }
  };

  const output = formatExploreConsoleSummary(report, graph, {
    outputDir: "reports",
    formats: ["json", "markdown"],
    html: true,
    pdf: true,
    screenshots: true
  });

  assert.match(output, /Exploration: UI states 1\/20 \| rendered states 1 \| actions tried 0 \| skipped 0 \| unique screenshots 1 \| duplicate screenshots skipped 0/);
  assert.match(output, /Findings: total 2 \| CRITICAL 0 \| WARNING 2 \| INFO 0/);
  assert.match(output, /Color schemes: single\/default/);
  assert.match(output, /color-contrast: 1/);
  assert.match(output, /state-1: 2 findings/);
  assert.match(output, /reports\/exploration.html/);
  assert.match(output, /reports\/exploration.pdf/);
  assert.match(output, /reports\/screenshots\//);
  assert.match(output, /portable evidence artifact/);
  assert.match(output, /--json-summary/);
});
