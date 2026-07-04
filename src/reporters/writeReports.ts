import fs from "node:fs/promises";
import path from "node:path";
import { stringify } from "csv-stringify/sync";
import { enrichIssueEvidence } from "../core/classification.js";
import { createManualChecklist, toManualChecklistMarkdown } from "../core/manualChecklist.js";
import { writeEvaluationScopeManifest } from "../core/evaluationScope.js";
import { annotateIssuesWithJourneys, summarizeJourneyImpact } from "../core/journeyImpact.js";
import { compareLighthouseWithFindings } from "../core/lighthouseComparison.js";
import { getRemediationHint } from "../core/remediation.js";
import { summarizeRootCauses } from "../core/rootCauses.js";
import { summarizeSampleComparison } from "../core/sampleComparison.js";
import { applyUserImpact, countUserImpact } from "../core/userImpact.js";
import type { A11yReport, ComplianceEvidenceSummary, ComplianceStandardMetadata, DedupedIssue, Framework, LighthouseAuditResult, LighthouseReportSummary, PageSummary, RemediationHint, ReportFormat, ReportMetrics, ReportSummary, RootCauseGroup, Severity } from "../types.js";

interface WriteReportOptions {
  formats?: ReportFormat[];
  semiAuto?: boolean;
  legacyMetrics?: boolean;
  frameworkExample?: Framework;
  exploration?: A11yReport["exploration"];
  keyboard?: A11yReport["keyboard"];
  manualChecklist?: A11yReport["manualChecklist"];
}

type SummaryValue = string | number | boolean | null | undefined;

export async function writeReports(
  outputDir: string,
  issues: DedupedIssue[],
  metrics: ReportMetrics = {},
  options: WriteReportOptions = {}
): Promise<A11yReport> {
  await fs.mkdir(outputDir, { recursive: true });
  const formats = new Set(options.formats || ["json", "markdown"]);
  const reportIssues = applyUserImpact(annotateIssuesWithJourneys(issues.map((issue) => {
    const enrichedIssue = issue.confidence && issue.category && issue.findingType
      ? issue
      : enrichIssueEvidence(issue);
    const remediation = enrichedIssue.remediation || getRemediationHint(
      enrichedIssue.ruleId,
      enrichedIssue.wcagCriteria,
      enrichedIssue.framework,
      { helpUrl: enrichedIssue.helpUrl }
    );

    return {
      ...enrichedIssue,
      remediation: keepRelevantFrameworkExample(
        remediation,
        enrichedIssue,
        options.frameworkExample
      )
    };
  }), metrics.plannedScope));

  const manualChecklist = options.manualChecklist || (options.semiAuto
    ? createManualChecklist({
      framework: metrics.framework || "unknown",
      urls: metrics.urls || [],
      issues: reportIssues
    })
    : undefined);
  const report: A11yReport = {
    generatedAt: new Date().toISOString(),
    summary: summarize(reportIssues, metrics),
    issues: reportIssues,
    exploration: options.exploration,
    keyboard: options.keyboard,
    manualChecklist,
    lighthouse: metrics.lighthouse
  };

  await writeEvaluationScopeManifest(outputDir, report);

  if (formats.has("json")) {
    await fs.writeFile(
      path.join(outputDir, "a11y-report.json"),
      JSON.stringify(report, null, 2)
    );
  }

  if (formats.has("csv")) {
    await Promise.all([
      ...(options.legacyMetrics === false ? [] : [fs.writeFile(
        path.join(outputDir, "a11y-metrics.csv"),
        toCsv(report.summary)
      )]),
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
      )
    ]);
  }

  if (formats.has("markdown")) {
    await fs.writeFile(
      path.join(outputDir, "a11y-comment.md"),
      toMarkdown(report)
    );
  }

  if (options.semiAuto && manualChecklist) {
    await Promise.all([
      fs.writeFile(
        path.join(outputDir, "a11y-manual-checklist.md"),
        toManualChecklistMarkdown(manualChecklist)
      ),
      fs.writeFile(
        path.join(outputDir, "a11y-manual-checklist.json"),
        `${JSON.stringify(manualChecklist, null, 2)}\n`
      )
    ]);
  }

  return report;
}

