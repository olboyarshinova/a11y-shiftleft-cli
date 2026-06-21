import fs from "node:fs/promises";
import path from "node:path";
import { stringify } from "csv-stringify/sync";
import { enrichIssueEvidence } from "../core/classification.js";
import { createManualChecklist, toManualChecklistMarkdown } from "../core/manualChecklist.js";
import { getRemediationHint } from "../core/remediation.js";
import { summarizeRootCauses } from "../core/rootCauses.js";
import type { A11yReport, ComplianceEvidenceSummary, ComplianceStandardMetadata, DedupedIssue, PageSummary, ReportFormat, ReportMetrics, ReportSummary, RootCauseGroup, Severity } from "../types.js";

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
  const reportIssues = issues.map((issue) => {
    const enrichedIssue = issue.confidence && issue.category && issue.findingType
      ? issue
      : enrichIssueEvidence(issue);

    return enrichedIssue.remediation
      ? enrichedIssue
      : {
        ...enrichedIssue,
        remediation: getRemediationHint(
          enrichedIssue.ruleId,
          enrichedIssue.wcagCriteria,
          enrichedIssue.framework,
          { helpUrl: enrichedIssue.helpUrl }
        )
      };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    summary: summarize(reportIssues, metrics),
    issues: reportIssues
  };

  if (formats.has("json")) {
    await fs.writeFile(
      path.join(outputDir, "a11y-report.json"),
      JSON.stringify(report, null, 2)
    );
  }

  if (formats.has("csv")) {
    await Promise.all([
      fs.writeFile(
        path.join(outputDir, "a11y-metrics.csv"),
        toCsv(report.summary)
      ),
      fs.writeFile(
        path.join(outputDir, "a11y-findings.csv"),
        toFindingsCsv(report.issues)
      ),
      fs.writeFile(
        path.join(outputDir, "a11y-summary.csv"),
        toSummaryCsv(report)
      ),
      fs.writeFile(
        path.join(outputDir, "a11y-pages.csv"),
        toPagesCsv(report.summary.byPage)
      ),
      fs.writeFile(
        path.join(outputDir, "a11y-rules.csv"),
        toRulesCsv(report.issues)
      ),
      fs.writeFile(
        path.join(outputDir, "a11y-remediation.csv"),
        toRemediationCsv(report.issues)
      )
    ]);
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
      issues: reportIssues
    });

    await Promise.all([
      fs.writeFile(
        path.join(outputDir, "a11y-manual-checklist.md"),
        toManualChecklistMarkdown(checklist)
      ),
      fs.writeFile(
        path.join(outputDir, "a11y-manual-checklist.json"),
        `${JSON.stringify(checklist, null, 2)}\n`
      )
    ]);
  }

  return report;
}

function summarize(issues: DedupedIssue[], metrics: ReportMetrics): ReportSummary {
  const rawCount = metrics.rawCount || issues.length;
  const duplicateCount = metrics.duplicateCount || 0;
  const byPage = summarizePages(issues);
  const rootCauseGroups = summarizeRootCauses(issues);

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
    baseline: metrics.baseline,
    retest: metrics.retest,
    remediationTracking: metrics.remediationTracking,
    ignore: metrics.ignore,
    retention: summarizeRetention(metrics.retention),
    complianceEvidence: summarizeComplianceEvidence(issues, byPage, metrics.standard),
    bySource: countBy(issues, "source"),
    bySeverity: countBy(issues, "severity"),
    byConfidence: countBy(issues, "confidence"),
    byColorScheme: countByPresent(issues, "colorScheme"),
    byFindingType: countBy(issues, "findingType"),
    byCategory: countBy(issues, "category"),
    byPour: countByPour(issues),
    byWcagLevel: countByWcagLevel(issues),
    byWcagVersion: countByWcagVersion(issues),
    byUnmappedRule: countByUnmappedRule(issues),
    byPage,
    rootCauseCount: rootCauseGroups.length,
    rootCauseGroups
  };
}

function toCsv(summary: ReportSummary): string {
  return [
    "metric,value",
    ...flattenSummary(summary).map(([key, value]) => `${key},${formatCsvValue(value)}`)
  ].join("\n");
}

