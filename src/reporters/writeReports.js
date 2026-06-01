import fs from "node:fs/promises";
import path from "node:path";

export async function writeReports(outputDir, issues, metrics = {}, options = {}) {
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

  return report;
}

function summarize(issues, metrics) {
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
    bySeverity: countBy(issues, "severity")
  };
}

function toCsv(summary) {
  return [
    "metric,value",
    ...flattenSummary(summary).map(([key, value]) => `${key},${formatCsvValue(value)}`)
  ].join("\n");
}

function toMarkdown(report) {
  const topIssues = report.issues
    .slice(0, 10)
    .map((issue) => `- **${issue.severity}** \`${issue.ruleId}\` ${issue.file || issue.selector || ""}: ${issue.message}`)
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

${topIssues || "No accessibility findings detected."}
`;
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function flattenSummary(summary) {
  const rows = [];

  for (const [key, value] of Object.entries(summary)) {
    if (Array.isArray(value)) {
      rows.push([key, value.join("|")]);
      continue;
    }

    if (value && typeof value === "object") {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        rows.push([`${key}.${nestedKey}`, nestedValue]);
      }
      continue;
    }

    rows.push([key, value]);
  }

  return rows;
}

function formatCsvValue(value) {
  const stringValue = String(value);

  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll("\"", "\"\"")}"`;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