function keepRelevantFrameworkExample(
  remediation: RemediationHint,
  issue: DedupedIssue,
  explicitFramework?: Framework
): RemediationHint {
  const framework = isExampleFramework(explicitFramework)
    ? explicitFramework
    : issue.source === "eslint" && isExampleFramework(issue.framework)
      ? issue.framework
      : undefined;
  const example = framework ? remediation.frameworkExamples?.[framework] : undefined;

  return {
    ...remediation,
    frameworkExamples: framework && example ? { [framework]: example } : undefined
  };
}

function isExampleFramework(framework: Framework | string | undefined): framework is "react" | "vue" | "angular" {
  return framework === "react" || framework === "vue" || framework === "angular";
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
    plannedScope: metrics.plannedScope,
    journeyImpact: summarizeJourneyImpact(issues, metrics.plannedScope),
    sampleComparison: summarizeSampleComparison(issues, metrics.plannedScope),
    baseline: metrics.baseline,
    retest: metrics.retest,
    remediationTracking: metrics.remediationTracking,
    ignore: metrics.ignore,
    retention: summarizeRetention(metrics.retention),
    lighthouse: summarizeLighthouse(metrics.lighthouse, issues),
    complianceEvidence: summarizeComplianceEvidence(issues, byPage, metrics.standard),
    bySource: countBy(issues, "source"),
    bySeverity: countBy(issues, "severity"),
    byConfidence: countBy(issues, "confidence"),
    byColorScheme: countByPresent(issues, "colorScheme"),
    byFindingType: countBy(issues, "findingType"),
    byCategory: countBy(issues, "category"),
    byOwnership: countByOwnership(issues),
    byUserImpact: countUserImpact(issues),
    blockedByHumanVerification: issues.filter((issue) => issue.ruleId === "adapter/human-verification").length,
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
    thirdPartyEmbeddedFindings: summary.byOwnership?.["third-party-embed"] || 0,
    userImpactBlocker: summary.byUserImpact?.blocker || 0,
    userImpactSignificant: summary.byUserImpact?.significant || 0,
    userImpactWorkaround: summary.byUserImpact?.workaround || 0,
    userImpactMinor: summary.byUserImpact?.minor || 0,
    humanVerificationBlocked: summary.blockedByHumanVerification || 0,
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
    "likelyRootCauses", "userImpactBlocker", "userImpactSignificant",
    "userImpactWorkaround", "userImpactMinor", "baselineNew", "baselineResolved", "retestNew",
    "retestFixed", "ignoredFindings", "trackedRemediation",
    "thirdPartyEmbeddedFindings", "humanVerificationBlocked"
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
    ownership: issue.ownership?.label || "",
    ownershipSource: issue.ownership?.source || "",
    ownershipUrl: issue.ownership?.url || "",
    ownershipNote: issue.ownership?.note || "",
    userImpact: issue.userImpact?.level || "",
    affectedUsers: issue.userImpact?.affectedUsers.join(" | ") || "",
    impactReason: issue.userImpact?.reason || "",
    journeys: issue.journeys?.join(" | ") || "",
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
      "ownership",
      "ownershipSource",
      "ownershipUrl",
      "ownershipNote",
      "userImpact",
      "affectedUsers",
      "impactReason",
      "journeys",
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
  const topIssueGroups = groupTopFindings(report.issues);
  const topIssues = topIssueGroups
    .slice(0, 10)
    .map(formatTopFindingGroup)
    .join("\n\n");

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
| User impact | ${formatCountMap(report.summary.byUserImpact)} |
| Color schemes | ${formatCountMap(report.summary.byColorScheme)} |
| Finding types | ${formatCountMap(report.summary.byFindingType)} |
| Categories | ${formatCountMap(report.summary.byCategory)} |
| Ownership | ${formatCountMap(report.summary.byOwnership)} |
| Human verification blockers | ${report.summary.blockedByHumanVerification || 0} |
| Rules without WCAG mapping | ${formatCountMap(report.summary.byUnmappedRule)} |

${formatEvaluationScope(report)}

${formatPlannedScope(report.summary)}

${formatCoverageMatrix(report)}

${formatPageSummary(report.summary.byPage || [])}

${formatComplianceEvidence(complianceEvidence)}

${formatLighthouseEvidence(report.summary.lighthouse, report.lighthouse)}

${formatRootCauseGroups(report.summary.rootCauseGroups || [])}

${formatKeyboardEvidence(report)}

${formatManualReviewSummary(report)}

## Top Findings And Recommendations

${topIssues || "No accessibility findings detected."}

${topIssueGroups.length > 10 ? `Showing 10 of ${topIssueGroups.length} finding groups. See \`a11y-report.json\` for every finding and \`a11y-report.html\` for the visual report. Add CSV export only when spreadsheet triage is needed.` : ""}

${formatDisclaimer(report.summary.standard)}
`;
}

interface TopFindingGroup {
  key: string;
  ruleId: string;
  severity: Severity;
  criteria: DedupedIssue["wcagCriteria"];
  findingType: DedupedIssue["findingType"];
  category: DedupedIssue["category"];
  message: string;
  count: number;
  occurrenceCount: number;
  pages: string[];
  targets: string[];
  states: string[];
  colorSchemes: string[];
  screenshots: string[];
  sample: DedupedIssue;
  issues: DedupedIssue[];
}

function groupTopFindings(issues: DedupedIssue[]): TopFindingGroup[] {
  const groups = new Map<string, TopFindingGroup>();

  for (const issue of issues) {
    const criteriaKey = (issue.wcagCriteria || []).map((criterion) => criterion.id).sort().join(",");
    const remediationKey = issue.remediation?.summary || "";
    const key = `${issue.ruleId}::${criteriaKey}::${issue.findingType}::${remediationKey}`;
    const target = issue.file || issue.selector || "";
    const page = issue.url || "";

    const existing = groups.get(key);
    if (existing) {
      existing.issues.push(issue);
      existing.count += 1;
      existing.occurrenceCount += 1 + (issue.duplicateCount || 0);
      existing.severity = severityRank(issue.severity) > severityRank(existing.severity)
        ? issue.severity
        : existing.severity;
      pushUnique(existing.pages, page);
      pushUnique(existing.targets, target);
      pushUnique(existing.states, issue.stateLabel || "");
      pushUnique(existing.colorSchemes, issue.colorScheme || "");
      pushUnique(existing.screenshots, issue.screenshot || "");
      continue;
    }

    groups.set(key, {
      key,
      ruleId: issue.ruleId,
      severity: issue.severity,
      criteria: issue.wcagCriteria || [],
      findingType: issue.findingType,
      category: issue.category,
      message: issue.message,
      count: 1,
      occurrenceCount: 1 + (issue.duplicateCount || 0),
      pages: page ? [page] : [],
      targets: target ? [target] : [],
      states: issue.stateLabel ? [issue.stateLabel] : [],
      colorSchemes: issue.colorScheme ? [issue.colorScheme] : [],
      screenshots: issue.screenshot ? [issue.screenshot] : [],
      sample: issue,
      issues: [issue]
    });
  }

  return [...groups.values()].sort((left, right) => {
    const severityDiff = severityRank(right.severity) - severityRank(left.severity);
    if (severityDiff !== 0) return severityDiff;
    const occurrenceDiff = right.occurrenceCount - left.occurrenceCount;
    if (occurrenceDiff !== 0) return occurrenceDiff;
    return left.ruleId.localeCompare(right.ruleId);
  });
}

function pushUnique(values: string[], value: string): void {
  if (value && !values.includes(value)) values.push(value);
}

function formatTopFindingGroup(group: TopFindingGroup): string {
  const criteria = formatCriteria(group.sample);
  const findingType = ` type: ${formatFindingType(group.findingType)}`;
  const category = group.category ? ` category: ${group.category}` : "";
  const contrast = formatContrastEvidence(group.sample);
  const remediation = formatRemediation(group.sample);
  const ownership = formatOwnership(group.sample);
  const confidence = formatIssueConfidence(group.sample);
  const userImpact = formatUserImpact(group.sample);
  const status = formatGroupStatuses(group);
  const occurrenceLabel = group.occurrenceCount === 1 ? "1 occurrence" : `${group.occurrenceCount} occurrences`;
  const affected = [
    group.pages.length > 0 ? `pages: ${formatLimitedList(group.pages)}` : "",
    group.targets.length > 0 ? `targets: ${formatLimitedList(group.targets)}` : "",
    group.states.length > 0 ? `states: ${formatLimitedList(group.states)}` : "",
    group.colorSchemes.length === 1 ? `color scheme: ${group.colorSchemes[0]}` : "",
    group.colorSchemes.length > 1 ? `color schemes: ${formatLimitedList(group.colorSchemes)}` : "",
    group.screenshots.length > 0 ? `screenshots: ${formatLimitedList(group.screenshots)}` : ""
  ].filter(Boolean);

  return [
    `- **${group.severity}** \`${group.ruleId}\`${criteria} (${occurrenceLabel})${ownership}${userImpact}${findingType}${category}${confidence}: ${group.message}`,
    affected.length > 0 ? `\n  - Affected: ${affected.join("; ")}` : "",
    status,
    contrast,
    remediation
  ].filter(Boolean).join("");
}