export function toSummaryCsv(report: A11yReport): string {
  const summary = report.summary;
  const compliance = summary.complianceEvidence;
  return structuredCsv([{
    generatedAt: report.generatedAt,
    framework: summary.framework,
    urls: summary.urls.join(" | "),
    standard: summary.standard?.id || "wcag22-aa",
    wcagVersion: summary.standard?.wcagVersion || "2.2",
    wcagLevel: summary.standard?.wcagLevel || "AA",
    total: summary.total,
    critical: summary.critical,
    warning: summary.warning,
    info: summary.info,
    rawFindings: summary.rawCount,
    uniqueFindings: summary.uniqueCount,
    duplicatesRemoved: summary.duplicateCount,
    duplicateRate: summary.duplicateRate,
    scanDurationMs: summary.scanDurationMs,
    affectedPages: compliance.affectedPages,
    wcagMappedFindings: compliance.wcagMappedFindings,
    bestPracticeFindings: compliance.bestPracticeFindings || 0,
    unmappedFindings: compliance.unmappedFindings,
    likelyRootCauses: summary.rootCauseCount || 0,
    baselineNew: summary.baseline?.newIssues ?? "",
    baselineResolved: summary.baseline?.resolvedIssues ?? "",
    retestNew: summary.retest?.newIssues ?? "",
    retestFixed: summary.retest?.fixedIssues ?? "",
    ignoredFindings: summary.ignore?.ignoredIssues ?? 0,
    trackedRemediation: summary.remediationTracking?.matchedIssues ?? 0
  }], [
    "generatedAt", "framework", "urls", "standard", "wcagVersion", "wcagLevel",
    "total", "critical", "warning", "info", "rawFindings", "uniqueFindings",
    "duplicatesRemoved", "duplicateRate", "scanDurationMs", "affectedPages",
    "wcagMappedFindings", "bestPracticeFindings", "unmappedFindings",
    "likelyRootCauses", "baselineNew", "baselineResolved", "retestNew",
    "retestFixed", "ignoredFindings", "trackedRemediation"
  ]);
}

export function toPagesCsv(pages: PageSummary[]): string {
  return structuredCsv(pages, [
    "url", "total", "critical", "warning", "info", "severityScore"
  ]);
}

export function toRulesCsv(issues: DedupedIssue[]): string {
  const grouped = new Map<string, DedupedIssue[]>();
  for (const issue of issues) {
    grouped.set(issue.ruleId, [...(grouped.get(issue.ruleId) || []), issue]);
  }

  const records = [...grouped.entries()].map(([ruleId, ruleIssues]) => ({
    ruleId,
    highestSeverity: highestSeverity(ruleIssues),
    findings: ruleIssues.length,
    occurrences: ruleIssues.reduce((total, issue) => total + 1 + (issue.duplicateCount || 0), 0),
    sources: uniqueJoined(ruleIssues.map((issue) => issue.source)),
    findingTypes: uniqueJoined(ruleIssues.map((issue) => issue.findingType)),
    categories: uniqueJoined(ruleIssues.map((issue) => issue.category)),
    wcagCriteria: uniqueJoined(ruleIssues.flatMap((issue) => issue.wcagCriteria.map((criterion) => `${criterion.id} ${criterion.title} (${criterion.level})`))),
    pages: uniqueJoined(ruleIssues.map((issue) => issue.url)),
    fixSummary: ruleIssues[0].remediation?.summary || "",
    documentation: uniqueJoined(ruleIssues.flatMap((issue) => issue.remediation?.docs || []))
  })).sort((left, right) => {
    const severityDifference = severityRank(right.highestSeverity) - severityRank(left.highestSeverity);
    return severityDifference || right.occurrences - left.occurrences || left.ruleId.localeCompare(right.ruleId);
  });

  return structuredCsv(records, [
    "ruleId", "highestSeverity", "findings", "occurrences", "sources",
    "findingTypes", "categories", "wcagCriteria", "pages", "fixSummary",
    "documentation"
  ]);
}

export function toRemediationCsv(issues: DedupedIssue[]): string {
  const records = issues.map((issue) => ({
    fingerprint: issue.fingerprint || "",
    severity: issue.severity,
    ruleId: issue.ruleId,
    target: issue.url || issue.file || issue.selector || "unknown",
    status: issue.remediationTracking?.status || "untracked",
    owner: issue.remediationTracking?.owner || "",
    reason: issue.remediationTracking?.reason || "",
    updatedAt: issue.remediationTracking?.updatedAt || "",
    reviewBy: issue.remediationTracking?.reviewBy || "",
    fixSummary: issue.remediation?.summary || "",
    fixSteps: issue.remediation?.howToFix.join(" | ") || "",
    documentation: issue.remediation?.docs.join(" | ") || ""
  }));

  return structuredCsv(records, [
    "fingerprint", "severity", "ruleId", "target", "status", "owner",
    "reason", "updatedAt", "reviewBy", "fixSummary", "fixSteps", "documentation"
  ]);
}

