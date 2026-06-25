import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectDashboardData,
  renderDashboardHtml
} from "../../dist/core/dashboard.js";
import { formatDashboardSummary } from "../../dist/commands/dashboard.js";

test("collectDashboardData summarizes historical report runs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-dashboard-"));
  await writeReport(root, "run-1", {
    generatedAt: "2026-06-10T00:00:00.000Z",
    total: 3,
    critical: 1,
    warning: 2,
    info: 0,
    issues: [
      issue("button-name", "critical", "http://localhost:3000/"),
      issue("color-contrast", "warning", "http://localhost:3000/"),
      issue("color-contrast", "warning", "http://localhost:3000/settings")
    ],
    byPage: [
      page("http://localhost:3000/", 2, 1, 1, 0, 7),
      page("http://localhost:3000/settings", 1, 0, 1, 0, 2)
    ],
    lighthouseScore: 88
  });
  await writeReport(root, "run-2", {
    generatedAt: "2026-06-11T00:00:00.000Z",
    total: 1,
    critical: 0,
    warning: 1,
    info: 0,
    issues: [
      issue("color-contrast", "warning", "http://localhost:3000/settings")
    ],
    byPage: [
      page("http://localhost:3000/settings", 1, 0, 1, 0, 2)
    ],
    lighthouseScore: 94
  });

  const data = await collectDashboardData(root);

  assert.equal(data.totalRuns, 2);
  assert.equal(data.latestRun?.id, "run-2");
  assert.equal(data.latestRun?.total, 1);
  assert.deepEqual(data.trend.map((point) => point.total), [3, 1]);
  assert.deepEqual(data.trend.map((point) => point.lighthouseScore), [88, 94]);
  assert.equal(data.latestDelta?.previousRunId, "run-1");
  assert.equal(data.latestDelta?.latestRunId, "run-2");
  assert.deepEqual(data.latestDelta?.total, { previous: 3, latest: 1, change: -2 });
  assert.deepEqual(data.latestDelta?.critical, { previous: 1, latest: 0, change: -1 });
  assert.deepEqual(data.latestDelta?.lighthouseScore, { previous: 88, latest: 94, change: 6 });
  assert.equal(data.regressions?.previousRunId, "run-1");
  assert.equal(data.regressions?.latestRunId, "run-2");
  assert.deepEqual(data.regressions?.rules, []);
  assert.deepEqual(data.regressions?.pages, []);
  assert.equal(data.resolved?.previousRunId, "run-1");
  assert.equal(data.resolved?.latestRunId, "run-2");
  assert.deepEqual(data.resolved?.rules.map((item) => [item.id, item.previous, item.latest, item.resolved]), [
    ["color-contrast", 2, 1, 1],
    ["button-name", 1, 0, 1]
  ]);
  assert.deepEqual(data.resolved?.pages.map((item) => [item.id, item.previous, item.latest, item.resolved]), [
    ["http://localhost:3000/", 2, 0, 2]
  ]);
  assert.equal(data.topRules[0].ruleId, "color-contrast");
  assert.equal(data.topRules[0].total, 3);
  assert.equal(data.topPages[0].url, "http://localhost:3000/");
  assert.equal(data.runs[0].reportPath, "run-1/a11y-report.json");
  assert.equal(data.lighthouse?.runsWithLighthouse, 2);
  assert.equal(data.lighthouse?.latestScore, 94);
  assert.equal(data.lighthouse?.averageScore, 91);
  assert.equal(data.lighthouse?.failedAuditCount, 2);
  assert.equal(data.lighthouse?.manualAuditCount, 2);
  assert.equal(data.lighthouse?.lighthouseOnlyCount, 2);
  assert.equal(data.lighthouse?.pipelineOnlyCount, 2);
  assert.equal(data.lighthouse?.topFailedAudits[0].id, "color-contrast");
  assert.equal(data.lighthouse?.topFailedAudits[0].count, 2);
  assert.equal(data.latestRecommendations[0].ruleId, "color-contrast");
  assert.match(data.latestRecommendations[0].remediation.summary, /contrast/i);
  assert.doesNotMatch(JSON.stringify(data), new RegExp(escapeRegExp(root)));
});