function formatGroupStatuses(group: TopFindingGroup): string {
  const baselineStatuses = uniqueJoined(group.issues.map((issue) => issue.baselineStatus));
  const retestStatuses = uniqueJoined(group.issues.map((issue) => issue.retestStatus));
  const remediationStatuses = uniqueJoined(group.issues.map((issue) => issue.remediationTracking?.status));
  const remediationOwners = uniqueJoined(group.issues.map((issue) => issue.remediationTracking?.owner));
  const remediationReviewDates = uniqueJoined(group.issues.map((issue) => issue.remediationTracking?.reviewBy));
  const parts = [
    baselineStatuses ? `baseline: ${baselineStatuses}` : "",
    retestStatuses ? `retest: ${retestStatuses}` : "",
    remediationStatuses ? `remediation: ${remediationStatuses}` : "",
    remediationOwners ? `owner: ${remediationOwners}` : "",
    remediationReviewDates ? `review by: ${remediationReviewDates}` : ""
  ].filter(Boolean);

  return parts.length > 0 ? `\n  - Status: ${parts.join(" ")}` : "";
}

function formatLimitedList(values: string[], limit = 3): string {
  const shown = values.slice(0, limit).join(", ");
  const remaining = values.length - limit;
  return remaining > 0 ? `${shown}, +${remaining} more` : shown;
}

