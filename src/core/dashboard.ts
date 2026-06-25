import fs from "node:fs/promises";
import path from "node:path";
import { getRemediationHint } from "./remediation.js";
import { formatReportDateUtc } from "./reportDate.js";
import type { A11yReport, RemediationHint, Severity } from "../types.js";

export interface DashboardOptions {
  maxDepth?: number;
}

export interface DashboardTrendPoint {
  id: string;
  generatedAt: string;
  reportPath: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  duplicateRate: number;
  scanDurationMs: number;
  lighthouseScore?: number | null;
}

export interface DashboardRuleSummary {
  ruleId: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export interface DashboardPageSummary {
  url: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  severityScore: number;
  runs: number;
}

export interface DashboardRunSummary extends DashboardTrendPoint {
  framework: string;
  urls: string[];
}

export interface DashboardDeltaMetric {
  previous: number | null;
  latest: number | null;
  change: number | null;
}

export interface DashboardLatestDelta {
  previousRunId: string;
  latestRunId: string;
  total: DashboardDeltaMetric;
  critical: DashboardDeltaMetric;
  warning: DashboardDeltaMetric;
  info: DashboardDeltaMetric;
  lighthouseScore: DashboardDeltaMetric;
}

export interface DashboardRegressionItem {
  id: string;
  previous: number;
  latest: number;
  change: number;
}

export interface DashboardRegressionSummary {
  previousRunId: string;
  latestRunId: string;
  rules: DashboardRegressionItem[];
  pages: DashboardRegressionItem[];
}

export interface DashboardRecommendation {
  ruleId: string;
  severity: Severity;
  message: string;
  page: string;
  target: string;
  occurrences: number;
  remediation: RemediationHint;
}

export interface DashboardLighthouseAuditSummary {
  id: string;
  title: string;
  count: number;
}

export interface DashboardLighthouseSummary {
  runsWithLighthouse: number;
  latestScore: number | null;
  averageScore: number | null;
  failedAuditCount: number;
  manualAuditCount: number;
  lighthouseOnlyCount: number;
  pipelineOnlyCount: number;
  topFailedAudits: DashboardLighthouseAuditSummary[];
}

export interface DashboardData {
  generatedAt: string;
  reportsRoot: string;
  totalRuns: number;
  latestRun?: DashboardRunSummary;
  latestDelta?: DashboardLatestDelta;
  regressions?: DashboardRegressionSummary;
  runs: DashboardRunSummary[];
  trend: DashboardTrendPoint[];
  topRules: DashboardRuleSummary[];
  topPages: DashboardPageSummary[];
  latestRecommendations: DashboardRecommendation[];
  lighthouse?: DashboardLighthouseSummary;
}

interface ReportFile {
  absolutePath: string;
  relativePath: string;
  report: A11yReport;
}

const DEFAULT_MAX_DEPTH = 6;
const REPORT_FILE = "a11y-report.json";
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-test"
]);

export async function collectDashboardData(
  reportsRoot: string,
  options: DashboardOptions = {}
): Promise<DashboardData> {
  const rootDir = path.resolve(reportsRoot);
  const reportPaths = await findReportFiles(rootDir, positiveOrDefault(options.maxDepth, DEFAULT_MAX_DEPTH));
  const files = await readReports(rootDir, reportPaths);
  const runs = files
    .map((file) => toDashboardRun(file))
    .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));

  return {
    generatedAt: new Date().toISOString(),
    reportsRoot: path.basename(rootDir) || ".",
    totalRuns: runs.length,
    latestRun: runs.at(-1),
    latestDelta: summarizeLatestDelta(runs),
    regressions: summarizeRegressions(files),
    runs,
    trend: runs.map(({ framework: _framework, urls: _urls, ...point }) => point),
    topRules: summarizeRules(files),
    topPages: summarizePages(files),
    latestRecommendations: summarizeLatestRecommendations(files),
    lighthouse: summarizeLighthouse(files)
  };
}

