import fs from "node:fs/promises";
import path from "node:path";
import { createManualChecklist, toManualChecklistMarkdown } from "../core/manualChecklist.js";
import type { A11yReport, DedupedIssue, ReportFormat, ReportMetrics, ReportSummary } from "../types.js";

interface WriteReportOptions {
  formats?: ReportFormat[];
  semiAuto?: boolean;
}

type SummaryValue = string | number | string[] | Record<string, number>;

export async function writeReports(
  outputDir: string,
  issues: DedupedIssue[],
  metrics: ReportMetrics = {},
  options: WriteReportOptions = {}
): Promise<A11yReport> {
  await fs.mkdir(outputDir, { recursive: true });
  const formats = new Set(options.formats || ["json", "csv", "markdown"]);

  const report = {
    generatedAt: new Date().toISOString(),
    summary: summarize(issues, metrics),
    issues
  };

  if (formats.has("json")) {
    await fs.writeFile(
      path.join(outputDir, "a11y-report.json"),
      JSON.stringify(report, null, 2)
    );
  }

  if (formats.has("csv")) {
    await fs.writeFile(
      path.join(outputDir, "a11y-metrics.csv"),
      toCsv(report.summary)
    );
  }

  if (formats.has("markdown")) {
    await fs.writeFile(
      path.join(outputDir, "a11y-comment.md"),
      toMarkdown(report)
    );
  }

  if (options.semiAuto) {
    const checklist = createManualChecklist({
      framework: report.summary.framework,
      urls: report.summary.urls,
      issues
    });

    await fs.writeFile(
      path.join(outputDir, "a11y-manual-checklist.md"),
      toManualChecklistMarkdown(checklist)
    );
  }

  return report;
}

function summarize(issues: DedupedIssue[], metrics: ReportMetrics): ReportSummary {
  const rawCount = metrics.rawCount || issues.length;
  const duplicateCount = metrics.duplicateCount || 0;

  return {
    total: issues.length,
    critical: issues.filter((issue) => issue.severity === "critical").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
    rawCount,
    uniqueCount: metrics.uniqueCount || issues.length,
    duplicateCount,
    duplicateRate: rawCount > 0 ? round(duplicateCount / rawCount) : 0,
    scanDurationMs: metrics.scanDurationMs || 0,
    framework: metrics.framework || "unknown",
    urls: metrics.urls || [],
    bySource: countBy(issues, "source"),
    bySeverity: countBy(issues, "severity"),
    byPour: countByPour(issues),
    byWcagLevel: countByWcagLevel(issues)
  };
}

function toCsv(summary: ReportSummary): string {
  return [
    "metric,value",
    ...flattenSummary(summary).map(([key, value]) => `${key},${formatCsvValue(value)}`)
  ].join("\n");
}

export function toMarkdown(report: A11yReport): string {
  const topIssues = report.issues
    .slice(0, 10)
    .map((issue) => {
      const criteria = formatCriteria(issue);
      return `- **${issue.severity}** \`${issue.ruleId}\`${criteria} ${issue.file || issue.selector || ""}: ${issue.message}`;
    })
    .join("\n");

  return `## Accessibility Shift-Left Report

| Metric | Value |
|---|---:|
| Total | ${report.summary.total} |
| Critical | ${report.summary.critical} |
| Warning | ${report.summary.warning} |
| Info | ${report.summary.info} |
| Raw findings | ${report.summary.rawCount} |
| Duplicates removed | ${report.summary.duplicateCount} |
| Duplicate rate | ${report.summary.duplicateRate} |
| Scan duration | ${report.summary.scanDurationMs}ms |
| Framework | ${report.summary.framework} |
| POUR | ${formatCountMap(report.summary.byPour)} |
| WCAG levels | ${formatCountMap(report.summary.byWcagLevel)} |

${topIssues || "No accessibility findings detected."}
`;
}

function countBy(items: DedupedIssue[], field: "source" | "severity"): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function countByPour(items: DedupedIssue[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    for (const criterion of item.wcagCriteria) {
      acc[criterion.principle] = (acc[criterion.principle] || 0) + 1;
    }
    return acc;
  }, {});
}

function countByWcagLevel(items: DedupedIssue[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    for (const criterion of item.wcagCriteria) {
      acc[criterion.level] = (acc[criterion.level] || 0) + 1;
    }
    return acc;
  }, {});
}

function formatCriteria(issue: DedupedIssue): string {
  if (!issue.wcagCriteria || issue.wcagCriteria.length === 0) return "";

  return ` [${issue.wcagCriteria.map((criterion) => `WCAG ${criterion.id} ${criterion.title}, Level ${criterion.level}`).join("; ")}]`;
}

function formatCountMap(counts: Record<string, number> | undefined): string {
  if (!counts) return "none";

  const entries = Object.entries(counts);
  if (entries.length === 0) return "none";

  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

function flattenSummary(summary: ReportSummary): [string, SummaryValue][] {
  const rows: [string, SummaryValue][] = [];

  for (const [key, value] of Object.entries(summary)) {
    if (Array.isArray(value)) {
      rows.push([key, value.join("|")]);
      continue;
    }

    if (value && typeof value === "object") {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        rows.push([`${key}.${nestedKey}`, nestedValue as SummaryValue]);
      }
      continue;
    }

    rows.push([key, value]);
  }

  return rows;
}

function formatCsvValue(value: SummaryValue): string {
  const stringValue = String(value);

  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll("\"", "\"\"")}"`;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
