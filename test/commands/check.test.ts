import test from "node:test";
import assert from "node:assert/strict";
import { filterByWcagConformance, filterByWcagLevel, formatCheckConsoleSummary, formatCheckProgressMessage, formatVerboseCheckSummary, parseFormats, parseUrls, resolveCheckModes, shouldFail } from "../../dist/commands/check.js";

const summary = {
  critical: 1,
  warning: 1,
  info: 1
};

test("shouldFail supports severity gates", () => {
  assert.equal(shouldFail(summary, "critical"), true);
  assert.equal(shouldFail({ critical: 0, warning: 1, info: 0 }, "critical"), false);
  assert.equal(shouldFail({ critical: 0, warning: 1, info: 0 }, "warning"), true);
  assert.equal(shouldFail({ critical: 0, warning: 0, info: 1 }, "info"), true);
});

test("shouldFail supports disabled failure gate", () => {
  assert.equal(shouldFail(summary, "none"), false);
});

test("shouldFail uses only new findings when baseline mode is enabled", () => {
  assert.equal(shouldFail({
    critical: 5,
    warning: 5,
    info: 5,
    baseline: {
      enabled: true,
      file: ".a11y-baseline.json",
      updated: false,
      baselineIssues: 15,
      currentIssues: 15,
      existingIssues: 15,
      newIssues: 0,
      resolvedIssues: 0,
      newCritical: 0,
      newWarning: 0,
      newInfo: 0
    }
  }, "critical"), false);

  assert.equal(shouldFail({
    critical: 0,
    warning: 0,
    info: 0,
    baseline: {
      enabled: true,
      file: ".a11y-baseline.json",
      updated: false,
      baselineIssues: 1,
      currentIssues: 2,
      existingIssues: 1,
      newIssues: 1,
      resolvedIssues: 0,
      newCritical: 0,
      newWarning: 1,
      newInfo: 0
    }
  }, "warning"), true);
});

test("shouldFail uses only new findings in retest mode", () => {
  assert.equal(shouldFail({
    critical: 4,
    warning: 0,
    info: 0,
    retest: {
      enabled: true,
      file: "reports/before/a11y-report.json",
      previousIssues: 5,
      currentIssues: 4,
      fixedIssues: 1,
      remainingIssues: 4,
      newIssues: 0,
      newCritical: 0,
      newWarning: 0,
      newInfo: 0
    }
  }, "critical"), false);

  assert.equal(shouldFail({
    critical: 1,
    warning: 1,
    info: 0,
    retest: {
      enabled: true,
      file: "reports/before/a11y-report.json",
      previousIssues: 1,
      currentIssues: 2,
      fixedIssues: 0,
      remainingIssues: 1,
      newIssues: 1,
      newCritical: 0,
      newWarning: 1,
      newInfo: 0
    }
  }, "warning"), true);
});

test("parseFormats defaults to all report formats", () => {
  assert.deepEqual(parseFormats(), ["json", "csv", "markdown"]);
  assert.deepEqual(parseFormats(["all"]), ["json", "csv", "markdown"]);
});

test("parseFormats supports space and comma separated formats", () => {
  assert.deepEqual(parseFormats(["json", "csv"]), ["json", "csv"]);
  assert.deepEqual(parseFormats(["json,csv"]), ["json", "csv"]);
});

test("parseFormats rejects unsupported formats", () => {
  assert.throws(() => parseFormats(["xml"]), /Unsupported report format: xml/);
});

test("parseUrls supports repeated and comma separated URLs", () => {
  assert.deepEqual(parseUrls(), []);
  assert.deepEqual(
    parseUrls([
      "http://localhost:4200",
      "http://localhost:4200/favorites,http://localhost:4200/settings",
      "http://localhost:4200"
    ]),
    [
      "http://localhost:4200",
      "http://localhost:4200/favorites",
      "http://localhost:4200/settings"
    ]
  );
});