export function renderDashboardHtml(data: DashboardData): string {
  const latest = data.latestRun;
  const maxTrend = Math.max(1, ...data.trend.map((point) => point.total));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>a11y-shiftleft dashboard</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fb;
      --panel: #ffffff;
      --text: #18212f;
      --muted: #5a667a;
      --line: #d7dde8;
      --critical: #b42318;
      --warning: #b54708;
      --info: #175cd3;
      --accent: #0f766e;
      --good: #067647;
      --bad: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }
    header {
      display: grid;
      gap: 4px;
      margin-bottom: 20px;
    }
    h1, h2 {
      margin: 0;
      line-height: 1.2;
    }
    h1 { font-size: 28px; }
    h2 { font-size: 17px; }
    .muted { color: var(--muted); }
    .grid {
      display: grid;
      gap: 14px;
    }
    .metrics {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      margin-bottom: 16px;
    }
    .metric, section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .metric {
      padding: 14px;
    }
    .metric strong {
      display: block;
      font-size: 24px;
      line-height: 1.1;
    }
    section {
      padding: 16px;
      margin-top: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 8px;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    th {
      color: var(--muted);
      font-weight: 650;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .critical { color: var(--critical); }
    .warning { color: var(--warning); }
    .info { color: var(--info); }
    .delta-good { color: var(--good); }
    .delta-bad { color: var(--bad); }
    .delta-flat { color: var(--muted); }
    .regression-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      margin-top: 12px;
    }
    .pages-table, .runs-table { table-layout: fixed; font-size: 12px; }
    .pages-table th:first-child, .pages-table td:first-child { width: 46%; }
    .runs-table th:first-child, .runs-table td:first-child { width: 9%; }
    .runs-table th:nth-child(2), .runs-table td:nth-child(2) { width: 16%; }
    .runs-table th:nth-child(7), .runs-table td:nth-child(7) { width: 10%; }
    .runs-table th:nth-child(8), .runs-table td:nth-child(8) { width: 21%; }
    .bars {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(120px, 220px) 1fr auto;
      gap: 10px;
      align-items: center;
    }
    .track {
      height: 12px;
      background: #e7ecf4;
      border-radius: 999px;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      background: var(--accent);
    }
    .fill-score {
      background: var(--info);
    }
    .trend-groups {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
    code {
      background: #eef2f7;
      border-radius: 4px;
      padding: 2px 4px;
    }
    pre {
      margin: 8px 0;
      padding: 10px;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      background: #eef2f7;
      border-radius: 4px;
    }
    @media (max-width: 720px) {
      .bar-row { grid-template-columns: 1fr; }
      .num { text-align: left; }
      th:nth-child(n+3), td:nth-child(n+3) { display: none; }
    }
    @media print {
      .pages-table, .runs-table { font-size: 10px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>a11y-shiftleft dashboard</h1>
      <div class="muted">Generated: <time datetime="${escapeHtml(data.generatedAt)}">${escapeHtml(formatReportDateUtc(data.generatedAt))}</time> from <code>${escapeHtml(data.reportsRoot)}</code></div>
    </header>

    <div class="grid metrics" aria-label="Dashboard summary metrics">
      <div class="metric"><span class="muted">Runs indexed</span><strong>${data.totalRuns}</strong></div>
      <div class="metric"><span class="muted">Latest findings</span><strong>${latest?.total ?? 0}</strong></div>
      <div class="metric"><span class="muted">Latest critical</span><strong class="critical">${latest?.critical ?? 0}</strong></div>
      <div class="metric"><span class="muted">Latest warnings</span><strong class="warning">${latest?.warning ?? 0}</strong></div>
      <div class="metric"><span class="muted">Change from previous</span><strong class="${deltaClass(data.latestDelta?.total.change ?? null, "lower")}">${formatDelta(data.latestDelta?.total.change ?? null)}</strong></div>
      <div class="metric"><span class="muted">Latest Lighthouse</span><strong>${latest?.lighthouseScore ?? "n/a"}</strong></div>
    </div>

    ${data.totalRuns === 0 ? emptyState() : [
    latestDeltaSection(data.latestDelta),
    regressionsSection(data.regressions),
    trendSection(data, maxTrend),
    lighthouseSection(data.lighthouse),
    rulesSection(data.topRules),
    pagesSection(data.topPages),
    recommendationsSection(data.latestRecommendations),
    runsSection(data.runs)
  ].join("\n")}
  </main>
</body>
</html>`;
}

async function findReportFiles(rootDir: string, maxDepth: number): Promise<string[]> {
  const files: string[] = [];

  async function visit(dir: string, depth: number): Promise<void> {
    let entries: Array<import("node:fs").Dirent>;

    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);

      if (entry.isFile() && entry.name === REPORT_FILE) {
        files.push(absolutePath);
        continue;
      }

      if (!entry.isDirectory() || depth >= maxDepth || IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      await visit(absolutePath, depth + 1);
    }
  }

  await visit(rootDir, 0);
  return files.sort();
}

async function readReports(rootDir: string, reportPaths: string[]): Promise<ReportFile[]> {
  const reports: ReportFile[] = [];

  for (const absolutePath of reportPaths) {
    const raw = await fs.readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isA11yReport(parsed)) continue;

    reports.push({
      absolutePath,
      relativePath: normalizePath(path.relative(rootDir, absolutePath)),
      report: parsed
    });
  }

  return reports;
}

function toDashboardRun(file: ReportFile): DashboardRunSummary {
  const summary = file.report.summary;

  return {
    id: runIdFromPath(file.relativePath),
    generatedAt: file.report.generatedAt,
    reportPath: file.relativePath,
    total: summary.total,
    critical: summary.critical,
    warning: summary.warning,
    info: summary.info,
    duplicateRate: summary.duplicateRate,
    scanDurationMs: summary.scanDurationMs,
    lighthouseScore: summary.lighthouse?.averageAccessibilityScore ?? undefined,
    framework: String(summary.framework || "unknown"),
    urls: summary.urls || []
  };
}

function summarizeLatestDelta(runs: DashboardRunSummary[]): DashboardLatestDelta | undefined {
  if (runs.length < 2) return undefined;
  const previous = runs.at(-2);
  const latest = runs.at(-1);
  if (!previous || !latest) return undefined;

  return {
    previousRunId: previous.id,
    latestRunId: latest.id,
    total: deltaMetric(previous.total, latest.total),
    critical: deltaMetric(previous.critical, latest.critical),
    warning: deltaMetric(previous.warning, latest.warning),
    info: deltaMetric(previous.info, latest.info),
    lighthouseScore: deltaMetric(nullableNumber(previous.lighthouseScore), nullableNumber(latest.lighthouseScore))
  };
}

function deltaMetric(previous: number | null | undefined, latest: number | null | undefined): DashboardDeltaMetric {
  const previousValue = nullableNumber(previous);
  const latestValue = nullableNumber(latest);
  return {
    previous: previousValue,
    latest: latestValue,
    change: previousValue === null || latestValue === null ? null : latestValue - previousValue
  };
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function summarizeRegressions(files: ReportFile[]): DashboardRegressionSummary | undefined {
  const sorted = [...files].sort((a, b) => a.report.generatedAt.localeCompare(b.report.generatedAt));
  if (sorted.length < 2) return undefined;
  const previous = sorted.at(-2);
  const latest = sorted.at(-1);
  if (!previous || !latest) return undefined;

  return {
    previousRunId: runIdFromPath(previous.relativePath),
    latestRunId: runIdFromPath(latest.relativePath),
    rules: compareCounts(countLatestRules(previous.report), countLatestRules(latest.report)).slice(0, 8),
    pages: compareCounts(countLatestPages(previous.report), countLatestPages(latest.report)).slice(0, 8)
  };
}

function countLatestRules(report: A11yReport): Map<string, number> {
  const counts = new Map<string, number>();

  for (const issue of report.issues || []) {
    const ruleId = issue.ruleId || "unknown";
    counts.set(ruleId, (counts.get(ruleId) || 0) + 1 + (issue.duplicateCount || 0));
  }

  return counts;
}

function countLatestPages(report: A11yReport): Map<string, number> {
  const counts = new Map<string, number>();

  for (const page of report.summary.byPage || []) {
    counts.set(page.url, page.total);
  }

  return counts;
}

function compareCounts(previous: Map<string, number>, latest: Map<string, number>): DashboardRegressionItem[] {
  const items: DashboardRegressionItem[] = [];

  for (const [id, latestCount] of latest) {
    const previousCount = previous.get(id) || 0;
    const change = latestCount - previousCount;
    if (change <= 0) continue;
    items.push({
      id,
      previous: previousCount,
      latest: latestCount,
      change
    });
  }

  return items.sort((left, right) => {
    if (right.change !== left.change) return right.change - left.change;
    if (right.latest !== left.latest) return right.latest - left.latest;
    return left.id.localeCompare(right.id);
  });
}

function summarizeRules(files: ReportFile[]): DashboardRuleSummary[] {
  const rules = new Map<string, DashboardRuleSummary>();

  for (const file of files) {
    for (const issue of file.report.issues || []) {
      const ruleId = issue.ruleId || "unknown";
      const severity = issue.severity || "info";
      const current = rules.get(ruleId) || {
        ruleId,
        total: 0,
        critical: 0,
        warning: 0,
        info: 0
      };

      current.total += 1;
      current[severity] += 1;
      rules.set(ruleId, current);
    }
  }

  return [...rules.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

function summarizePages(files: ReportFile[]): DashboardPageSummary[] {
  const pages = new Map<string, DashboardPageSummary>();

  for (const file of files) {
    for (const page of file.report.summary.byPage || []) {
      const current = pages.get(page.url) || {
        url: page.url,
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        severityScore: 0,
        runs: 0
      };

      current.total += page.total;
      current.critical += page.critical;
      current.warning += page.warning;
      current.info += page.info;
      current.severityScore += page.severityScore;
      current.runs += 1;
      pages.set(page.url, current);
    }
  }

  return [...pages.values()].sort((a, b) => {
    if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
    if (b.total !== a.total) return b.total - a.total;
    return a.url.localeCompare(b.url);
  });
}

function summarizeLatestRecommendations(files: ReportFile[]): DashboardRecommendation[] {
  const latest = [...files]
    .sort((a, b) => a.report.generatedAt.localeCompare(b.report.generatedAt))
    .at(-1);
  const recommendations = new Map<string, DashboardRecommendation>();

  for (const issue of latest?.report.issues || []) {
    const ruleId = issue.ruleId || "unknown";
    const current = recommendations.get(ruleId);

    if (current) {
      current.occurrences += 1 + (issue.duplicateCount || 0);
      if (severityRank(issue.severity) > severityRank(current.severity)) {
        current.severity = issue.severity;
      }
      continue;
    }

    recommendations.set(ruleId, {
      ruleId,
      severity: issue.severity,
      message: issue.message,
      page: issue.url || issue.file || "unknown",
      target: issue.selector || issue.file || "unknown",
      occurrences: 1 + (issue.duplicateCount || 0),
      remediation: issue.remediation || getRemediationHint(
        ruleId,
        issue.wcagCriteria,
        issue.framework,
        { helpUrl: issue.helpUrl }
      )
    });
  }

  return [...recommendations.values()].sort((a, b) => {
    if (severityRank(b.severity) !== severityRank(a.severity)) {
      return severityRank(b.severity) - severityRank(a.severity);
    }
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

function summarizeLighthouse(files: ReportFile[]): DashboardLighthouseSummary | undefined {
  const runs = files
    .map((file) => file.report.summary.lighthouse)
    .filter((lighthouse): lighthouse is NonNullable<A11yReport["summary"]["lighthouse"]> => Boolean(lighthouse?.enabled));
  if (runs.length === 0) return undefined;

  const scores = runs
    .map((run) => run.averageAccessibilityScore)
    .filter((score): score is number => typeof score === "number");
  const topFailedAudits = new Map<string, DashboardLighthouseAuditSummary>();

  for (const file of files) {
    for (const result of file.report.lighthouse || []) {
      for (const audit of result.failedAudits) {
        const current = topFailedAudits.get(audit.id) || {
          id: audit.id,
          title: audit.title,
          count: 0
        };
        current.count += 1;
        topFailedAudits.set(audit.id, current);
      }
    }
  }

  return {
    runsWithLighthouse: runs.length,
    latestScore: runs.at(-1)?.averageAccessibilityScore ?? null,
    averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    failedAuditCount: runs.reduce((total, run) => total + run.failedAuditCount, 0),
    manualAuditCount: runs.reduce((total, run) => total + run.manualAuditCount, 0),
    lighthouseOnlyCount: runs.reduce((total, run) => total + (run.comparison?.lighthouseOnlyAudits.length || 0), 0),
    pipelineOnlyCount: runs.reduce((total, run) => total + (run.comparison?.pipelineOnlyRules.length || 0), 0),
    topFailedAudits: [...topFailedAudits.values()].sort((left, right) => right.count - left.count || left.id.localeCompare(right.id)).slice(0, 10)
  };
}

function latestDeltaSection(delta: DashboardLatestDelta | undefined): string {
  if (!delta) return `<section>
    <h2>Latest Change</h2>
    <p class="muted">Save at least two report runs to compare the latest audit with the previous one.</p>
  </section>`;

  return `<section>
    <h2 id="latest-change-heading">Latest Change</h2>
    <p class="muted">Comparison from <code>${escapeHtml(delta.previousRunId)}</code> to <code>${escapeHtml(delta.latestRunId)}</code>. Negative finding changes are improvements; positive Lighthouse score changes are improvements.</p>
    <table aria-labelledby="latest-change-heading">
      <thead><tr><th scope="col">Metric</th><th scope="col" class="num">Previous</th><th scope="col" class="num">Latest</th><th scope="col" class="num">Change</th></tr></thead>
      <tbody>
        ${deltaRow("Total findings", delta.total, "lower")}
        ${deltaRow("Critical", delta.critical, "lower")}
        ${deltaRow("Warnings", delta.warning, "lower")}
        ${deltaRow("Info", delta.info, "lower")}
        ${deltaRow("Lighthouse score", delta.lighthouseScore, "higher")}
      </tbody>
    </table>
  </section>`;
}

function deltaRow(label: string, metric: DashboardDeltaMetric, direction: "lower" | "higher"): string {
  return `<tr>
    <td>${escapeHtml(label)}</td>
    <td class="num">${formatNullableNumber(metric.previous)}</td>
    <td class="num">${formatNullableNumber(metric.latest)}</td>
    <td class="num ${deltaClass(metric.change, direction)}">${formatDelta(metric.change)}</td>
  </tr>`;
}

function regressionsSection(regressions: DashboardRegressionSummary | undefined): string {
  if (!regressions) return `<section>
    <h2>New Or Worse Problems</h2>
    <p class="muted">Save at least two report runs to detect rule and page regressions.</p>
  </section>`;

  const hasRegressions = regressions.rules.length > 0 || regressions.pages.length > 0;

  return `<section>
    <h2>New Or Worse Problems</h2>
    <p class="muted">Items that increased from <code>${escapeHtml(regressions.previousRunId)}</code> to <code>${escapeHtml(regressions.latestRunId)}</code>. Use this to spot new issues introduced by recent work.</p>
    ${hasRegressions
      ? `<div class="regression-grid">
        ${regressionTable("Rules", "Rule", regressions.rules)}
        ${regressionTable("Pages", "Page", regressions.pages)}
      </div>`
      : "<p class=\"muted\">No rule or page regressions found in the latest report.</p>"}
  </section>`;
}

function regressionTable(title: string, idLabel: string, items: DashboardRegressionItem[]): string {
  const rows = items.map((item) => `<tr>
    <td><code>${escapeHtml(item.id)}</code></td>
    <td class="num">${item.previous}</td>
    <td class="num">${item.latest}</td>
    <td class="num delta-bad">+${item.change}</td>
  </tr>`).join("\n");

  return `<div>
    <h3>${escapeHtml(title)}</h3>
    <table>
      <thead><tr><th scope="col">${escapeHtml(idLabel)}</th><th scope="col" class="num">Previous</th><th scope="col" class="num">Latest</th><th scope="col" class="num">Change</th></tr></thead>
      <tbody>${rows || "<tr><td colspan=\"4\">No regressions.</td></tr>"}</tbody>
    </table>
  </div>`;
}

function trendSection(data: DashboardData, maxTrend: number): string {
  const bars = data.trend
    .map((point) => {
      const width = Math.max(2, Math.round((point.total / maxTrend) * 100));
      return `<div class="bar-row">
        <div><code>${escapeHtml(point.id)}</code><div class="muted">${escapeHtml(formatReportDateUtc(point.generatedAt))}</div></div>
        <div class="track" aria-hidden="true"><div class="fill" style="width: ${width}%"></div></div>
        <div class="num">${point.total}</div>
      </div>`;
    })
    .join("\n");
  const scorePoints = data.trend.filter((point) => typeof point.lighthouseScore === "number");
  const scoreBars = scorePoints
    .map((point) => {
      const score = point.lighthouseScore ?? 0;
      const width = Math.max(2, Math.min(100, Math.round(score)));
      return `<div class="bar-row">
        <div><code>${escapeHtml(point.id)}</code><div class="muted">${escapeHtml(formatReportDateUtc(point.generatedAt))}</div></div>
        <div class="track" aria-hidden="true"><div class="fill fill-score" style="width: ${width}%"></div></div>
        <div class="num">${score}</div>
      </div>`;
    })
    .join("\n");

  return `<section>
    <h2>Accessibility Trend</h2>
    <div class="muted">Total findings per report run. Lower findings are better; Lighthouse score is shown when reports were created with <code>--with-lighthouse</code>.</div>
    <div class="trend-groups">
      <div>
        <h3>Findings</h3>
        <div class="bars">${bars}</div>
      </div>
      <div>
        <h3>Lighthouse Score</h3>
        <div class="bars">${scoreBars || "<p class=\"muted\">No Lighthouse scores in indexed reports.</p>"}</div>
      </div>
    </div>
  </section>`;
}

function deltaClass(delta: number | null, direction: "lower" | "higher"): string {
  if (delta === null || delta === 0) return "delta-flat";
  const improved = direction === "lower" ? delta < 0 : delta > 0;
  return improved ? "delta-good" : "delta-bad";
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "n/a";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function lighthouseSection(lighthouse: DashboardLighthouseSummary | undefined): string {
  if (!lighthouse) return "";
  const rows = lighthouse.topFailedAudits
    .map((audit) => `<tr>
      <td><code>${escapeHtml(audit.id)}</code></td>
      <td>${escapeHtml(audit.title)}</td>
      <td class="num">${audit.count}</td>
    </tr>`)
    .join("\n");

  return `<section>
    <h2 id="lighthouse-heading">Lighthouse Comparison</h2>
    <p class="muted">Optional score-oriented evidence from runs that used <code>--with-lighthouse</code>. Treat this as comparison data, not conformance proof.</p>
    <div class="grid metrics" aria-label="Lighthouse summary metrics">
      <div class="metric"><span class="muted">Runs with Lighthouse</span><strong>${lighthouse.runsWithLighthouse}</strong></div>
      <div class="metric"><span class="muted">Latest score</span><strong>${lighthouse.latestScore ?? "n/a"}</strong></div>
      <div class="metric"><span class="muted">Average score</span><strong>${lighthouse.averageScore ?? "n/a"}</strong></div>
      <div class="metric"><span class="muted">Failed audits</span><strong class="warning">${lighthouse.failedAuditCount}</strong></div>
      <div class="metric"><span class="muted">Manual audits</span><strong>${lighthouse.manualAuditCount}</strong></div>
      <div class="metric"><span class="muted">Tool differences</span><strong>${lighthouse.lighthouseOnlyCount + lighthouse.pipelineOnlyCount}</strong></div>
    </div>
    <table aria-labelledby="lighthouse-heading">
      <thead><tr><th scope="col">Failed audit</th><th scope="col">Title</th><th scope="col" class="num">Runs</th></tr></thead>
      <tbody>${rows || "<tr><td colspan=\"3\">No failed Lighthouse audits.</td></tr>"}</tbody>
    </table>
  </section>`;
}

function rulesSection(rules: DashboardRuleSummary[]): string {
  const rows = rules.slice(0, 10)
    .map((rule) => `<tr>
      <td><code>${escapeHtml(rule.ruleId)}</code></td>
      <td class="num">${rule.total}</td>
      <td class="num critical">${rule.critical}</td>
      <td class="num warning">${rule.warning}</td>
      <td class="num info">${rule.info}</td>
    </tr>`)
    .join("\n");

  return `<section>
    <h2 id="top-rules-heading">Top Rules</h2>
    <table aria-labelledby="top-rules-heading">
      <thead><tr><th scope="col">Rule</th><th scope="col" class="num">Total</th><th scope="col" class="num">Critical</th><th scope="col" class="num">Warning</th><th scope="col" class="num">Info</th></tr></thead>
      <tbody>${rows || "<tr><td colspan=\"5\">No rule findings.</td></tr>"}</tbody>
    </table>
  </section>`;
}

function pagesSection(pages: DashboardPageSummary[]): string {
  const rows = pages.slice(0, 10)
    .map((page) => `<tr>
      <td>${escapeHtml(page.url)}</td>
      <td class="num">${page.total}</td>
      <td class="num critical">${page.critical}</td>
      <td class="num warning">${page.warning}</td>
      <td class="num info">${page.info}</td>
      <td class="num">${page.severityScore}</td>
      <td class="num">${page.runs}</td>
    </tr>`)
    .join("\n");

  return `<section>
    <h2 id="affected-pages-heading">Most Affected Pages</h2>
    <table class="pages-table" aria-labelledby="affected-pages-heading">
      <thead><tr><th scope="col">URL</th><th scope="col" class="num">Total</th><th scope="col" class="num">Critical</th><th scope="col" class="num">Warning</th><th scope="col" class="num">Info</th><th scope="col" class="num">Score</th><th scope="col" class="num">Runs</th></tr></thead>
      <tbody>${rows || "<tr><td colspan=\"7\">No page-level evidence.</td></tr>"}</tbody>
    </table>
  </section>`;
}

function recommendationsSection(recommendations: DashboardRecommendation[]): string {
  const items = recommendations.slice(0, 10).map((recommendation) => {
    const steps = recommendation.remediation.howToFix
      .map((step) => `<li>${escapeHtml(step)}</li>`)
      .join("");
    const docs = recommendation.remediation.docs[0]
      ? `<a href="${escapeHtml(recommendation.remediation.docs[0])}">Guidance</a>`
      : "";
    const frameworkExample = Object.entries(recommendation.remediation.frameworkExamples || {})[0];
    const example = frameworkExample
      ? `<p><strong>${escapeHtml(frameworkExample[0])} example:</strong></p><pre><code>${escapeHtml(frameworkExample[1])}</code></pre>`
      : "";

    return `<li>
      <h3><code>${escapeHtml(recommendation.ruleId)}</code> <span class="${recommendation.severity}">${escapeHtml(recommendation.severity)}</span></h3>
      <p>${escapeHtml(recommendation.message)}</p>
      <p><strong>Suggested fix:</strong> ${escapeHtml(recommendation.remediation.summary)}</p>
      <ol>${steps}</ol>
      ${example}
      <p class="muted">${recommendation.occurrences} occurrence(s) in the latest run; example target <code>${escapeHtml(recommendation.target)}</code> on ${escapeHtml(recommendation.page)}. ${docs}</p>
    </li>`;
  }).join("\n");

  return `<section>
    <h2>Latest Fix Recommendations</h2>
    <p class="muted">Grouped by rule from the latest report. JSON and findings CSV retain every individual occurrence.</p>
    <ol>${items || "<li>No recommendations because the latest run has no findings.</li>"}</ol>
  </section>`;
}

function runsSection(runs: DashboardRunSummary[]): string {
  const rows = [...runs].reverse().slice(0, 20)
    .map((run) => `<tr>
      <td><code>${escapeHtml(run.id)}</code></td>
      <td>${escapeHtml(formatReportDateUtc(run.generatedAt))}</td>
      <td class="num">${run.total}</td>
      <td class="num critical">${run.critical}</td>
      <td class="num warning">${run.warning}</td>
      <td class="num info">${run.info}</td>
      <td>${escapeHtml(run.framework)}</td>
      <td><code>${escapeHtml(run.reportPath)}</code></td>
    </tr>`)
    .join("\n");

  return `<section>
    <h2 id="recent-runs-heading">Recent Runs</h2>
    <table class="runs-table" aria-labelledby="recent-runs-heading">
      <thead><tr><th scope="col">Run</th><th scope="col">Generated</th><th scope="col" class="num">Total</th><th scope="col" class="num">Critical</th><th scope="col" class="num">Warning</th><th scope="col" class="num">Info</th><th scope="col">Framework</th><th scope="col">Report</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function emptyState(): string {
  return `<section>
    <h2>No Reports Found</h2>
    <p class="muted">Run <code>a11y-shiftleft check --out reports</code> or <code>a11y-shiftleft explore --out reports</code>, then open the dashboard again.</p>
  </section>`;
}

function runIdFromPath(reportPath: string): string {
  const dir = path.dirname(reportPath);
  if (dir === ".") return "root";
  return normalizePath(dir);
}

function isA11yReport(value: unknown): value is A11yReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<A11yReport>;
  return typeof report.generatedAt === "string" &&
    Boolean(report.summary) &&
    Array.isArray(report.issues);
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function severityRank(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}
