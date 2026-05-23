import fs from "node:fs/promises";
import path from "node:path";

export async function writeReports(outputDir, issues, metrics = {}) {
  await fs.mkdir(outputDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    summary: summarize(issues, metrics),
    issues
  };

  await fs.writeFile(
    path.join(outputDir, "a11y-report.json"),
    JSON.stringify(report, null, 2)
  );

  await fs.writeFile(
    path.join(outputDir, "a11y-metrics.csv"),
    toCsv(report.summary)
  );

  await fs.writeFile(
    path.join(outputDir, "a11y-comment.md"),
    toMarkdown(report)
  );

  return report;
}

function summarize(issues, metrics) {
  return {
    total: issues.length,
    critical: issues.filter((issue) => issue.severity === "critical").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
    rawCount: metrics.rawCount || issues.length,
    uniqueCount: metrics.uniqueCount || issues.length,
    duplicateCount: metrics.duplicateCount || 0
  };
}

function toCsv(summary) {
  return [
    "metric,value",
    ...Object.entries(summary).map(([key, value]) => `${key},${value}`)
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

${topIssues || "No accessibility findings detected."}
`;
}
