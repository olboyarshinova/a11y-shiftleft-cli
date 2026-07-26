import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import { createAuditBrowserMatrixReport, createAuditDeviceMatrixReport, formatAuditBrowserMatrixSummary, formatAuditDeviceMatrixSummary, hasAuditBrowserMatrix, hasAuditDeviceMatrix, normalizeAuditUrl, resolveAuditBrowserTargets, resolveAuditDepthOption, resolveAuditDeviceTargets, resolveAuditProfileOptions } from "../../dist/commands/audit.js";

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
          { id: "state-2", label: "Click: Open menu", url: "https://example.com/", depth: 1, issueCount: 3 }
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
          { id: "state-4", label: "Navigate: Checkout", url: "https://example.com/checkout", depth: 2, issueCount: 5 }
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
  assert.match(markdown, /`color-contrast` \| critical \| 2 \| desktop: 2; mobile \(iPhone 13\): 0/);
  assert.match(markdown, /`target-size` \| warning \| 6 \| desktop: 1; mobile \(iPhone 13\): 5/);
  assert.match(markdown, /### Profile-Specific Rule Signals/);
  assert.match(markdown, /desktop \| color-contrast: 2 critical/);
  assert.match(markdown, /mobile \(iPhone 13\) \| layout-horizontal-overflow: 2 warning/);
  assert.match(markdown, /## Review Hotspots/);
  assert.match(markdown, /desktop \| Click: Open menu \(3 findings, depth 1\) \| color-contrast: 2; target-size: 1/);
  assert.match(markdown, /mobile \(iPhone 13\) \| Navigate: Checkout \(5 findings, depth 2\) \| target-size: 5/);
  assert.match(markdown, /npx a11y-shiftleft-cli audit --url https:\/\/example\.com\/ --max-depth 3 --limit 12 --out reports\/devices\/desktop --with-lighthouse/);
  assert.match(markdown, /--out reports\/devices\/mobile --with-lighthouse --device 'iPhone 13'/);
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
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 2 }
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
          { id: "state-3", label: "Click: Filters", url: "https://example.com/", depth: 1, issueCount: 1 }
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
        { id: "state-3", label: "Click: Filters", url: "https://example.com/", depth: 1, issueCount: 1 }
      ]
    }
  });
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
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 4 }
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
          { id: "state-2", label: "Click: Details", url: "https://example.com/", depth: 1, issueCount: 2 }
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
  assert.match(markdown, /`button-name` \| critical \| 1 \| Chromium: 1; WebKit: 0/);
  assert.match(markdown, /`focus-visible` \| warning \| 4 \| Chromium: 2; WebKit: 2/);
  assert.match(markdown, /Chromium \| button-name: 1 critical/);
  assert.match(markdown, /WebKit \| webkit-focus-ring: 1 warning/);
  assert.match(markdown, /Chromium \| Initial page \(4 findings, depth 0\) \| button-name: 1; focus-visible: 2/);
  assert.match(markdown, /WebKit \| Click: Details \(2 findings, depth 1\) \| focus-visible: 2/);
  assert.match(markdown, /--wait-for-selector '\[data-ready\]' --no-keyboard --browser chromium/);
  assert.match(markdown, /--wait-for-selector '\[data-ready\]' --no-keyboard --browser webkit/);
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
          { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 4 }
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
          { id: "state-2", label: "Click: Open menu", url: "https://example.com/", depth: 1, issueCount: 2 }
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
  assert.equal(report.comparison.differingRules[0].ruleId, "button-name");
  assert.deepEqual(report.comparison.profileSpecificRules.map((group) => group.label), [
    "Chromium",
    "Firefox"
  ]);
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
        { id: "state-1", label: "Initial page", url: "https://example.com/", depth: 0, issueCount: 4 }
      ]
    }
  });
});