export function toFindingsCsv(issues: DedupedIssue[]): string {
  const records = issues.map((issue) => sanitizeCsvRecord({
    severity: issue.severity,
    confidence: issue.confidence,
    confidenceScore: issue.confidenceScore,
    source: issue.source,
    framework: issue.framework,
    ruleId: issue.ruleId,
    findingType: issue.findingType,
    category: issue.category,
    wcag: issue.wcag.join(" | "),
    wcagCriteria: issue.wcagCriteria.map((criterion) => `${criterion.id} ${criterion.title} (${criterion.level})`).join(" | "),
    url: issue.url || "",
    file: issue.file || "",
    line: issue.line || "",
    selector: issue.selector || "",
    message: issue.message,
    fixSummary: issue.remediation?.summary || "",
    fixSteps: issue.remediation?.howToFix.join(" | ") || "",
    documentation: issue.remediation?.docs.join(" | ") || "",
    frameworkExamples: formatFrameworkExamplesForCsv(issue),
    duplicateCount: issue.duplicateCount,
    baselineStatus: issue.baselineStatus || "",
    retestStatus: issue.retestStatus || "",
    remediationStatus: issue.remediationTracking?.status || "",
    remediationOwner: issue.remediationTracking?.owner || "",
    remediationReason: issue.remediationTracking?.reason || "",
    remediationReviewBy: issue.remediationTracking?.reviewBy || ""
  }));

  return stringify(records, {
    header: true,
    columns: [
      "severity",
      "confidence",
      "confidenceScore",
      "source",
      "framework",
      "ruleId",
      "findingType",
      "category",
      "wcag",
      "wcagCriteria",
      "url",
      "file",
      "line",
      "selector",
      "message",
      "fixSummary",
      "fixSteps",
      "documentation",
      "frameworkExamples",
      "duplicateCount",
      "baselineStatus",
      "retestStatus",
      "remediationStatus",
      "remediationOwner",
      "remediationReason",
      "remediationReviewBy"
    ]
  });
}

type CsvCell = string | number | boolean;

function structuredCsv<T extends object>(records: T[], columns: string[]): string {
  return stringify(records.map((record) => sanitizeCsvRecord(record as Record<string, CsvCell>)), { header: true, columns });
}

function sanitizeCsvRecord(record: Record<string, CsvCell>): Record<string, CsvCell> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [
    key,
    typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(value)
      ? `'${value}`
      : value
  ]));
}

function uniqueJoined(values: Array<string | undefined>): string {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort().join(" | ");
}

function highestSeverity(issues: DedupedIssue[]): Severity {
  return issues.reduce<Severity>((highest, issue) => (
    severityRank(issue.severity) > severityRank(highest) ? issue.severity : highest
  ), "info");
}