function formatEvaluationScope(report: A11yReport): string {
  const graph = report.exploration;
  const urls = graph
    ? [...new Set(graph.states.map((state) => state.url))]
    : report.summary.urls || [];
  const sources = Object.keys(report.summary.bySource || {}).sort();
  const evidence = [
    graph ? "browser exploration" : "browser exploration not included",
    sources.length > 0 ? sources.join(", ") : "no automated findings",
    report.keyboard ? "keyboard traversal" : "keyboard not included",
    report.summary.lighthouse ? "Lighthouse comparison" : "Lighthouse not included",
    report.manualChecklist ? "manual checklist" : "manual checklist not included"
  ].join("; ");
  const representativeStates = graph
    ? [...graph.states]
      .sort((left, right) => right.issueCount - left.issueCount)
      .slice(0, 3)
      .map((state) => `${state.id}: ${state.issueCount} finding${state.issueCount === 1 ? "" : "s"}`)
      .join("; ")
    : "not applicable";

  return `## Evaluation Scope

This WCAG-EM-inspired scope summary is reproducibility evidence, not a WCAG conformance claim. See \`evaluation-scope.json\` for the machine-readable version.

| Scope item | Value |
|---|---|
| Requested URLs | ${markdownCell((report.summary.urls || []).join(", ") || "none")} |
| URLs included | ${urls.length} |
| Rendered states | ${graph ? `${graph.summary.statesVisited} of ${graph.summary.maxStates} max` : "not included"} |
| Exploration depth | ${graph ? markdownCell(formatDepthScope(graph.summary.maxDepth)) : "not included"} |
| Evidence collected | ${markdownCell(evidence)} |
| Representative states | ${markdownCell(representativeStates || "No findings in captured states")} |`;
}

