import fs from "node:fs/promises";
import path from "node:path";
import type { A11yReport } from "../types.js";

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

export interface DashboardData {
  generatedAt: string;
  reportsRoot: string;
  totalRuns: number;
  latestRun?: DashboardRunSummary;
  runs: DashboardRunSummary[];
  trend: DashboardTrendPoint[];
  topRules: DashboardRuleSummary[];
  topPages: DashboardPageSummary[];
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
    runs,
    trend: runs.map(({ framework: _framework, urls: _urls, ...point }) => point),
    topRules: summarizeRules(files),
    topPages: summarizePages(files)
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
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-weight: 650;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .critical { color: var(--critical); }
    .warning { color: var(--warning); }
    .info { color: var(--info); }
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
    code {
      background: #eef2f7;
      border-radius: 4px;
      padding: 2px 4px;
    }
    @media (max-width: 720px) {
      .bar-row { grid-template-columns: 1fr; }
      .num { text-align: left; }
      th:nth-child(n+3), td:nth-child(n+3) { display: none; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>a11y-shiftleft dashboard</h1>
      <div class="muted">Generated ${escapeHtml(formatDate(data.generatedAt))} from <code>${escapeHtml(data.reportsRoot)}</code></div>
    </header>

    <div class="grid metrics" aria-label="Dashboard summary metrics">
      <div class="metric"><span class="muted">Runs indexed</span><strong>${data.totalRuns}</strong></div>
      <div class="metric"><span class="muted">Latest findings</span><strong>${latest?.total ?? 0}</strong></div>
      <div class="metric"><span class="muted">Latest critical</span><strong class="critical">${latest?.critical ?? 0}</strong></div>
      <div class="metric"><span class="muted">Latest warnings</span><strong class="warning">${latest?.warning ?? 0}</strong></div>
    </div>

    ${data.totalRuns === 0 ? emptyState() : [
    trendSection(data, maxTrend),
    rulesSection(data.topRules),
    pagesSection(data.topPages),
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
    framework: String(summary.framework || "unknown"),
    urls: summary.urls || []
  };
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

function trendSection(data: DashboardData, maxTrend: number): string {
  const bars = data.trend
    .map((point) => {
      const width = Math.max(2, Math.round((point.total / maxTrend) * 100));
      return `<div class="bar-row">
        <div><code>${escapeHtml(point.id)}</code><div class="muted">${escapeHtml(formatDate(point.generatedAt))}</div></div>
        <div class="track" aria-hidden="true"><div class="fill" style="width: ${width}%"></div></div>
        <div class="num">${point.total}</div>
      </div>`;
    })
    .join("\n");

  return `<section>
    <h2>Accessibility Trend</h2>
    <div class="muted">Total findings per report run.</div>
    <div class="bars">${bars}</div>
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
    <h2>Top Rules</h2>
    <table>
      <thead><tr><th>Rule</th><th class="num">Total</th><th class="num">Critical</th><th class="num">Warning</th><th class="num">Info</th></tr></thead>
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
    <h2>Most Affected Pages</h2>
    <table>
      <thead><tr><th>URL</th><th class="num">Total</th><th class="num">Critical</th><th class="num">Warning</th><th class="num">Info</th><th class="num">Score</th><th class="num">Runs</th></tr></thead>
      <tbody>${rows || "<tr><td colspan=\"7\">No page-level evidence.</td></tr>"}</tbody>
    </table>
  </section>`;
}

function runsSection(runs: DashboardRunSummary[]): string {
  const rows = [...runs].reverse().slice(0, 20)
    .map((run) => `<tr>
      <td><code>${escapeHtml(run.id)}</code></td>
      <td>${escapeHtml(formatDate(run.generatedAt))}</td>
      <td class="num">${run.total}</td>
      <td class="num critical">${run.critical}</td>
      <td class="num warning">${run.warning}</td>
      <td class="num info">${run.info}</td>
      <td>${escapeHtml(run.framework)}</td>
      <td><code>${escapeHtml(run.reportPath)}</code></td>
    </tr>`)
    .join("\n");

  return `<section>
    <h2>Recent Runs</h2>
    <table>
      <thead><tr><th>Run</th><th>Generated</th><th class="num">Total</th><th class="num">Critical</th><th class="num">Warning</th><th class="num">Info</th><th>Framework</th><th>Report</th></tr></thead>
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
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