test("renderDashboardHtml renders dashboard sections and escapes content", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-dashboard-html-"));
  await writeReport(root, "run-1", {
    generatedAt: "2026-06-10T00:00:00.000Z",
    total: 1,
    critical: 0,
    warning: 1,
    info: 0,
    issues: [
      issue("image-alt", "warning", "http://localhost:3000/?q=<script>")
    ],
    byPage: [
      page("http://localhost:3000/?q=<script>", 1, 0, 1, 0, 2)
    ],
    lighthouseScore: 91
  });

  const html = renderDashboardHtml(await collectDashboardData(root));

  assert.match(html, /a11y-shiftleft dashboard/);
  assert.match(html, /10 June 2026, 00:00 UTC/);
  assert.match(html, /Accessibility Trend/);
  assert.match(html, /Latest Change/);
  assert.match(html, /Save at least two report runs to compare the latest audit with the previous one/);
  assert.match(html, /New Or Worse Problems/);
  assert.match(html, /Save at least two report runs to detect rule and page regressions/);
  assert.match(html, /Resolved Problems/);
  assert.match(html, /Save at least two report runs to detect rules and pages that improved/);
  assert.match(html, /Findings/);
  assert.match(html, /Lighthouse Score/);
  assert.match(html, /fill fill-score/);
  assert.match(html, /Lighthouse Comparison/);
  assert.match(html, /Latest score/);
  assert.match(html, /Tool differences/);
  assert.match(html, /color-contrast/);
  assert.match(html, /Top Rules/);
  assert.match(html, /Most Affected Pages/);
  assert.match(html, /Latest Fix Recommendations/);
  assert.match(html, /Suggested fix/);
  assert.match(html, /react example/);
  assert.match(html, /image-alt/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("collectDashboardData and renderDashboardHtml show new or worse problems", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-dashboard-regressions-"));
  await writeReport(root, "run-1", {
    generatedAt: "2026-06-10T00:00:00.000Z",
    total: 1,
    critical: 0,
    warning: 1,
    info: 0,
    issues: [
      issue("color-contrast", "warning", "http://localhost:3000/")
    ],
    byPage: [
      page("http://localhost:3000/", 1, 0, 1, 0, 2)
    ]
  });
  await writeReport(root, "run-2", {
    generatedAt: "2026-06-11T00:00:00.000Z",
    total: 4,
    critical: 1,
    warning: 3,
    info: 0,
    issues: [
      issue("button-name", "critical", "http://localhost:3000/checkout"),
      issue("color-contrast", "warning", "http://localhost:3000/"),
      issue("color-contrast", "warning", "http://localhost:3000/checkout"),
      issue("image-alt", "warning", "http://localhost:3000/checkout")
    ],
    byPage: [
      page("http://localhost:3000/", 1, 0, 1, 0, 2),
      page("http://localhost:3000/checkout", 3, 1, 2, 0, 9)
    ]
  });

  const data = await collectDashboardData(root);
  const html = renderDashboardHtml(data);

  assert.deepEqual(data.regressions?.rules.map((item) => [item.id, item.previous, item.latest, item.change]), [
    ["color-contrast", 1, 2, 1],
    ["button-name", 0, 1, 1],
    ["image-alt", 0, 1, 1]
  ]);
  assert.deepEqual(data.regressions?.pages.map((item) => [item.id, item.previous, item.latest, item.change]), [
    ["http://localhost:3000/checkout", 0, 3, 3]
  ]);
  assert.match(html, /New Or Worse Problems/);
  assert.match(html, /Items that increased from <code>run-1<\/code> to <code>run-2<\/code>/);
  assert.match(html, /button-name[\s\S]*?\+1/);
  assert.match(html, /http:\/\/localhost:3000\/checkout[\s\S]*?\+3/);
});

test("collectDashboardData and renderDashboardHtml show resolved problems", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-dashboard-resolved-"));
  await writeReport(root, "run-1", {
    generatedAt: "2026-06-10T00:00:00.000Z",
    total: 4,
    critical: 1,
    warning: 3,
    info: 0,
    issues: [
      issue("button-name", "critical", "http://localhost:3000/checkout"),
      issue("color-contrast", "warning", "http://localhost:3000/"),
      issue("color-contrast", "warning", "http://localhost:3000/checkout"),
      issue("image-alt", "warning", "http://localhost:3000/checkout")
    ],
    byPage: [
      page("http://localhost:3000/", 1, 0, 1, 0, 2),
      page("http://localhost:3000/checkout", 3, 1, 2, 0, 9)
    ]
  });
  await writeReport(root, "run-2", {
    generatedAt: "2026-06-11T00:00:00.000Z",
    total: 1,
    critical: 0,
    warning: 1,
    info: 0,
    issues: [
      issue("color-contrast", "warning", "http://localhost:3000/")
    ],
    byPage: [
      page("http://localhost:3000/", 1, 0, 1, 0, 2)
    ]
  });

  const data = await collectDashboardData(root);
  const html = renderDashboardHtml(data);

  assert.deepEqual(data.resolved?.rules.map((item) => [item.id, item.previous, item.latest, item.resolved]), [
    ["color-contrast", 2, 1, 1],
    ["button-name", 1, 0, 1],
    ["image-alt", 1, 0, 1]
  ]);
  assert.deepEqual(data.resolved?.pages.map((item) => [item.id, item.previous, item.latest, item.resolved]), [
    ["http://localhost:3000/checkout", 3, 0, 3]
  ]);
  assert.match(html, /Resolved Problems/);
  assert.match(html, /Items that decreased from <code>run-1<\/code> to <code>run-2<\/code>/);
  assert.match(html, /image-alt[\s\S]*?-1/);
  assert.match(html, /http:\/\/localhost:3000\/checkout[\s\S]*?-3/);
});