function formatDepthScope(maxDepth: number): string {
  if (maxDepth === 0) return "start page only (depth 0)";
  const levelLabel = maxDepth === 1 ? "1 interaction level" : `${maxDepth} interaction levels`;
  return `${levelLabel} from the start page`;
}

function formatPlannedScope(summary: ReportSummary): string {
  const scope = summary.plannedScope;
  if (!scope) return "";
  const product = `${scope.product.name ? `${scope.product.name} - ` : ""}${scope.product.type}`;
  const journeyRows = (summary.journeyImpact || [])
    .map((journey) => `| ${markdownCell(journey.name)} | ${journey.findingCount} | ${journey.critical} | ${journey.warning} | ${journey.info} | ${markdownCell(journey.urls.join(", "))} |`)
    .join("\n");
  return `## Planned Scope

| Scope item | Value |
|---|---|
| Product | ${markdownCell(product)} |
| Target standard | ${scope.target.standard} |
| Languages | ${markdownCell(scope.product.languages.join(", ") || "not specified")} |
| Representative URLs | ${markdownCell(scope.target.urls.join(", ") || "not specified")} |
| Supported platforms | ${markdownCell(scope.supportedPlatforms.join(", ") || "not specified")} |
| Assistive technologies | ${markdownCell(scope.assistiveTechnologies.join(", ") || "not specified")} |
| Representative sample | ${scope.representativeSample.length} |
| Random sample | ${scope.randomSample.length} |
| Critical journeys | ${scope.criticalJourneys.length} |
| Third-party content | ${scope.thirdPartyContent.length} |
| Exclusions | ${scope.exclusions.length} |

${formatRepresentativeSample(scope)}
${formatSampleComparison(summary.sampleComparison)}
${journeyRows ? `### Journey Impact

| Journey | Findings | Critical | Warning | Info | URLs |
|---|---:|---:|---:|---:|---|
${journeyRows}` : ""}`;
}

function formatSampleComparison(comparison: ReportSummary["sampleComparison"]): string {
  if (!comparison) return "";
  return `### Structured vs Random Sample

| Metric | Value |
|---|---:|
| Representative sample pages | ${comparison.representativeSampleSize} |
| Random sample pages | ${comparison.randomSampleSize} |
| Structured findings | ${comparison.structuredFindingCount} |
| Random findings | ${comparison.randomFindingCount} |
| Random-only rules | ${comparison.uniqueRandomRules.length} |

${markdownCell(comparison.recommendation)}
${comparison.uniqueRandomRules.length > 0 ? `\nRandom-only rules: ${comparison.uniqueRandomRules.map((rule) => `\`${markdownInline(rule)}\``).join(", ")}\n` : ""}`;
}

function formatRepresentativeSample(scope: NonNullable<ReportSummary["plannedScope"]>): string {
  if (scope.representativeSample.length === 0) return "";
  const rows = scope.representativeSample
    .map((page) => `| ${markdownCell(page.type)} | ${markdownCell(page.url)} | ${markdownCell(page.reason || "")} |`)
    .join("\n");
  return `### Representative Sample

| Type | URL | Reason |
|---|---|---|
${rows}

`;
}

