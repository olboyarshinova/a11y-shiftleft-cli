import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { createProgram } from "../../dist/cli.js";
import { attachAuditMatrixScreenshotDiffs, createAuditBrowserMatrixReport, createAuditDeviceMatrixReport, formatAuditBrowserMatrixSummary, formatAuditDeviceMatrixSummary, hasAuditBrowserMatrix, hasAuditDeviceMatrix, normalizeAuditUrl, renderAuditMatrixHtmlSummary, resolveAuditBrowserTargets, resolveAuditDepthOption, resolveAuditDeviceTargets, resolveAuditProfileOptions } from "../../dist/commands/audit.js";

test("audit is the unified visual report command with optional extra formats", () => {
  const audit = createProgram().commands.find((command) => command.name() === "audit");

  assert.ok(audit);
  assert.match(audit.description(), /one visual accessibility report/);
  assert.deepEqual(audit.aliases(), ["quick"]);
  const flags = audit.options.map((option) => option.long);
  assert.equal(flags.includes("--url"), true);
  assert.equal(flags.includes("--profile"), true);
  assert.equal(flags.includes("--with-lighthouse"), true);
  assert.equal(flags.includes("--excel"), true);
  assert.equal(flags.includes("--pdf"), true);
  assert.equal(flags.includes("--raw"), true);
  assert.equal(flags.includes("--open"), true);
  assert.equal(flags.includes("--max-depth"), true);
  assert.equal(flags.includes("--browsers"), true);
  assert.equal(flags.includes("--mobile"), true);
  assert.equal(flags.includes("--tablet"), true);
  assert.equal(flags.includes("--devices"), true);
  assert.equal(flags.includes("--auth-state"), true);
  assert.equal(flags.includes("--no-keyboard"), true);
  assert.equal(flags.includes("--no-manual-review"), true);
  assert.equal(flags.includes("--wait-ms"), true);
  assert.equal(flags.includes("--wait-for-selector"), true);
  assert.equal(flags.includes("--wait-until-url"), true);
  assert.equal(flags.includes("--wait-until-path"), true);
  assert.equal(flags.includes("--pause-on-human-verification"), true);
  assert.equal(flags.includes("--human-verification-timeout-ms"), true);
  assert.equal(flags.includes("--no-scroll"), true);
  assert.equal(flags.includes("--screenshot-full-page"), true);
  assert.equal(flags.includes("--safe-block-request"), true);
  assert.equal(flags.includes("--wcag-only"), true);
});

test("resolveAuditProfileOptions applies bounded audit profiles", () => {
  assert.deepEqual(resolveAuditProfileOptions({
    url: "https://example.com",
    profile: "risk"
  }), {
    url: "https://example.com",
    profile: "risk",
    maxDepth: "1",
    limit: "10",
    actionsPerState: "4",
    maxTabs: "25",
    withLighthouse: undefined,
    activation: undefined
  });

  assert.deepEqual(resolveAuditProfileOptions({
    url: "https://example.com",
    profile: "full"
  }), {
    url: "https://example.com",
    profile: "full",
    maxDepth: "3",
    limit: "50",
    actionsPerState: "12",
    maxTabs: "80",
    withLighthouse: true,
    activation: true
  });
});

test("resolveAuditProfileOptions keeps explicit values when called directly", () => {
  assert.equal(resolveAuditProfileOptions({
    url: "https://example.com",
    profile: "full",
    maxDepth: "2",
    limit: "12",
    withLighthouse: false
  }).maxDepth, "2");
  assert.equal(resolveAuditProfileOptions({
    url: "https://example.com",
    profile: "full",
    maxDepth: "2",
    limit: "12",
    withLighthouse: false
  }).limit, "12");
  assert.equal(resolveAuditProfileOptions({
    url: "https://example.com",
    profile: "full",
    maxDepth: "2",
    limit: "12",
    withLighthouse: false
  }).withLighthouse, false);
});

test("resolveAuditProfileOptions rejects unknown profiles", () => {
  assert.throws(
    () => resolveAuditProfileOptions({ url: "https://example.com", profile: "everything" }),
    /Unsupported audit profile/
  );
});

test("resolveAuditDepthOption prefers explicit max depth over legacy depth", () => {
  assert.equal(resolveAuditDepthOption({ depth: "1" }), "1");
  assert.equal(resolveAuditDepthOption({ maxDepth: "3" }), "3");
  assert.equal(resolveAuditDepthOption({ depth: "1", maxDepth: "3" }), "3");
});

test("normalizeAuditUrl trims whitespace and smart quotes", () => {
  assert.equal(normalizeAuditUrl(" https://binaryville.com/ "), "https://binaryville.com/");
  assert.equal(normalizeAuditUrl("“https://binaryville.com/”"), "https://binaryville.com/");
  assert.equal(normalizeAuditUrl("«https://binaryville.com/»"), "https://binaryville.com/");
});

test("normalizeAuditUrl rejects non-http URLs", () => {
  assert.throws(
    () => normalizeAuditUrl("file:///tmp/example.html"),
    /Use http:\/\/ or https:\/\//
  );
});