test("renderDashboardHtml shows latest delta between two runs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-dashboard-delta-"));
  await writeReport(root, "run-1", {
    generatedAt: "2026-06-10T00:00:00.000Z",
    total: 5,
    critical: 2,
    warning: 3,
    info: 0,
    issues: [
      issue("button-name", "critical", "http://localhost:3000/")
    ],
    byPage: [
      page("http://localhost:3000/", 5, 2, 3, 0, 16)
    ],
    lighthouseScore: 80
  });
  await writeReport(root, "run-2", {
    generatedAt: "2026-06-11T00:00:00.000Z",
    total: 2,
    critical: 0,
    warning: 2,
    info: 0,
    issues: [
      issue("color-contrast", "warning", "http://localhost:3000/")
    ],
    byPage: [
      page("http://localhost:3000/", 2, 0, 2, 0, 4)
    ],
    lighthouseScore: 93
  });

  const html = renderDashboardHtml(await collectDashboardData(root));

  assert.match(html, /Latest Change/);
  assert.match(html, /Comparison from <code>run-1<\/code> to <code>run-2<\/code>/);
  assert.match(html, /Total findings[\s\S]*?-3/);
  assert.match(html, /Critical[\s\S]*?-2/);
  assert.match(html, /Lighthouse score[\s\S]*?\+13/);
  assert.match(html, /delta-good/);
});

test("formatDashboardSummary renders local output target", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-dashboard-summary-"));
  await writeReport(root, "run-1", {
    generatedAt: "2026-06-10T00:00:00.000Z",
    total: 2,
    critical: 1,
    warning: 1,
    info: 0,
    issues: [
      issue("button-name", "critical", "http://localhost:3000/"),
      issue("image-alt", "warning", "http://localhost:3000/profile")
    ],
    byPage: [
      page("http://localhost:3000/", 1, 1, 0, 0, 5),
      page("http://localhost:3000/profile", 1, 0, 1, 0, 2)
    ],
    lighthouseScore: 80
  });
  await writeReport(root, "run-2", {
    generatedAt: "2026-06-11T00:00:00.000Z",
    total: 2,
    critical: 0,
    warning: 2,
    info: 0,
    issues: [
      issue("color-contrast", "warning", "http://localhost:3000/checkout"),
      issue("image-alt", "warning", "http://localhost:3000/profile")
    ],
    byPage: [
      page("http://localhost:3000/checkout", 1, 0, 1, 0, 2),
      page("http://localhost:3000/profile", 1, 0, 1, 0, 2)
    ],
    lighthouseScore: 88
  });

  const output = formatDashboardSummary(await collectDashboardData(root), {
    mode: "file",
    outputPath: "reports/dashboard.html",
    pdfPath: "reports/dashboard.pdf"
  });

  assert.match(output, /Runs indexed: 2/);
  assert.match(output, /Latest run: run-2 total=2 critical=0 warning=2 info=0/);
  assert.match(output, /Latest change: total 0, critical -1, warning \+1, Lighthouse \+8/);
  assert.match(output, /New\/worse problems: 1 rule\(s\), 1 page\(s\)/);
  assert.match(output, /Resolved problems: 1 rule\(s\), 1 page\(s\)/);
  assert.match(output, /Top rule: image-alt \(2\)/);
  assert.match(output, /reports\/dashboard\.html/);
  assert.match(output, /PDF: reports\/dashboard\.pdf/);
});