function formatKeyboardEvidence(report: A11yReport): string {
  const audit = report.keyboard;
  if (!audit) return "";
  const path = audit.steps.slice(0, 20).map((step) =>
    `| ${step.index} | ${markdownCell(step.role || step.tagName)} | ${markdownCell(step.accessibleName || "none")} | ${step.indicatorVisible ? "yes" : "no"} | ${step.obscured ? "yes" : "no"} |`
  ).join("\n");

  return `## Keyboard Evidence

| Metric | Value |
|---|---:|
| Focusable controls | ${audit.focusableCount} |
| Forward steps | ${audit.steps.length} |
| Reverse steps | ${audit.backwardSteps.length} |
| Complete cycle | ${audit.completedCycle ? "yes" : "no"} |
| Activation attempts | ${audit.activationAttempts?.length || 0} |

| Step | Role | Accessible name | Focus indicator | Obscured |
|---:|---|---|---|---|
${path || "| - | - | No focus steps recorded | - | - |"}

${audit.steps.length > 20 ? `Showing 20 of ${audit.steps.length} forward focus steps. See \`a11y-report.json\` for the complete path and \`a11y-report.html\` for the visual keyboard report.` : ""}`;
}

function formatCoverageMatrix(report: A11yReport): string {
  const stateCount = report.exploration?.summary.statesVisited || 0;
  const reflowCount = report.exploration?.states.filter((state) => state.reflow).length || 0;
  const modalCount = report.exploration?.states.filter((state) => state.modalFocus).length || 0;
  const announcementStates = report.exploration?.states.filter((state) => state.dynamicAnnouncements) || [];
  const announcementUpdates = announcementStates.reduce((total, state) => total + (state.dynamicAnnouncements?.meaningfulUpdates || 0), 0);
  const formStates = report.exploration?.states.filter((state) => state.formErrors) || [];
  const invalidFields = formStates.reduce((total, state) => total + (state.formErrors?.invalidFieldCount || 0), 0);
  const unassociatedInvalidFields = formStates.reduce((total, state) => total + (state.formErrors?.unassociatedInvalidCount || 0), 0);
  const imageStates = report.exploration?.states.filter((state) => state.imageAlternatives) || [];
  const suspiciousImages = imageStates.reduce((total, state) => total + (state.imageAlternatives?.suspiciousCount || 0), 0);
  const mediaStates = report.exploration?.states.filter((state) => state.media) || [];
  const mediaElements = mediaStates.reduce((total, state) => total + (state.media?.audioCount || 0) + (state.media?.videoCount || 0), 0);
  const autoplayRisks = mediaStates.reduce((total, state) => total + (state.media?.autoplayRiskCount || 0), 0);
  const embeddedStates = report.exploration?.states.filter((state) => state.embeddedContent) || [];
  const iframeCount = embeddedStates.reduce((total, state) => total + (state.embeddedContent?.iframeCount || 0), 0);
  const inaccessibleFrames = embeddedStates.reduce((total, state) => total + (state.embeddedContent?.inaccessibleIframeCount || 0), 0);
  const canvasGaps = embeddedStates.reduce((total, state) => total + (state.embeddedContent?.canvasWithoutAlternativeCount || 0), 0);
  return `## Audit Coverage