test("resolveAuditDeviceTargets maps bounded device matrix profiles", () => {
  assert.equal(hasAuditDeviceMatrix({ devices: ["desktop", "mobile"] }), true);
  assert.equal(hasAuditDeviceMatrix({ devices: ["   "] }), false);
  assert.deepEqual(resolveAuditDeviceTargets({
    devices: ["desktop", "mobile", "tablet", "Pixel 5", "mobile"]
  }), [
    { label: "desktop", slug: "desktop" },
    { label: "mobile (iPhone 13)", slug: "mobile", device: "iPhone 13" },
    { label: "tablet (iPad (gen 7))", slug: "tablet", device: "iPad (gen 7)" },
    { label: "Pixel 5", slug: "pixel-5", device: "Pixel 5" }
  ]);
});

test("resolveAuditDeviceTargets rejects conflicting single-device options", () => {
  assert.throws(
    () => resolveAuditDeviceTargets({ devices: ["desktop", "mobile"], mobile: true }),
    /Use either --devices/
  );
  assert.throws(
    () => resolveAuditDeviceTargets({ devices: ["desktop"], device: "Pixel 5" }),
    /Use either --devices/
  );
});

test("resolveAuditBrowserTargets maps bounded browser matrix engines", () => {
  assert.equal(hasAuditBrowserMatrix({ browsers: ["chromium", "webkit"] }), true);
  assert.equal(hasAuditBrowserMatrix({ browsers: ["   "] }), false);
  assert.deepEqual(resolveAuditBrowserTargets({
    browsers: ["chromium", "firefox", "webkit", "Chromium"]
  }), [
    { label: "Chromium", slug: "chromium", browser: "chromium" },
    { label: "Firefox", slug: "firefox", browser: "firefox" },
    { label: "WebKit", slug: "webkit", browser: "webkit" }
  ]);
});

test("resolveAuditBrowserTargets rejects conflicting and unknown browser options", () => {
  assert.throws(
    () => resolveAuditBrowserTargets({ browsers: ["chromium", "webkit"], browser: "chromium" }),
    /Use either --browsers/
  );
  assert.throws(
    () => resolveAuditBrowserTargets({ browsers: ["chrome"] }),
    /Unsupported browser engine/
  );
});

