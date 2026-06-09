import fs from "node:fs/promises";
import path from "node:path";
import { createManualChecklist, toManualChecklistMarkdown } from "../core/manualChecklist.js";
import type { A11yReport, ComplianceEvidenceSummary, ComplianceStandardMetadata, DedupedIssue, PageSummary, ReportFormat, ReportMetrics, ReportSummary, Severity } from "../types.js";

interface WriteReportOptions {
  formats?: ReportFormat[];
  semiAuto?: boolean;
}

type SummaryValue = string | number | boolean | null | undefined;

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
  const byPage = summarizePages(issues);

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
    standard: metrics.standard,
    complianceEvidence: summarizeComplianceEvidence(issues, byPage, metrics.standard),
    bySource: countBy(issues, "source"),
    bySeverity: countBy(issues, "severity"),
    byPour: countByPour(issues),
    byWcagLevel: countByWcagLevel(issues),
    byWcagVersion: countByWcagVersion(issues),
    byUnmappedRule: countByUnmappedRule(issues),
    byPage
  };
}

function toCsv(summary: ReportSummary): string {
  return [
    "metric,value",
    ...flattenSummary(summary).map(([key, value]) => `${key},${formatCsvValue(value)}`)
  ].join("\n");
}

export function toMarkdown(report: A11yReport): string {
  const complianceEvidence = report.summary.complianceEvidence || summarizeComplianceEvidence(
    report.issues,
    report.summary.byPage || [],
    report.summary.standard
  );
  const topIssues = report.issues
    .slice(0, 10)
    .map((issue) => {
      const criteria = formatCriteria(issue);
      const remediation = formatRemediation(issue);
      const state = issue.stateLabel ? ` state: ${issue.stateLabel}` : "";
      const screenshot = issue.screenshot ? ` screenshot: ${issue.screenshot}` : "";
      return `- **${issue.severity}** \`${issue.ruleId}\`${criteria} ${issue.file || issue.selector || ""}${state}${screenshot}: ${issue.message}${remediation}`;
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
| Standard | ${formatStandard(report.summary.standard)} |
| Automated coverage | ${report.summary.standard?.automatedCoverage || "partial"} |
| Manual review required | ${complianceEvidence.requiresManualReview ? "yes" : "no"} |
| WCAG-mapped findings | ${complianceEvidence.wcagMappedFindings} |
| Unmapped findings | ${complianceEvidence.unmappedFindings} |
| Affected pages | ${complianceEvidence.affectedPages} |
| POUR | ${formatCountMap(report.summary.byPour)} |
| WCAG levels | ${formatCountMap(report.summary.byWcagLevel)} |
| WCAG versions | ${formatCountMap(report.summary.byWcagVersion)} |
| Rules without WCAG mapping | ${formatCountMap(report.summary.byUnmappedRule)} |

${formatPageSummary(report.summary.byPage || [])}

${formatComplianceEvidence(complianceEvidence)}

${topIssues || "No accessibility findings detected."}

${formatDisclaimer(report.summary.standard)}
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

function countByWcagVersion(items: DedupedIssue[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    for (const criterion of item.wcagCriteria) {
      acc[criterion.introducedIn] = (acc[criterion.introducedIn] || 0) + 1;
    }
    return acc;
  }, {});
}

function countByUnmappedRule(items: DedupedIssue[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    if (item.wcagCriteria.length > 0) return acc;

    acc[item.ruleId] = (acc[item.ruleId] || 0) + 1;
    return acc;
  }, {});
}

function summarizePages(items: DedupedIssue[]): PageSummary[] {
  const pages = new Map<string, PageSummary>();

  for (const item of items) {
    if (!item.url) continue;

    const page = pages.get(item.url) || {
      url: item.url,
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      severityScore: 0
    };

    page.total += 1;
    page[item.severity] += 1;
    page.severityScore += severityWeight(item.severity);
    pages.set(item.url, page);
  }

  return [...pages.values()].sort((a, b) => {
    if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
    if (b.total !== a.total) return b.total - a.total;
    return a.url.localeCompare(b.url);
  });
}

function summarizeComplianceEvidence(
  issues: DedupedIssue[],
  pages: PageSummary[],
  standard: ComplianceStandardMetadata | undefined
): ComplianceEvidenceSummary {
  const wcagMappedFindings = issues.filter((issue) => (issue.wcagCriteria || []).length > 0).length;

  return {
    standardId: standard?.id,
    wcagVersion: standard?.wcagVersion,
    wcagLevel: standard?.wcagLevel,
    automatedCoverage: "partial",
    requiresManualReview: true,
    totalFindings: issues.length,
    wcagMappedFindings,
    unmappedFindings: issues.length - wcagMappedFindings,
    affectedPages: pages.length,
    topAffectedPages: pages.slice(0, 3)
  };
}

function formatCriteria(issue: DedupedIssue): string {
  if (!issue.wcagCriteria || issue.wcagCriteria.length === 0) return "";

  return ` [${issue.wcagCriteria.map((criterion) => `WCAG ${criterion.id} ${criterion.title}, Level ${criterion.level}`).join("; ")}]`;
}

function formatRemediation(issue: DedupedIssue): string {
  if (!issue.remediation) return "";

  const docs = issue.remediation.docs
    .slice(0, 2)
    .map((url) => `<${url}>`)
    .join(", ");
  const example = formatFrameworkExample(issue);

  return [
    `\n  - Fix: ${issue.remediation.summary}`,
    docs ? `\n  - Docs: ${docs}` : "",
    example
  ].join("");
}

function formatFrameworkExample(issue: DedupedIssue): string {
  if (!issue.remediation?.frameworkExamples) return "";

  const entries = Object.entries(issue.remediation.frameworkExamples);
  if (entries.length === 0) return "";

  const [framework, example] = entries[0];
  return `\n  - ${framework} example: \`${example}\``;
}

function formatCountMap(counts: Record<string, number> | undefined): string {
  if (!counts) return "none";

  const entries = Object.entries(counts);
  if (entries.length === 0) return "none";

  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

function formatStandard(standard: ComplianceStandardMetadata | undefined): string {
  if (!standard) return "WCAG 2.2 Level AA support mode";
  return `${standard.label} (${standard.wcagVersion} ${standard.wcagLevel})`;
}

function formatDisclaimer(standard: ComplianceStandardMetadata | undefined): string {
  const disclaimer = standard?.disclaimer || "This report supports accessibility risk detection and remediation tracking. It does not certify legal compliance with ADA, Section 508, or WCAG. Manual review is required.";

  return `### Compliance Note

${disclaimer}`;
}

function formatComplianceEvidence(evidence: ComplianceEvidenceSummary): string {
  const topPages = evidence.topAffectedPages.length > 0
    ? evidence.topAffectedPages
      .map((page) => `- ${page.url}: ${page.total} findings, score ${page.severityScore}`)
      .join("\n")
    : "No page-level evidence available.";

  return `### Compliance Evidence Summary

| Evidence | Value |
|---|---:|
| Total findings | ${evidence.totalFindings} |
| WCAG-mapped findings | ${evidence.wcagMappedFindings} |
| Unmapped findings | ${evidence.unmappedFindings} |
| Affected pages | ${evidence.affectedPages} |
| Automated coverage | ${evidence.automatedCoverage} |
| Manual review required | ${evidence.requiresManualReview ? "yes" : "no"} |

Top affected pages:

${topPages}`;
}

function formatPageSummary(pages: PageSummary[]): string {
  if (pages.length === 0) return "No page-level findings.";

  const rows = pages
    .slice(0, 10)
    .map((page) => `| ${page.url} | ${page.total} | ${page.critical} | ${page.warning} | ${page.info} | ${page.severityScore} |`)
    .join("\n");

  return `### Page Risk Ranking

| URL | Total | Critical | Warning | Info | Score |
|---|---:|---:|---:|---:|---:|
${rows}`;
}

function flattenSummary(summary: ReportSummary): [string, SummaryValue][] {
  const rows: [string, SummaryValue][] = [];

  for (const [key, value] of Object.entries(summary)) {
    flattenValue(key, value, rows);
  }

  return rows;
}

function flattenValue(key: string, value: unknown, rows: [string, SummaryValue][]): void {
  if (Array.isArray(value)) {
    if (value.every((item) => !item || typeof item !== "object")) {
      rows.push([key, value.join("|")]);
      return;
    }

    for (const [index, item] of value.entries()) {
      flattenValue(`${key}.${index}`, item, rows);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      flattenValue(`${key}.${nestedKey}`, nestedValue, rows);
    }
    return;
  }

  rows.push([key, value as SummaryValue]);
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

function severityWeight(severity: Severity): number {
  if (severity === "critical") return 5;
  if (severity === "warning") return 2;
  return 1;
}