test("resolveCheckModes treats static and dynamic flags as explicit modes", () => {
  assert.deepEqual(resolveCheckModes({
    staticRequested: true,
    hasDynamicInput: true,
    configDynamicEnabled: true
  }), {
    runStatic: true,
    runDynamic: false
  });

  assert.deepEqual(resolveCheckModes({
    dynamicRequested: true,
    configDynamicEnabled: false
  }), {
    runStatic: false,
    runDynamic: true
  });

  assert.deepEqual(resolveCheckModes({
    hasDynamicInput: true
  }), {
    runStatic: true,
    runDynamic: true
  });
});

test("formatVerboseCheckSummary renders scan context without JSON parsing requirements", () => {
  const output = formatVerboseCheckSummary({
    framework: "react",
    runStatic: true,
    runDynamic: true,
    adapterRuns: [
      {
        name: "static",
        enabled: true,
        issueCount: 1,
        durationMs: 25
      },
      {
        name: "dynamic",
        enabled: true,
        issueCount: 2,
        durationMs: 150
      }
    ],
    urls: ["http://localhost:3000"],
    outputDir: "reports",
    formats: ["json", "markdown"],
    baselineEnabled: true,
    baselineFile: ".a11y-baseline.json",
    ignoreEnabled: true,
    ignoreFile: "a11y-ignore.json",
    ignoredIssues: 2,
    updateBaseline: false,
    standard: "wcag22-aa",
    wcagVersion: "2.2",
    wcagLevel: "AA",
    crawl: true,
    crawlDepth: 1,
    crawlLimit: 10,
    scrollEnabled: true,
    scrollStepPx: 800,
    scrollMaxSteps: 25,
    scrollWaitMs: 100,
    retentionEnabled: true,
    retentionDryRun: false,
    retentionPlannedDeletedRuns: 2,
    retentionDeletedRuns: 2
  });

  assert.match(output, /framework: react/);
  assert.match(output, /modes: static=on, dynamic=on/);
  assert.match(output, /urls: http:\/\/localhost:3000/);
  assert.match(output, /crawl: enabled depth=1 limit=10/);
  assert.match(output, /scroll: enabled step=800px maxSteps=25 wait=100ms/);
  assert.match(output, /baseline: enabled file=.a11y-baseline.json/);
  assert.match(output, /ignore: enabled file=a11y-ignore.json ignored=2/);
  assert.match(output, /retention: enabled deletedRuns=2/);
  assert.match(output, /static: enabled, findings=1, duration=25ms/);
  assert.match(output, /dynamic: enabled, findings=2, duration=150ms/);
});