| Area | Status | Evidence or next step |
|---|---|---|
| Browser automation | ${stateCount > 0 ? "Completed" : "Not included"} | ${stateCount > 0 ? `${stateCount} rendered states scanned` : "Run the audit command"} |
| Static source analysis | Configuration-dependent | Install the adapter for the detected framework |
| Keyboard traversal | ${report.keyboard ? "Bounded evidence collected" : "Not included"} | ${report.keyboard ? `${report.keyboard.steps.length} forward focus steps` : "Run audit without --no-keyboard"} |
| Reflow at 400% (320 CSS px simulation) | ${reflowCount > 0 ? "Heuristic evidence collected" : "Not included"} | ${reflowCount} rendered state${reflowCount === 1 ? "" : "s"} checked for overflow and clipped text |
| Modal focus behavior | ${modalCount > 0 ? "Heuristic evidence collected" : "No opened modal observed"} | ${modalCount} state${modalCount === 1 ? "" : "s"} checked for name, initial focus, Escape, and restoration |
| Dynamic announcements | ${announcementStates.length > 0 ? "Mutation evidence collected" : "No action evidence"} | ${announcementUpdates} meaningful live-region update${announcementUpdates === 1 ? "" : "s"} observed after ${announcementStates.length} action${announcementStates.length === 1 ? "" : "s"} |
| Form error states | ${formStates.length > 0 ? "Rendered-state evidence collected" : "No forms observed"} | ${invalidFields} explicit invalid field${invalidFields === 1 ? "" : "s"}; ${unassociatedInvalidFields} without an exposed associated error |
| Image alternatives | ${imageStates.length > 0 ? "Quality heuristics collected" : "No images observed"} | ${suspiciousImages} alternative${suspiciousImages === 1 ? "" : "s"} flagged for contextual human review |
| Media and motion | ${mediaStates.length > 0 ? "Rendered-state evidence collected" : "No media or active motion observed"} | ${mediaElements} audio/video element${mediaElements === 1 ? "" : "s"}; ${autoplayRisks} autoplay control risk${autoplayRisks === 1 ? "" : "s"} |
| Embedded content | ${embeddedStates.length > 0 ? "Coverage evidence collected" : "No iframe or canvas observed"} | ${iframeCount} iframe${iframeCount === 1 ? "" : "s"}; ${inaccessibleFrames} unavailable; ${canvasGaps} canvas alternative gap${canvasGaps === 1 ? "" : "s"} |
| Screen reader | Human review required | Test representative tasks with NVDA, JAWS, or VoiceOver |
| Content and task usability | ${report.manualChecklist ? "Checklist ready" : "Not included"} | Record human evidence and outcome |`;
}

function formatManualReviewSummary(report: A11yReport): string {
  const checklist = report.manualChecklist;
  if (!checklist) return "";
  const items = checklist.items.map((item) =>
    `- [ ] **${markdownInline(item.title)}** (WCAG ${markdownInline(item.wcag.join(", "))})`
  ).join("\n");

  return `## Manual Review Checklist

Automation cannot complete these checks. Record the full status, evidence, and notes in the visual or JSON report.

${items}`;
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
}

function markdownInline(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\*/g, "\\*").trim();
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

function countByOwnership(items: DedupedIssue[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item.ownership?.kind;
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

function formatOwnership(issue: DedupedIssue): string {
  if (!issue.ownership) return "";
  const source = issue.ownership.source ? ` source: ${issue.ownership.source}` : "";
  const note = issue.ownership.note ? ` note: ${issue.ownership.note}` : "";
  return ` ownership: ${issue.ownership.label}${source}${note}`;
}

function formatUserImpact(issue: DedupedIssue): string {
  if (!issue.userImpact) return "";
  const users = issue.userImpact.affectedUsers.length > 0
    ? ` users: ${issue.userImpact.affectedUsers.join(", ")}`
    : "";
  return ` user impact: ${issue.userImpact.level}${users}`;
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

function formatLighthouseEvidence(lighthouse: LighthouseReportSummary | undefined, results?: LighthouseAuditResult[]): string {
  if (!lighthouse?.enabled) return "";
  const rows = lighthouse.pages
    .map((page) => `| ${page.url} | ${page.score ?? "n/a"} | ${page.failedAudits} | ${page.manualAudits} |`)
    .join("\n");
  const comparison = formatLighthouseComparison(lighthouse);
  const recommendations = formatLighthouseRecommendations(results);

  return `### Lighthouse Accessibility Score

Lighthouse is an optional score-oriented signal. Treat it as a comparison point, not as WCAG conformance proof.

| Metric | Value |
|---|---:|
| Pages checked | ${lighthouse.pageCount} |
| Average score | ${lighthouse.averageAccessibilityScore ?? "n/a"} |
| Lowest score | ${lighthouse.minAccessibilityScore ?? "n/a"} |
| Failed Lighthouse audits | ${lighthouse.failedAuditCount} |
| Manual Lighthouse audits | ${lighthouse.manualAuditCount} |