interface ReportInput {
  generatedAt: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  issues: Array<ReturnType<typeof issue>>;
  byPage: Array<ReturnType<typeof page>>;
  lighthouseScore?: number;
}

async function writeReport(root: string, run: string, input: ReportInput): Promise<void> {
  const dir = path.join(root, run);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "a11y-report.json"), JSON.stringify({
    generatedAt: input.generatedAt,
    summary: {
      total: input.total,
      critical: input.critical,
      warning: input.warning,
      info: input.info,
      rawCount: input.total,
      uniqueCount: input.total,
      duplicateCount: 0,
      duplicateRate: 0,
      scanDurationMs: 100,
      framework: "react",
      urls: ["http://localhost:3000"],
      complianceEvidence: {
        automatedCoverage: "partial",
        requiresManualReview: true,
        totalFindings: input.total,
        wcagMappedFindings: input.total,
        unmappedFindings: 0,
        affectedPages: input.byPage.length,
        topAffectedPages: input.byPage.slice(0, 3)
      },
      bySource: { axe: input.total },
      bySeverity: {
        critical: input.critical,
        warning: input.warning,
        info: input.info
      },
      byConfidence: { high: input.total },
      byCategory: { controls: input.total },
      byPour: { robust: input.total },
      byWcagLevel: { A: input.total },
      byWcagVersion: { "2.0": input.total },
      byUnmappedRule: {},
      byPage: input.byPage,
      ...(typeof input.lighthouseScore === "number" ? {
        lighthouse: {
          enabled: true,
          pageCount: 1,
          averageAccessibilityScore: input.lighthouseScore,
          minAccessibilityScore: input.lighthouseScore,
          failedAuditCount: 1,
          manualAuditCount: 1,
          comparison: {
            matchingRuleIds: [],
            lighthouseOnlyAudits: [{
              id: "color-contrast",
              title: "Background and foreground colors have sufficient contrast",
              score: 0,
              scoreDisplayMode: "binary",
              description: "Low-contrast text can be difficult to read.",
              documentationUrl: "https://example.com/contrast"
            }],
            pipelineOnlyRules: [{
              ruleId: "button-name",
              count: 1,
              sources: ["axe"],
              highestSeverity: "critical",
              findingType: "wcag",
              category: "controls"
            }]
          },
          pages: [{
            url: "http://localhost:3000/",
            score: input.lighthouseScore,
            failedAudits: 1,
            manualAudits: 1
          }]
        }
      } : {})
    },
    issues: input.issues,
    ...(typeof input.lighthouseScore === "number" ? {
      lighthouse: [{
        url: "http://localhost:3000",
        finalUrl: "http://localhost:3000/",
        accessibilityScore: input.lighthouseScore,
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
          scoreDisplayMode: "manual"
        }],
        notApplicableAudits: 0,
        durationMs: 100
      }]
    } : {})
  }, null, 2));
}

function issue(ruleId: string, severity: "critical" | "warning" | "info", url: string) {
  return {
    source: "axe",
    framework: "react",
    ruleId,
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
    severity,
    confidence: "high",
    confidenceScore: 95,
    category: "controls",
    url,
    selector: "button",
    message: "Buttons must have discernible text",
    fingerprint: `${ruleId}:${severity}:${url}`,
    duplicateCount: 0
  };
}

function page(url: string, total: number, critical: number, warning: number, info: number, severityScore: number) {
  return {
    url,
    total,
    critical,
    warning,
    info,
    severityScore
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