test("formatAuditDeviceMatrixSummary links generated visual reports", () => {
  const markdown = formatAuditDeviceMatrixSummary([
    {
      target: { label: "desktop", slug: "desktop" },
      failed: false,
      outputDir: "reports/devices/desktop",
      summary: {
        total: 3,
        critical: 1,
        warning: 2,
        info: 0,
        states: 4,
        topRules: [
          { ruleId: "color-contrast", severity: "critical", count: 2 },
          { ruleId: "target-size", severity: "warning", count: 1 }
        ],
        topStates: [
          { id: "state-2", label: "Click: Open menu", url: "https://example.com/", depth: 1, issueCount: 3 },
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true }
        ],
        topPages: [
          { page: "https://example.com/", total: 3, critical: 1, warning: 2, info: 0 }
        ]
      }
    },
    {
      target: { label: "mobile (iPhone 13)", slug: "mobile", device: "iPhone 13" },
      failed: false,
      outputDir: "reports/devices/mobile",
      summary: {
        total: 5,
        critical: 0,
        warning: 5,
        info: 0,
        states: 3,
        topRules: [
          { ruleId: "target-size", severity: "warning", count: 5 },
          { ruleId: "layout-horizontal-overflow", severity: "warning", count: 2 }
        ],
        topStates: [
          { id: "state-4", label: "Navigate: Checkout", url: "https://example.com/checkout", depth: 2, issueCount: 5 },
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 4, screenshot: "screenshots/state-1-mobile.png", screenshotEvidenceCount: 2, screenshotFullPage: false }
        ],
        topPages: [
          { page: "https://example.com/checkout", total: 5, critical: 0, warning: 5, info: 0 }
        ]
      }
    }
  ], {
    url: "https://example.com/",
    maxDepth: "3",
    limit: "12",
    withLighthouse: true
  });

  assert.match(markdown, /# Device Audit Summary/);
  assert.match(markdown, /Total across profiles: 8 total \(1 critical, 7 warning, 0 info\); 7 explored states\./);
  assert.match(markdown, /\| Device profile \| Status \| Findings \| States \| Report \|/);
  assert.match(markdown, /desktop \| completed \| 3 total \(1 critical, 2 warning, 0 info\) \| 4 \| \[Open report\]\(reports\/devices\/desktop\/a11y-report\.html\)/);
  assert.match(markdown, /mobile \(iPhone 13\) \| completed \| 5 total \(0 critical, 5 warning, 0 info\) \| 3 \| \[Open report\]\(reports\/devices\/mobile\/a11y-report\.html\)/);
  assert.match(markdown, /## Difference Review/);
  assert.match(markdown, /Most findings: mobile \(iPhone 13\) \(5\)\./);
  assert.match(markdown, /Coverage overlap: 0 shared affected pages; 2 profile-specific affected pages; 1 shared affected state; 2 profile-specific affected states\./);
  assert.match(markdown, /`color-contrast` \| critical \| 2 \| desktop: 2; mobile \(iPhone 13\): 0/);
  assert.match(markdown, /`target-size` \| warning \| 6 \| desktop: 1; mobile \(iPhone 13\): 5/);
  assert.match(markdown, /### Profile-Specific Rule Signals/);
  assert.match(markdown, /desktop \| color-contrast: 2 critical/);
  assert.match(markdown, /mobile \(iPhone 13\) \| layout-horizontal-overflow: 2 warning/);
  assert.match(markdown, /### Profile-Specific Page And State Signals/);
  assert.match(markdown, /desktop \| page \| https:\/\/example\.com\/ \(3 findings\)/);
  assert.match(markdown, /mobile \(iPhone 13\) \| page \| https:\/\/example\.com\/checkout \(5 findings\)/);
  assert.match(markdown, /mobile \(iPhone 13\) \| state \| Navigate: Checkout \(5 findings, depth 2\)/);
  assert.match(markdown, /### Shared States With Different Finding Counts/);
  assert.match(markdown, /Initial page \| https:\/\/example\.com\/ \| 0 \| 3 \| desktop: 1; mobile \(iPhone 13\): 4/);
  assert.match(markdown, /\[desktop: 1\]\(reports\/devices\/desktop\/a11y-report\.html#state-1\) \(full-page, 1 screenshot\); \[mobile \(iPhone 13\): 4\]\(reports\/devices\/mobile\/a11y-report\.html#state-1\) \(viewport, 2 screenshots\)/);
  assert.match(markdown, /### Visual Comparison Queue/);
  assert.match(markdown, /Initial page \| medium: Screenshot capture modes differ; compare the linked full-page and viewport evidence carefully\. \| mobile \(iPhone 13\) \(4\) vs desktop \(1\) \| 3 finding spread at depth 0/);
  assert.match(markdown, /Screenshot capture modes differ; compare the linked full-page and viewport evidence carefully/);
  assert.match(markdown, /## Review Hotspots/);
  assert.match(markdown, /desktop \| Click: Open menu \(3 findings, depth 1\) \| color-contrast: 2; target-size: 1/);
  assert.match(markdown, /mobile \(iPhone 13\) \| Navigate: Checkout \(5 findings, depth 2\) \| target-size: 5/);
  assert.match(markdown, /npx a11y-shiftleft-cli audit --url https:\/\/example\.com\/ --max-depth 3 --limit 12 --out reports\/devices\/desktop --with-lighthouse/);
  assert.match(markdown, /--out reports\/devices\/mobile --with-lighthouse --device 'iPhone 13'/);
  assert.match(markdown, /## Reproduction Notes/);
  assert.match(markdown, /desktop \| Use as the desktop comparison baseline for responsive issues\./);
  assert.match(markdown, /mobile \(iPhone 13\) \| Compare against the desktop report; treat profile-only findings as responsive signals until confirmed\./);
});

test("createAuditDeviceMatrixReport exports machine-readable device results", () => {
  const report = createAuditDeviceMatrixReport([
    {
      target: { label: "desktop", slug: "desktop" },
      failed: false,
      outputDir: "reports/devices/desktop",
      summary: {
        total: 3,
        critical: 1,
        warning: 2,
        info: 0,
        states: 4,
        topRules: [
          { ruleId: "color-contrast", severity: "critical", count: 2 }
        ],
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 2, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true }
        ],
        topPages: [
          { page: "https://example.com/", total: 3, critical: 1, warning: 2, info: 0 }
        ]
      }
    },
    {
      target: { label: "mobile (iPhone 13)", slug: "mobile", device: "iPhone 13" },
      failed: true,
      outputDir: "reports/devices/mobile",
      summary: {
        total: 2,
        critical: 0,
        warning: 1,
        info: 1,
        states: 3,
        topRules: [
          { ruleId: "target-size", severity: "warning", count: 1 },
          { ruleId: "layout-horizontal-overflow", severity: "warning", count: 2 }
        ],
        topStates: [
          { id: "state-3", label: "Click: Filters", url: "https://example.com/", depth: 1, issueCount: 1 },
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1-mobile.png", screenshotEvidenceCount: 1, screenshotFullPage: false, visualDuplicateOf: "state-1" }
        ],
        topPages: [
          { page: "https://example.com/filters", total: 2, critical: 0, warning: 1, info: 1 }
        ]
      }
    }
  ], "2026-07-26T00:00:00.000Z", {
    url: "https://example.com/",
    depth: "2",
    limit: "10",
    screenshots: false
  });

  assert.equal(report.generatedAt, "2026-07-26T00:00:00.000Z");
  assert.deepEqual(report.totals, {
    total: 5,
    critical: 1,
    warning: 3,
    info: 1,
    states: 7
  });
  assert.deepEqual(report.comparison.highestTotal, {
    label: "desktop",
    value: 3
  });
  assert.deepEqual(report.comparison.differingRules.map((rule) => rule.ruleId), [
    "color-contrast",
    "layout-horizontal-overflow",
    "target-size"
  ]);
  assert.deepEqual(report.comparison.coverageOverlap, {
    completedProfiles: 2,
    commonPages: 0,
    profileSpecificPages: 2,
    commonStates: 1,
    profileSpecificStates: 1
  });
  assert.deepEqual(report.comparison.sharedStateDifferences, [
    {
      stateKey: "https://example.com/::Initial page::depth-0",
      label: "Initial page",
      url: "https://example.com/",
      depth: 0,
      total: 3,
      spread: 1,
      profileCounts: {
        desktop: 2,
        "mobile (iPhone 13)": 1
      },
      evidenceLinks: [
        { label: "desktop", report: "reports/devices/desktop/a11y-report.html#state-1", count: 2, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true },
        { label: "mobile (iPhone 13)", report: "reports/devices/mobile/a11y-report.html#state-1", count: 1, screenshot: "screenshots/state-1-mobile.png", screenshotEvidenceCount: 1, screenshotFullPage: false, visualDuplicateOf: "state-1" }
      ]
    }
  ]);
  assert.deepEqual(report.comparison.visualComparisonQueue, [
    {
      stateKey: "https://example.com/::Initial page::depth-0",
      label: "Initial page",
      url: "https://example.com/",
      depth: 0,
      spread: 1,
      compare: "desktop (2) vs mobile (iPhone 13) (1)",
      screenshotReview: "At least one profile reuses a screenshot from another state; confirm the linked report before treating it as a visual difference.",
      reviewPriority: {
        level: "medium",
        reason: "At least one profile reuses a screenshot from another state; confirm the linked report before treating it as a visual difference."
      },
      visualEvidence: [
        { label: "desktop", report: "reports/devices/desktop/a11y-report.html#state-1", count: 2, screenshot: "screenshots/state-1.png", screenshotMode: "full-page", screenshotEvidenceCount: 1 },
        { label: "mobile (iPhone 13)", report: "reports/devices/mobile/a11y-report.html#state-1", count: 1, screenshot: "screenshots/state-1-mobile.png", screenshotMode: "viewport", screenshotEvidenceCount: 1, visualDuplicateOf: "state-1" }
      ],
      evidenceLinks: [
        { label: "desktop", report: "reports/devices/desktop/a11y-report.html#state-1", count: 2, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true },
        { label: "mobile (iPhone 13)", report: "reports/devices/mobile/a11y-report.html#state-1", count: 1, screenshot: "screenshots/state-1-mobile.png", screenshotEvidenceCount: 1, screenshotFullPage: false, visualDuplicateOf: "state-1" }
      ]
    }
  ]);
  assert.deepEqual(report.comparison.profileSpecificRules, [
    {
      label: "desktop",
      rules: [
        { ruleId: "color-contrast", severity: "critical", count: 2 }
      ]
    },
    {
      label: "mobile (iPhone 13)",
      rules: [
        { ruleId: "layout-horizontal-overflow", severity: "warning", count: 2 },
        { ruleId: "target-size", severity: "warning", count: 1 }
      ]
    }
  ]);
  assert.deepEqual(report.comparison.profileSpecificPages.map((group) => group.label), [
    "desktop",
    "mobile (iPhone 13)"
  ]);
  assert.deepEqual(report.comparison.profileSpecificStates.map((group) => group.label), [
    "mobile (iPhone 13)"
  ]);
  assert.deepEqual(report.profiles[1], {
    label: "mobile (iPhone 13)",
    slug: "mobile",
    device: "iPhone 13",
    status: "failed",
    outputDir: "reports/devices/mobile",
    htmlReport: "reports/devices/mobile/a11y-report.html",
    jsonReport: "reports/devices/mobile/a11y-report.json",
    rerunCommand: "npx a11y-shiftleft-cli audit --url https://example.com/ --max-depth 2 --limit 10 --out reports/devices/mobile --no-screenshots --device 'iPhone 13'",
    summary: {
      total: 2,
      critical: 0,
      warning: 1,
      info: 1,
      states: 3,
      topRules: [
        { ruleId: "target-size", severity: "warning", count: 1 },
        { ruleId: "layout-horizontal-overflow", severity: "warning", count: 2 }
      ],
      topStates: [
        { id: "state-3", label: "Click: Filters", url: "https://example.com/", depth: 1, issueCount: 1 },
        { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1-mobile.png", screenshotEvidenceCount: 1, screenshotFullPage: false, visualDuplicateOf: "state-1" }
      ],
      topPages: [
        { page: "https://example.com/filters", total: 2, critical: 0, warning: 1, info: 1 }
      ]
    }
  });
});

test("renderAuditMatrixHtmlSummary creates side-by-side visual evidence links", () => {
  const report = createAuditDeviceMatrixReport([
    {
      target: { label: "desktop", slug: "desktop" },
      failed: false,
      outputDir: "reports/devices/desktop",
      summary: {
        total: 3,
        critical: 1,
        warning: 2,
        info: 0,
        states: 4,
        topRules: [
          { ruleId: "color-contrast", severity: "critical", count: 2 }
        ],
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 2, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true }
        ],
        topPages: [
          { page: "https://example.com/", total: 3, critical: 1, warning: 2, info: 0 }
        ]
      }
    },
    {
      target: { label: "mobile (iPhone 13)", slug: "mobile", device: "iPhone 13" },
      failed: false,
      outputDir: "reports/devices/mobile",
      summary: {
        total: 1,
        critical: 0,
        warning: 1,
        info: 0,
        states: 3,
        topRules: [
          { ruleId: "target-size", severity: "warning", count: 1 }
        ],
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1-mobile.png", screenshotEvidenceCount: 1, screenshotFullPage: false }
        ],
        topPages: [
          { page: "https://example.com/", total: 1, critical: 0, warning: 1, info: 0 }
        ]
      }
    }
  ], "2026-07-26T00:00:00.000Z");

  const html = renderAuditMatrixHtmlSummary("Device Audit Summary", "device profile", report, "reports/devices");

  assert.match(html, /<title>Device Audit Summary<\/title>/);
  assert.match(html, /Side-by-side Review/);
  assert.match(html, /Visual overlay/);
  assert.match(html, /medium review priority/);
  assert.match(html, /data-diff-slider/);
  assert.match(html, /data-diff-input/);
  assert.match(html, /Drag to reveal mobile \(iPhone 13\) over desktop/);
  assert.match(html, /desktop\/a11y-report\.html#state-1/);
  assert.match(html, /mobile\/a11y-report\.html#state-1/);
  assert.match(html, /desktop\/screenshots\/state-1\.png/);
  assert.match(html, /mobile\/screenshots\/state-1-mobile\.png/);
  assert.match(html, /Screenshot capture modes differ; compare the linked full-page and viewport evidence carefully/);
});

test("attachAuditMatrixScreenshotDiffs adds screenshot size deltas to matrix reports", async () => {
  const baseOutputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-matrix-diff-"));
  const desktopDir = path.join(baseOutputDir, "desktop");
  const mobileDir = path.join(baseOutputDir, "mobile");
  await fs.mkdir(path.join(desktopDir, "screenshots"), { recursive: true });
  await fs.mkdir(path.join(mobileDir, "screenshots"), { recursive: true });
  await fs.writeFile(path.join(desktopDir, "screenshots", "state-1.png"), createPngHeader(400, 300));
  await fs.writeFile(path.join(mobileDir, "screenshots", "state-1-mobile.png"), createPngHeader(375, 300));

  const report = createAuditDeviceMatrixReport([
    {
      target: { label: "desktop", slug: "desktop" },
      failed: false,
      outputDir: desktopDir,
      summary: {
        total: 2,
        critical: 1,
        warning: 1,
        info: 0,
        states: 1,
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 2, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true }
        ]
      }
    },
    {
      target: { label: "mobile", slug: "mobile" },
      failed: false,
      outputDir: mobileDir,
      summary: {
        total: 1,
        critical: 0,
        warning: 1,
        info: 0,
        states: 1,
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1-mobile.png", screenshotEvidenceCount: 1, screenshotFullPage: false }
        ]
      }
    }
  ], "2026-07-26T00:00:00.000Z");

  await attachAuditMatrixScreenshotDiffs(report, baseOutputDir);

  assert.deepEqual(report.comparison.visualComparisonQueue[0]?.screenshotDiff, {
    status: "different-size",
    widthDelta: 25,
    heightDelta: 0,
    note: "Screenshot sizes differ: desktop is 400 x 300; mobile is 375 x 300."
  });
  assert.deepEqual(report.comparison.visualComparisonQueue[0]?.pixelDiff, {
    status: "different-size",
    note: "Pixel diff was not measured because the screenshots have different dimensions."
  });
  assert.deepEqual(report.comparison.visualComparisonQueue[0]?.reviewPriority, {
    level: "medium",
    reason: "Screenshot dimensions differ, so compare the visual reports before treating the finding spread as product behavior."
  });
  assert.deepEqual(report.comparison.visualComparisonQueue[0]?.visualEvidence.map((evidence) => ({
    label: evidence.label,
    width: evidence.screenshotWidth,
    height: evidence.screenshotHeight
  })), [
    { label: "desktop", width: 400, height: 300 },
    { label: "mobile", width: 375, height: 300 }
  ]);

  const html = renderAuditMatrixHtmlSummary("Device Audit Summary", "device profile", report, baseOutputDir);
  assert.match(html, /Screenshot diff: different size/);
  assert.match(html, /Pixel diff: different-size/);
  assert.match(html, /Pixel difference: different-size/);
  assert.match(html, /medium review priority/);
  assert.match(html, /pixel-diff-unavailable/);
  assert.match(html, /400 x 300/);
  assert.match(html, /375 x 300/);
});

test("attachAuditMatrixScreenshotDiffs measures changed pixels for equal-size PNG evidence", async () => {
  const baseOutputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-matrix-pixel-diff-"));
  const desktopDir = path.join(baseOutputDir, "desktop");
  const tabletDir = path.join(baseOutputDir, "tablet");
  await fs.mkdir(path.join(desktopDir, "screenshots"), { recursive: true });
  await fs.mkdir(path.join(tabletDir, "screenshots"), { recursive: true });
  await fs.writeFile(path.join(desktopDir, "screenshots", "state-1.png"), createPngImage(2, 1, [
    [255, 255, 255, 255],
    [0, 0, 0, 255]
  ]));
  await fs.writeFile(path.join(tabletDir, "screenshots", "state-1.png"), createPngImage(2, 1, [
    [255, 255, 255, 255],
    [255, 0, 0, 255]
  ]));

  const report = createAuditDeviceMatrixReport([
    {
      target: { label: "desktop", slug: "desktop" },
      failed: false,
      outputDir: desktopDir,
      summary: {
        total: 2,
        critical: 1,
        warning: 1,
        info: 0,
        states: 1,
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 2, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true }
        ]
      }
    },
    {
      target: { label: "tablet", slug: "tablet" },
      failed: false,
      outputDir: tabletDir,
      summary: {
        total: 1,
        critical: 0,
        warning: 1,
        info: 0,
        states: 1,
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true }
        ]
      }
    }
  ], "2026-07-26T00:00:00.000Z");

  await attachAuditMatrixScreenshotDiffs(report, baseOutputDir);

  assert.deepEqual(report.comparison.visualComparisonQueue[0]?.pixelDiff, {
    status: "changed-pixels",
    changedPixels: 1,
    totalPixels: 2,
    changedRatio: 0.5,
    changedPercent: 50,
    hotspots: [{
      xPercent: 50,
      yPercent: 0,
      widthPercent: 50,
      heightPercent: 100,
      changedPixels: 1,
      changedPercent: 100
    }],
    note: "1 of 2 pixels changed (50%)."
  });
  assert.deepEqual(report.comparison.visualComparisonQueue[0]?.reviewPriority, {
    level: "high",
    reason: "Large visual difference detected (50% changed pixels). Review this state before lower-difference comparisons."
  });

  const markdown = formatAuditDeviceMatrixSummary([
    {
      target: { label: "desktop", slug: "desktop" },
      failed: false,
      outputDir: desktopDir,
      summary: {
        total: 2,
        critical: 1,
        warning: 1,
        info: 0,
        states: 1,
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 2, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true }
        ]
      }
    },
    {
      target: { label: "tablet", slug: "tablet" },
      failed: false,
      outputDir: tabletDir,
      summary: {
        total: 1,
        critical: 0,
        warning: 1,
        info: 0,
        states: 1,
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1.png", screenshotEvidenceCount: 1, screenshotFullPage: true }
        ]
      }
    }
  ], undefined, report);
  assert.match(markdown, /Pixel diff/);
  assert.match(markdown, /50% changed/);

  const html = renderAuditMatrixHtmlSummary("Device Audit Summary", "device profile", report, baseOutputDir);
  assert.match(html, /Pixel diff: 50% changed/);
  assert.match(html, /Pixel difference: 50% changed/);
  assert.match(html, /high review priority/);
  assert.match(html, /--pixel-diff: 50%/);
  assert.match(html, /class="diff-hotspot"/);
  assert.match(html, /left:50%;top:0%;width:50%;height:100%/);
  assert.match(html, /Top changed screenshot areas/);
  assert.match(html, /Area 1: 100% changed in this region/);
});

