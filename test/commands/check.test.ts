import test from "node:test";
import assert from "node:assert/strict";
import { filterByWcagConformance, filterByWcagLevel, formatVerboseCheckSummary, parseFormats, parseUrls, resolveCheckModes, shouldFail } from "../../dist/commands/check.js";

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
    updateBaseline: false,
    standard: "wcag22-aa",
    wcagVersion: "2.2",
    wcagLevel: "AA",
    crawl: true,
    crawlDepth: 1,
    crawlLimit: 10
  });

  assert.match(output, /framework: react/);
  assert.match(output, /modes: static=on, dynamic=on/);
  assert.match(output, /urls: http:\/\/localhost:3000/);
  assert.match(output, /crawl: enabled depth=1 limit=10/);
  assert.match(output, /baseline: enabled file=.a11y-baseline.json/);
  assert.match(output, /static: enabled, findings=1, duration=25ms/);
  assert.match(output, /dynamic: enabled, findings=2, duration=150ms/);
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