function severityRank(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function formatFrameworkExamplesForCsv(issue: DedupedIssue): string {
  return Object.entries(issue.remediation?.frameworkExamples || {})
    .map(([framework, example]) => `${framework}: ${example}`)
    .join(" | ");
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
      const colorScheme = issue.colorScheme
        ? ` color scheme: ${issue.colorScheme}`
        : "";
      const screenshot = issue.screenshot ? ` screenshot: ${issue.screenshot}` : "";
      const baseline = issue.baselineStatus ? ` baseline: ${issue.baselineStatus}` : "";
      const retest = issue.retestStatus ? ` retest: ${issue.retestStatus}` : "";
      const tracking = formatRemediationTracking(issue);
      const confidence = formatIssueConfidence(issue);
      const findingType = ` type: ${formatFindingType(issue.findingType)}`;
      const category = issue.category ? ` category: ${issue.category}` : "";
      const contrast = formatContrastEvidence(issue);
      return `- **${issue.severity}** \`${issue.ruleId}\`${criteria} ${issue.file || issue.selector || ""}${state}${colorScheme}${screenshot}${baseline}${retest}${tracking}${findingType}${category}${confidence}: ${issue.message}${contrast}${remediation}`;
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
${formatBaselineRows(report.summary.baseline)}${formatRetestRows(report.summary.retest)}${formatRemediationRows(report.summary.remediationTracking)}| Automated coverage | ${report.summary.standard?.automatedCoverage || "partial"} |
${formatIgnoreRows(report.summary.ignore)}| Manual review required | ${complianceEvidence.requiresManualReview ? "yes" : "no"} |
${formatRetentionRows(report.summary.retention)}| Retention evidence | ${formatRetentionEvidenceStatus(report.summary.retention)} |
| WCAG-mapped findings | ${complianceEvidence.wcagMappedFindings} |
| Best-practice findings | ${complianceEvidence.bestPracticeFindings || 0} |
| Unmapped findings | ${complianceEvidence.unmappedFindings} |
| Likely root causes | ${report.summary.rootCauseCount || 0} |
| Affected pages | ${complianceEvidence.affectedPages} |
| POUR | ${formatCountMap(report.summary.byPour)} |
| WCAG levels | ${formatCountMap(report.summary.byWcagLevel)} |
| WCAG versions | ${formatCountMap(report.summary.byWcagVersion)} |
| Confidence | ${formatCountMap(report.summary.byConfidence)} |
| Color schemes | ${formatCountMap(report.summary.byColorScheme)} |
| Finding types | ${formatCountMap(report.summary.byFindingType)} |
| Categories | ${formatCountMap(report.summary.byCategory)} |
| Rules without WCAG mapping | ${formatCountMap(report.summary.byUnmappedRule)} |

${formatPageSummary(report.summary.byPage || [])}

${formatComplianceEvidence(complianceEvidence)}

${formatRootCauseGroups(report.summary.rootCauseGroups || [])}

## Top Findings And Recommendations

${topIssues || "No accessibility findings detected."}

${report.issues.length > 10 ? `Showing 10 of ${report.issues.length} findings. See \`a11y-report.json\` or \`a11y-findings.csv\` for every finding and recommendation.` : ""}

${formatDisclaimer(report.summary.standard)}
`;
}

function countBy(items: DedupedIssue[], field: "source" | "severity" | "confidence" | "findingType" | "category"): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function countByPresent(
  items: DedupedIssue[],
  field: "colorScheme"
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item[field];
    if (!key) return acc;
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
  const wcagMappedFindings = issues.filter((issue) => issue.findingType === "wcag").length;
  const bestPracticeFindings = issues.filter((issue) => issue.findingType === "best-practice").length;
  const unmappedFindings = issues.length - wcagMappedFindings - bestPracticeFindings;

  return {
    standardId: standard?.id,
    wcagVersion: standard?.wcagVersion,
    wcagLevel: standard?.wcagLevel,
    automatedCoverage: "partial",
    requiresManualReview: true,
    totalFindings: issues.length,
    wcagMappedFindings,
    bestPracticeFindings,
    unmappedFindings,
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
  const steps = issue.remediation.howToFix
    .map((step, index) => `\n  - Step ${index + 1}: ${step}`)
    .join("");

  return [
    `\n  - Fix: ${issue.remediation.summary}`,
    steps,
    docs ? `\n  - Docs: ${docs}` : "",
    example
  ].join("");
}

function formatContrastEvidence(issue: DedupedIssue): string {
  if (!issue.contrast) return "";

  const contrast = issue.contrast;
  const suggestions = contrast.suggestions
    .map((suggestion) => `${suggestion.purpose} text ${suggestion.color} (${suggestion.contrastRatio}:1)`)
    .join(", ");

  return [
    `\n  - Contrast: ${contrast.actualRatio}:1; required: ${contrast.requiredRatio}:1`,
    `\n  - Colors: text ${contrast.foreground}; background ${contrast.background}`,
    suggestions ? `\n  - Suggested text colors on ${contrast.background}: ${suggestions}` : ""
  ].join("");
}

function formatFrameworkExample(issue: DedupedIssue): string {
  if (!issue.remediation?.frameworkExamples) return "";

  const entries = Object.entries(issue.remediation.frameworkExamples);
  if (entries.length === 0) return "";

  const [framework, example] = entries[0];
  return `\n  - ${framework} example: \`${example}\``;
}

function formatIssueConfidence(issue: DedupedIssue): string {
  if (!issue.confidence) return "";

  const score = Number.isFinite(issue.confidenceScore)
    ? ` ${issue.confidenceScore}%`
    : "";

  return ` confidence: ${issue.confidence}${score}`;
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

function formatBaselineRows(baseline: ReportSummary["baseline"]): string {
  if (!baseline?.enabled) return "";

  return `${[
    `| Baseline file | ${baseline.file} |`,
    `| Baseline updated | ${baseline.updated ? "yes" : "no"} |`,
    `| Baseline issues | ${baseline.baselineIssues} |`,
    `| Existing baseline issues | ${baseline.existingIssues} |`,
    `| New findings | ${baseline.newIssues} |`,
    `| Resolved baseline findings | ${baseline.resolvedIssues} |`
  ].join("\n")}\n`;
}

function formatRetestRows(retest: ReportSummary["retest"]): string {
  if (!retest?.enabled) return "";

  return `${[
    `| Previous report | ${retest.file} |`,
    `| Previous findings | ${retest.previousIssues} |`,
    `| Fixed findings | ${retest.fixedIssues} |`,
    `| Remaining findings | ${retest.remainingIssues} |`,
    `| New findings | ${retest.newIssues} |`
  ].join("\n")}\n`;
}

function formatRemediationRows(tracking: ReportSummary["remediationTracking"]): string {
  if (!tracking?.enabled) return "";

  return `${[
    `| Remediation file | ${tracking.file} |`,
    `| Tracked findings | ${tracking.matchedIssues} |`,
    `| Stale remediation entries | ${tracking.staleEntries} |`,
    `| Invalid remediation entries | ${tracking.invalidEntries} |`,
    `| Remediation statuses | ${formatCountMap(tracking.byStatus)} |`
  ].join("\n")}\n`;
}

function formatRemediationTracking(issue: DedupedIssue): string {
  const tracking = issue.remediationTracking;
  if (!tracking) return "";
  const owner = tracking.owner ? ` owner: ${tracking.owner}` : "";
  const review = tracking.reviewBy ? ` review by: ${tracking.reviewBy}` : "";
  return ` remediation: ${tracking.status}${owner}${review}`;
}

function formatIgnoreRows(ignore: ReportSummary["ignore"]): string {
  if (!ignore?.enabled) return "";

  return `${[
    `| Ignore file | ${ignore.file} |`,
    `| Ignored findings | ${ignore.ignoredIssues} |`,
    `| Active ignore rules | ${ignore.activeRules} |`,
    `| Expired ignore rules | ${ignore.expiredRules} |`,
    `| Invalid ignore rules | ${ignore.invalidRules} |`
  ].join("\n")}\n`;
}

function formatRetentionRows(retention: ReportSummary["retention"]): string {
  if (!retention?.enabled) return "";
  const mode = retention.dryRun ? "dry-run preview" : "cleanup";

  return `${[
    `| Retention mode | ${mode} |`,
    `| Retention policy | maxRuns ${retention.maxRuns}, maxAgeDays ${retention.maxAgeDays} |`,
    `| Retention candidate runs | ${retention.candidateRuns} |`,
    `| Retention planned deleted runs | ${retention.plannedDeletedRuns} |`,
    `| Retention deleted runs | ${retention.deletedRuns} |`,
    `| Retention kept runs | ${retention.keptRuns} |`
  ].join("\n")}\n`;
}

function formatRetentionEvidenceStatus(retention: ReportSummary["retention"]): string {
  if (!retention?.enabled) return "none";
  return retention.dryRun ? "dry-run" : "recorded";
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
| Best-practice findings | ${evidence.bestPracticeFindings || 0} |
| Unmapped findings | ${evidence.unmappedFindings} |
| Affected pages | ${evidence.affectedPages} |
| Automated coverage | ${evidence.automatedCoverage} |
| Manual review required | ${evidence.requiresManualReview ? "yes" : "no"} |

Top affected pages:

${topPages}`;
}

function formatRootCauseGroups(groups: RootCauseGroup[]): string {
  if (groups.length === 0) {
    return `### Likely Root Causes\n\nNo root-cause candidates were generated.`;
  }

  const rows = groups
    .slice(0, 10)
    .map((group) => `| \`${group.ruleId}\` | ${formatFindingType(group.findingType)} | ${group.severity} | ${group.occurrenceCount} | ${group.affectedPages.length} | \`${group.targetPattern}\` |`)
    .join("\n");

  return `### Likely Root Causes

Heuristic groups reduce repeated page-level occurrences without hiding their individual evidence.

| Rule | Type | Severity | Occurrences | Pages | Target pattern |
|---|---|---|---:|---:|---|
${rows}`;
}

function formatFindingType(type: DedupedIssue["findingType"]): string {
  if (type === "wcag") return "WCAG violation";
  if (type === "best-practice") return "best practice";
  return "unmapped review";
}

function summarizeRetention(retention: ReportMetrics["retention"]): ReportSummary["retention"] {
  if (!retention) return undefined;

  return {
    enabled: retention.enabled,
    dryRun: Boolean(retention.dryRun),
    maxRuns: retention.maxRuns,
    maxAgeDays: retention.maxAgeDays,
    candidateRuns: retention.candidateRuns,
    plannedDeletedRuns: retention.plannedDeletedRuns ?? retention.deletedRuns,
    deletedRuns: retention.deletedRuns,
    keptRuns: retention.keptRuns
  };
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
