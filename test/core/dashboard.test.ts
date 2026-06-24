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

test("formatDashboardSummary renders local output target", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-dashboard-summary-"));
  await writeReport(root, "run-1", {
    generatedAt: "2026-06-10T00:00:00.000Z",
    total: 1,
    critical: 1,
    warning: 0,
    info: 0,
    issues: [
      issue("button-name", "critical", "http://localhost:3000/")
    ],
    byPage: [
      page("http://localhost:3000/", 1, 1, 0, 0, 5)
    ]
  });

  const output = formatDashboardSummary(await collectDashboardData(root), {
    mode: "file",
    outputPath: "reports/dashboard.html",
    pdfPath: "reports/dashboard.pdf"
  });

  assert.match(output, /Runs indexed: 1/);
  assert.match(output, /Latest run: run-1 total=1 critical=1 warning=0 info=0/);
  assert.match(output, /Top rule: button-name \(1\)/);
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