test("formatAuditBrowserMatrixSummary links generated visual reports", () => {
  const markdown = formatAuditBrowserMatrixSummary([
    {
      target: { label: "Chromium", slug: "chromium", browser: "chromium" },
      failed: false,
      outputDir: "reports/browsers/chromium",
      summary: {
        total: 4,
        critical: 1,
        warning: 2,
        info: 1,
        states: 5,
        topRules: [
          { ruleId: "button-name", severity: "critical", count: 1 },
          { ruleId: "focus-visible", severity: "warning", count: 2 }
        ],
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 4, screenshot: "screenshots/state-1-chromium.png", screenshotEvidenceCount: 2, screenshotFullPage: true }
        ],
        topPages: [
          { page: "https://example.com/", total: 4, critical: 1, warning: 2, info: 1 }
        ]
      }
    },
    {
      target: { label: "WebKit", slug: "webkit", browser: "webkit" },
      failed: false,
      outputDir: "reports/browsers/webkit",
      summary: {
        total: 2,
        critical: 0,
        warning: 2,
        info: 0,
        states: 4,
        topRules: [
          { ruleId: "focus-visible", severity: "warning", count: 2 },
          { ruleId: "webkit-focus-ring", severity: "warning", count: 1 }
        ],
        topStates: [
          { id: "state-2", label: "Click: Details", url: "https://example.com/", depth: 1, issueCount: 2 },
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1-webkit.png", screenshotEvidenceCount: 1, screenshotFullPage: false, visualDuplicateOf: "state-1" }
        ],
        topPages: [
          { page: "https://example.com/details", total: 2, critical: 0, warning: 2, info: 0 }
        ]
      }
    }
  ], {
    url: "https://example.com/",
    maxDepth: "1",
    limit: "8",
    keyboard: false,
    waitForSelector: "[data-ready]"
  });

  assert.match(markdown, /# Browser Audit Summary/);
  assert.match(markdown, /Total across browsers: 6 total \(1 critical, 4 warning, 1 info\); 9 explored states\./);
  assert.match(markdown, /\| Browser engine \| Status \| Findings \| States \| Report \|/);
  assert.match(markdown, /Chromium \| completed \| 4 total \(1 critical, 2 warning, 1 info\) \| 5 \| \[Open report\]\(reports\/browsers\/chromium\/a11y-report\.html\)/);
  assert.match(markdown, /WebKit \| completed \| 2 total \(0 critical, 2 warning, 0 info\) \| 4 \| \[Open report\]\(reports\/browsers\/webkit\/a11y-report\.html\)/);
  assert.match(markdown, /Use this section to spot findings that may be specific to one browser engine/);
  assert.match(markdown, /Coverage overlap: 0 shared affected pages; 2 profile-specific affected pages; 1 shared affected state; 1 profile-specific affected state\./);
  assert.match(markdown, /`button-name` \| critical \| 1 \| Chromium: 1; WebKit: 0/);
  assert.match(markdown, /`focus-visible` \| warning \| 4 \| Chromium: 2; WebKit: 2/);
  assert.match(markdown, /Chromium \| button-name: 1 critical/);
  assert.match(markdown, /WebKit \| webkit-focus-ring: 1 warning/);
  assert.match(markdown, /WebKit \| page \| https:\/\/example\.com\/details \(2 findings\)/);
  assert.match(markdown, /WebKit \| state \| Click: Details \(2 findings, depth 1\)/);
  assert.match(markdown, /Initial page \| https:\/\/example\.com\/ \| 0 \| 3 \| Chromium: 4; WebKit: 1/);
  assert.match(markdown, /\[Chromium: 4\]\(reports\/browsers\/chromium\/a11y-report\.html#state-1\) \(full-page, 2 screenshots\); \[WebKit: 1\]\(reports\/browsers\/webkit\/a11y-report\.html#state-1\) \(viewport, 1 screenshot, reuses state-1\)/);
  assert.match(markdown, /### Visual Comparison Queue/);
  assert.match(markdown, /Initial page \| medium: At least one profile reuses a screenshot from another state; confirm the linked report before treating it as a visual difference\. \| Chromium \(4\) vs WebKit \(1\) \| 3 finding spread at depth 0/);
  assert.match(markdown, /At least one profile reuses a screenshot from another state; confirm the linked report before treating it as a visual difference/);
  assert.match(markdown, /Chromium \| Initial page \(4 findings, depth 0\) \| button-name: 1; focus-visible: 2/);
  assert.match(markdown, /WebKit \| Click: Details \(2 findings, depth 1\) \| focus-visible: 2/);
  assert.match(markdown, /--wait-for-selector '\[data-ready\]' --no-keyboard --browser chromium/);
  assert.match(markdown, /--wait-for-selector '\[data-ready\]' --no-keyboard --browser webkit/);
  assert.match(markdown, /## Reproduction Notes/);
  assert.match(markdown, /Chromium \| Use as the Chromium comparison baseline unless your target users rely on another browser\./);
  assert.match(markdown, /WebKit \| Compare against Chromium and this browser report; treat engine-only findings as browser signals until confirmed\./);
});

test("createAuditBrowserMatrixReport exports machine-readable browser results", () => {
  const report = createAuditBrowserMatrixReport([
    {
      target: { label: "Chromium", slug: "chromium", browser: "chromium" },
      failed: false,
      outputDir: "reports/browsers/chromium",
      summary: {
        total: 4,
        critical: 1,
        warning: 2,
        info: 1,
        states: 5,
        topRules: [
          { ruleId: "button-name", severity: "critical", count: 1 }
        ],
        topStates: [
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 4, screenshot: "screenshots/state-1-chromium.png", screenshotEvidenceCount: 2, screenshotFullPage: true }
        ],
        topPages: [
          { page: "https://example.com/", total: 4, critical: 1, warning: 2, info: 1 }
        ]
      }
    },
    {
      target: { label: "Firefox", slug: "firefox", browser: "firefox" },
      failed: false,
      outputDir: "reports/browsers/firefox",
      summary: {
        total: 2,
        critical: 0,
        warning: 2,
        info: 0,
        states: 3,
        topRules: [
          { ruleId: "keyboard-focus-visible", severity: "warning", count: 2 },
          { ruleId: "firefox-outline-offset", severity: "warning", count: 1 }
        ],
        topStates: [
          { id: "state-2", label: "Click: Open menu", url: "https://example.com/", depth: 1, issueCount: 2 },
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 1, screenshot: "screenshots/state-1-firefox.png", screenshotEvidenceCount: 1, screenshotFullPage: false }
        ],
        topPages: [
          { page: "https://example.com/menu", total: 2, critical: 0, warning: 2, info: 0 }
        ]
      }
    }
  ], "2026-07-26T00:00:00.000Z", {
    url: "https://example.com/",
    maxDepth: "1",
    limit: "6",
    standard: "section508"
  });

  assert.equal(report.generatedAt, "2026-07-26T00:00:00.000Z");
  assert.deepEqual(report.totals, {
    total: 6,
    critical: 1,
    warning: 4,
    info: 1,
    states: 8
  });
  assert.deepEqual(report.comparison.highestCritical, {
    label: "Chromium",
    value: 1
  });
  assert.deepEqual(report.comparison.coverageOverlap, {
    completedProfiles: 2,
    commonPages: 0,
    profileSpecificPages: 2,
    commonStates: 1,
    profileSpecificStates: 1
  });
  assert.deepEqual(report.comparison.sharedStateDifferences, [
    {
      stateKey: "https://example.com/::Initial page::depth-0",
      label: "Initial page",
      url: "https://example.com/",
      depth: 0,
      total: 5,
      spread: 3,
      profileCounts: {
        Chromium: 4,
        Firefox: 1
      },
      evidenceLinks: [
        { label: "Chromium", report: "reports/browsers/chromium/a11y-report.html#state-1", count: 4, screenshot: "screenshots/state-1-chromium.png", screenshotEvidenceCount: 2, screenshotFullPage: true },
        { label: "Firefox", report: "reports/browsers/firefox/a11y-report.html#state-1", count: 1, screenshot: "screenshots/state-1-firefox.png", screenshotEvidenceCount: 1, screenshotFullPage: false }
      ]
    }
  ]);
  assert.deepEqual(report.comparison.visualComparisonQueue, [
    {
      stateKey: "https://example.com/::Initial page::depth-0",
      label: "Initial page",
      url: "https://example.com/",
      depth: 0,
      spread: 3,
      compare: "Chromium (4) vs Firefox (1)",
      screenshotReview: "Screenshot capture modes differ; compare the linked full-page and viewport evidence carefully.",
      reviewPriority: {
        level: "medium",
        reason: "Screenshot capture modes differ; compare the linked full-page and viewport evidence carefully."
      },
      visualEvidence: [
        { label: "Chromium", report: "reports/browsers/chromium/a11y-report.html#state-1", count: 4, screenshot: "screenshots/state-1-chromium.png", screenshotMode: "full-page", screenshotEvidenceCount: 2 },
        { label: "Firefox", report: "reports/browsers/firefox/a11y-report.html#state-1", count: 1, screenshot: "screenshots/state-1-firefox.png", screenshotMode: "viewport", screenshotEvidenceCount: 1 }
      ],
      evidenceLinks: [
        { label: "Chromium", report: "reports/browsers/chromium/a11y-report.html#state-1", count: 4, screenshot: "screenshots/state-1-chromium.png", screenshotEvidenceCount: 2, screenshotFullPage: true },
        { label: "Firefox", report: "reports/browsers/firefox/a11y-report.html#state-1", count: 1, screenshot: "screenshots/state-1-firefox.png", screenshotEvidenceCount: 1, screenshotFullPage: false }
      ]
    }
  ]);
  assert.equal(report.comparison.differingRules[0].ruleId, "button-name");
  assert.deepEqual(report.comparison.profileSpecificRules.map((group) => group.label), [
    "Chromium",
    "Firefox"
  ]);
  assert.deepEqual(report.comparison.profileSpecificPages[1].pages[0].page, "https://example.com/menu");
  assert.deepEqual(report.profiles[0], {
    label: "Chromium",
    slug: "chromium",
    browser: "chromium",
    status: "completed",
    outputDir: "reports/browsers/chromium",
    htmlReport: "reports/browsers/chromium/a11y-report.html",
    jsonReport: "reports/browsers/chromium/a11y-report.json",
    rerunCommand: "npx a11y-shiftleft-cli audit --url https://example.com/ --max-depth 1 --limit 6 --out reports/browsers/chromium --standard section508 --browser chromium",
    summary: {
      total: 4,
      critical: 1,
      warning: 2,
      info: 1,
      states: 5,
      topRules: [
        { ruleId: "button-name", severity: "critical", count: 1 }
      ],
      topStates: [
        { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 4, screenshot: "screenshots/state-1-chromium.png", screenshotEvidenceCount: 2, screenshotFullPage: true }
      ],
      topPages: [
        { page: "https://example.com/", total: 4, critical: 1, warning: 2, info: 1 }
      ]
    }
  });
});

function createPngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer[0] = 0x89;
  buffer.write("PNG", 1, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function createPngImage(width: number, height: number, pixels: Array<[number, number, number, number]>): Buffer {
  assert.equal(pixels.length, width * height);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawRows: number[] = [];
  for (let y = 0; y < height; y += 1) {
    rawRows.push(0);
    for (let x = 0; x < width; x += 1) {
      rawRows.push(...pixels[(y * width) + x]);
    }
  }

  return Buffer.concat([
    signature,
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", deflateSync(Buffer.from(rawRows))),
    createPngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  chunk.writeUInt32BE(0, 8 + data.length);
  return chunk;
}