test("formatCheckConsoleSummary renders a readable local summary", () => {
  const output = formatCheckConsoleSummary({
    generatedAt: "2026-06-11T00:00:00.000Z",
    summary: {
      total: 2,
      critical: 1,
      warning: 1,
      info: 0,
      rawCount: 3,
      uniqueCount: 2,
      duplicateCount: 1,
      duplicateRate: 0.3333,
      scanDurationMs: 125,
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
        axe: 1,
        eslint: 1
      },
      bySeverity: {
        critical: 1,
        warning: 1
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
      byPage: [{
        url: "http://localhost:3000",
        total: 2,
        critical: 1,
        warning: 1,
        info: 0,
        severityScore: 7
      }]
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
        severity: "critical",
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
  }, {
    outputDir: "reports",
    formats: ["json", "markdown"],
    semiAuto: true
  });

  assert.match(output, /Findings: total 2 \| CRITICAL 1 \| WARNING 1 \| INFO 0/);
  assert.match(output, /Sources: axe: 1, eslint: 1/);
  assert.match(output, /Color-scheme findings: none/);
  assert.match(output, /color-contrast: 1/);
  assert.match(output, /reports\/a11y-comment.md/);
  assert.match(output, /reports\/a11y-manual-checklist.md/);
  assert.match(output, /--json-summary/);
});

test("formatCheckProgressMessage renders crawl and scan progress", () => {
  assert.equal(formatCheckProgressMessage({
    type: "crawl",
    url: "http://localhost:3000/settings",
    depth: 1,
    discoveredCount: 2,
    queuedCount: 3,
    maxUrls: 10
  }), "[check] crawl discovered 2/10 depth=1 queued=3 http://localhost:3000/settings");

  assert.equal(formatCheckProgressMessage({
    type: "scan-start",
    url: "http://localhost:3000/settings",
    scannedCount: 2,
    totalUrls: 10
  }), "[check] scan 2/10 http://localhost:3000/settings");

  assert.equal(formatCheckProgressMessage({
    type: "scan-complete",
    url: "http://localhost:3000/settings",
    scannedCount: 2,
    totalUrls: 10,
    issueCount: 4
  }), "[check] scan 2/10 done issues=4 http://localhost:3000/settings");

  assert.equal(formatCheckProgressMessage({
    type: "scan-error",
    url: "http://localhost:3000/settings",
    scannedCount: 2,
    totalUrls: 10,
    message: "timeout"
  }), "[check] scan 2/10 failed http://localhost:3000/settings: timeout");
});

test("filterByWcagLevel keeps findings up to the selected conformance level", () => {
  const issues = filterByWcagLevel([
    {
      source: "axe",
      framework: "react",
      ruleId: "image-alt",
      wcag: ["1.1.1"],
      wcagCriteria: [{
        id: "1.1.1",
        title: "Non-text Content",
        level: "A",
        principle: "perceivable",
        introducedIn: "2.0",
        url: "https://example.com"
      }],
      severity: "warning",
      message: "Image needs alternative text"
    },
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
      severity: "critical",
      message: "Text needs more contrast"
    }
  ], "A");

  assert.deepEqual(issues.map((issue) => issue.ruleId), ["image-alt"]);
});

test("filterByWcagConformance filters criteria by selected WCAG version", () => {
  const issues = filterByWcagConformance([
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
      severity: "critical",
      message: "Text needs more contrast"
    },
    {
      source: "axe",
      framework: "react",
      ruleId: "target-size",
      wcag: ["2.5.8"],
      wcagCriteria: [{
        id: "2.5.8",
        title: "Target Size (Minimum)",
        level: "AA",
        principle: "operable",
        introducedIn: "2.2",
        url: "https://example.com"
      }],
      severity: "warning",
      message: "Target is too small"
    }
  ], {
    version: "2.0"
  });

  assert.deepEqual(issues.map((issue) => issue.ruleId), ["color-contrast"]);
});

test("filterByWcagConformance can keep unmapped findings for standard presets", () => {
  const issues = filterByWcagConformance([
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
      severity: "critical",
      message: "Text needs more contrast"
    },
    {
      source: "axe",
      framework: "react",
      ruleId: "target-size",
      wcag: ["2.5.8"],
      wcagCriteria: [{
        id: "2.5.8",
        title: "Target Size (Minimum)",
        level: "AA",
        principle: "operable",
        introducedIn: "2.2",
        url: "https://example.com"
      }],
      severity: "warning",
      message: "Target is too small"
    },
    {
      source: "axe",
      framework: "react",
      ruleId: "page-has-heading-one",
      wcag: [],
      wcagCriteria: [],
      severity: "warning",
      message: "Page should contain a level-one heading"
    }
  ], {
    level: "AA",
    version: "2.0",
    includeUnmapped: true
  });

  assert.deepEqual(issues.map((issue) => issue.ruleId), [
    "color-contrast",
    "page-has-heading-one"
  ]);
});

test("filterByWcagLevel excludes unmapped findings for explicit WCAG filters", () => {
  const issues = filterByWcagLevel([
    {
      source: "axe",
      framework: "react",
      ruleId: "page-has-heading-one",
      wcag: [],
      wcagCriteria: [],
      severity: "warning",
      message: "Page should contain a level-one heading"
    }
  ], "AA");

  assert.deepEqual(issues, []);
});