| URL | Score | Failed audits | Manual audits |
|---|---:|---:|---:|
${rows}

${comparison}

${recommendations}`;
}

function formatLighthouseComparison(lighthouse: LighthouseReportSummary): string {
  const comparison = lighthouse.comparison;
  if (!comparison) return "";
  const lighthouseOnly = comparison.lighthouseOnlyAudits
    .slice(0, 10)
    .map((audit) => `- \`${audit.id}\`: ${markdownInline(audit.title)}`)
    .join("\n");
  const pipelineOnly = comparison.pipelineOnlyRules
    .slice(0, 10)
    .map((rule) => `- \`${rule.ruleId}\`: ${rule.count} finding${rule.count === 1 ? "" : "s"}, ${rule.highestSeverity}, ${rule.sources.join(" + ")}`)
    .join("\n");

  return `#### Lighthouse And Pipeline Comparison

Matching rule IDs: ${comparison.matchingRuleIds.length > 0 ? comparison.matchingRuleIds.map((ruleId) => `\`${ruleId}\``).join(", ") : "none"}

Lighthouse-only failed audits:

${lighthouseOnly || "none"}

Pipeline-only rules:

${pipelineOnly || "none"}`;
}

function formatLighthouseRecommendations(results: LighthouseAuditResult[] | undefined): string {
  if (!results || results.length === 0) return "";
  const failed = uniqueLighthouseAudits(results.flatMap((result) => result.failedAudits));
  const manual = uniqueLighthouseAudits(results.flatMap((result) => result.manualAudits));
  if (failed.length === 0 && manual.length === 0) return "";

  const failedRows = failed.slice(0, 10).map(formatLighthouseRecommendationRow).join("\n");
  const manualRows = manual.slice(0, 6).map(formatLighthouseRecommendationRow).join("\n");

  return `#### Lighthouse Recommendations

Failed audits:

${failedRows || "none"}

Manual Lighthouse checks:

${manualRows || "none"}`;
}

function formatLighthouseRecommendationRow(audit: LighthouseAuditResult["failedAudits"][number]): string {
  const description = audit.description ? ` ${markdownInline(audit.description)}` : "";
  const docs = audit.documentationUrl ? ` Docs: ${audit.documentationUrl}` : "";
  return `- \`${audit.id}\`: ${markdownInline(audit.title)}.${description}${docs}`;
}

function uniqueLighthouseAudits(audits: LighthouseAuditResult["failedAudits"]): LighthouseAuditResult["failedAudits"] {
  const seen = new Set<string>();
  const unique: LighthouseAuditResult["failedAudits"] = [];
  for (const audit of audits) {
    if (seen.has(audit.id)) continue;
    seen.add(audit.id);
    unique.push(audit);
  }
  return unique.sort((left, right) => left.id.localeCompare(right.id));
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

function summarizeLighthouse(results: LighthouseAuditResult[] | undefined, issues: DedupedIssue[]): LighthouseReportSummary | undefined {
  if (!results || results.length === 0) return undefined;
  const scores = results
    .map((result) => result.accessibilityScore)
    .filter((score): score is number => typeof score === "number");
  const averageAccessibilityScore = scores.length > 0
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : null;

  return {
    enabled: true,
    pageCount: results.length,
    averageAccessibilityScore,
    minAccessibilityScore: scores.length > 0 ? Math.min(...scores) : null,
    failedAuditCount: results.reduce((total, result) => total + result.failedAudits.length, 0),
    manualAuditCount: results.reduce((total, result) => total + result.manualAudits.length, 0),
    comparison: compareLighthouseWithFindings(issues, results),
    pages: results.map((result) => ({
      url: result.finalUrl || result.url,
      score: result.accessibilityScore,
      failedAudits: result.failedAudits.length,
      manualAudits: result.manualAudits.length
    }))
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
