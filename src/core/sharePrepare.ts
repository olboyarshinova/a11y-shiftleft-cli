import fs from "node:fs/promises";
import path from "node:path";
import type { A11yReport, DedupedIssue, PageSummary } from "../types.js";

interface RedactionCounts {
  queryStringsRemoved: number;
  absolutePathsRedacted: number;
  sensitiveTokensRedacted: number;
}

export interface SharePrepareManifest {
  version: 1;
  generatedAt: string;
  source: string;
  localOnly: true;
  outputs: string[];
  privacy: {
    screenshotsIncluded: false;
    visualReportsIncluded: false;
    evaluationScopeIncluded: boolean;
    rawExplorationIncluded: false;
    rawKeyboardIncluded: false;
    rawLighthouseIncluded: false;
    reviewRequiredBeforeSharing: true;
    queryStringsRemoved: number;
    absolutePathsRedacted: number;
    sensitiveTokensRedacted: number;
    warnings: string[];
  };
}

export interface PrepareShareReportOptions {
  reportPath: string;
  outputDir: string;
  generatedAt?: string;
}

export async function prepareShareReport(options: PrepareShareReportOptions): Promise<SharePrepareManifest> {
  const reportPath = await resolveReportPath(options.reportPath);
  const outputDir = path.resolve(options.outputDir);
  await ensureEmptyOutput(outputDir);

  const report = JSON.parse(await fs.readFile(reportPath, "utf8")) as A11yReport;
  if (!isA11yReport(report)) {
    throw new Error(`Not an a11y-report.json file: ${reportPath}`);
  }

  const counts: RedactionCounts = {
    queryStringsRemoved: 0,
    absolutePathsRedacted: 0,
    sensitiveTokensRedacted: 0
  };
  const shareReport = sanitizeReport(report, counts);
  const scope = await readOptionalEvaluationScope(reportPath, counts);
  const outputs = [
    "share-report.json",
    ...(scope ? ["share-evaluation-scope.json"] : []),
    "share-summary.md",
    "privacy-summary.json"
  ];
  const manifest: SharePrepareManifest = {
    version: 1,
    generatedAt: options.generatedAt || new Date().toISOString(),
    source: path.basename(reportPath),
    localOnly: true,
    outputs,
    privacy: {
      screenshotsIncluded: false,
      visualReportsIncluded: false,
      evaluationScopeIncluded: Boolean(scope),
      rawExplorationIncluded: false,
      rawKeyboardIncluded: false,
      rawLighthouseIncluded: false,
      reviewRequiredBeforeSharing: true,
      queryStringsRemoved: counts.queryStringsRemoved,
      absolutePathsRedacted: counts.absolutePathsRedacted,
      sensitiveTokensRedacted: counts.sensitiveTokensRedacted,
      warnings: [
        "Review every generated file before sending it outside the project team.",
        "Screenshots, visual reports, raw exploration graphs, raw keyboard paths, and raw Lighthouse payloads are excluded.",
        "URLs are reduced to origin and path; query strings and hashes are removed.",
        "Obvious local absolute paths, email addresses, bearer tokens, passwords, secrets, and API keys are redacted."
      ]
    }
  };

  await Promise.all([
    fs.writeFile(path.join(outputDir, "share-report.json"), `${JSON.stringify(shareReport, null, 2)}\n`),
    ...(scope ? [
      fs.writeFile(path.join(outputDir, "share-evaluation-scope.json"), `${JSON.stringify(scope, null, 2)}\n`)
    ] : []),
    fs.writeFile(path.join(outputDir, "share-summary.md"), toShareMarkdown(shareReport, scope)),
    fs.writeFile(path.join(outputDir, "privacy-summary.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  ]);

  return manifest;
}

async function readOptionalEvaluationScope(reportPath: string, counts: RedactionCounts): Promise<unknown | undefined> {
  const scopePath = path.join(path.dirname(reportPath), "evaluation-scope.json");
  try {
    const scope = JSON.parse(await fs.readFile(scopePath, "utf8")) as unknown;
    return sanitizeShareValue(scope, counts);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function resolveReportPath(inputPath: string): Promise<string> {
  const resolved = path.resolve(inputPath);
  const stats = await fs.stat(resolved);
  if (stats.isDirectory()) return path.join(resolved, "a11y-report.json");
  return resolved;
}

function sanitizeReport(report: A11yReport, counts: RedactionCounts) {
  const summary = report.summary;
  return {
    generatedAt: report.generatedAt,
    summary: {
      total: summary.total,
      critical: summary.critical,
      warning: summary.warning,
      info: summary.info,
      rawCount: summary.rawCount,
      uniqueCount: summary.uniqueCount,
      duplicateCount: summary.duplicateCount,
      duplicateRate: summary.duplicateRate,
      scanDurationMs: summary.scanDurationMs,
      framework: sanitizeText(String(summary.framework || "unknown"), counts),
      urls: (summary.urls || []).map((url) => sanitizeUrl(url, counts)),
      standard: summary.standard,
      lighthouse: summary.lighthouse,
      complianceEvidence: summary.complianceEvidence ? {
        ...summary.complianceEvidence,
        topAffectedPages: sanitizePages(summary.complianceEvidence.topAffectedPages || [], counts)
      } : undefined,
      bySource: summary.bySource,
      bySeverity: summary.bySeverity,
      byFindingType: summary.byFindingType,
      byCategory: summary.byCategory,
      byPour: summary.byPour,
      byWcagLevel: summary.byWcagLevel,
      byWcagVersion: summary.byWcagVersion,
      byPage: sanitizePages(summary.byPage || [], counts),
      rootCauseCount: summary.rootCauseCount
    },
    issues: (report.issues || []).map((issue) => sanitizeIssue(issue, counts)),
    omittedEvidence: {
      screenshots: countIssuesWithScreenshots(report.issues || []),
      visualReports: true,
      rawExploration: Boolean(report.exploration),
      rawKeyboard: Boolean(report.keyboard),
      rawLighthouse: Boolean(report.lighthouse)
    }
  };
}

function sanitizeIssue(issue: DedupedIssue, counts: RedactionCounts) {
  return {
    severity: issue.severity,
    confidence: issue.confidence,
    source: sanitizeText(issue.source, counts),
    ruleId: sanitizeText(issue.ruleId, counts),
    findingType: issue.findingType,
    category: issue.category,
    wcag: issue.wcag,
    wcagCriteria: issue.wcagCriteria,
    url: issue.url ? sanitizeUrl(issue.url, counts) : undefined,
    file: issue.file ? sanitizePath(issue.file, counts) : undefined,
    selector: issue.selector ? sanitizeText(issue.selector, counts) : undefined,
    ownership: issue.ownership ? {
      kind: issue.ownership.kind,
      label: sanitizeText(issue.ownership.label, counts),
      source: issue.ownership.source ? sanitizeText(issue.ownership.source, counts) : undefined,
      url: issue.ownership.url ? sanitizeUrl(issue.ownership.url, counts) : undefined,
      note: issue.ownership.note ? sanitizeText(issue.ownership.note, counts) : undefined
    } : undefined,
    message: sanitizeText(issue.message, counts),
    remediation: issue.remediation ? {
      summary: sanitizeText(issue.remediation.summary, counts),
      howToFix: issue.remediation.howToFix.map((step) => sanitizeText(step, counts)),
      docs: issue.remediation.docs.map((doc) => sanitizeUrl(doc, counts))
    } : undefined,
    duplicateCount: issue.duplicateCount,
    baselineStatus: issue.baselineStatus,
    retestStatus: issue.retestStatus
  };
}

function sanitizePages(pages: PageSummary[], counts: RedactionCounts): PageSummary[] {
  return pages.map((page) => ({
    ...page,
    url: sanitizeUrl(page.url, counts)
  }));
}

function sanitizeUrl(value: string, counts: RedactionCounts): string {
  try {
    const url = new URL(value);
    if (url.search || url.hash) counts.queryStringsRemoved += 1;
    return `${url.origin}${url.pathname}`;
  } catch {
    return sanitizeText(value, counts);
  }
}

function sanitizePath(value: string, counts: RedactionCounts): string {
  if (!path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value)) {
    return sanitizeText(value, counts);
  }

  counts.absolutePathsRedacted += 1;
  const normalized = value.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean).slice(-3);
  return `[local-path]/${parts.join("/")}`;
}

function sanitizeText(value: string, counts: RedactionCounts): string {
  let output = value;
  output = replaceAndCount(output, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]", counts, "sensitiveTokensRedacted");
  output = replaceAndCount(output, /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/g, "Bearer [redacted-token]", counts, "sensitiveTokensRedacted");
  output = replaceAndCount(output, /\b(password|secret|token|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]", counts, "sensitiveTokensRedacted");
  output = replaceAndCount(output, /(?:\/Users\/[^/\s]+|\/home\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/g, "[local-path]", counts, "absolutePathsRedacted");
  return output;
}

function sanitizeShareValue(value: unknown, counts: RedactionCounts): unknown {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return sanitizeUrl(value, counts);
    return sanitizePath(value, counts);
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeShareValue(item, counts));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeShareValue(nested, counts)])
    );
  }
  return value;
}

function replaceAndCount(
  value: string,
  pattern: RegExp,
  replacement: string,
  counts: RedactionCounts,
  field: keyof RedactionCounts
): string {
  let matches = 0;
  const output = value.replace(pattern, (...args: string[]) => {
    matches += 1;
    return args.length > 2 ? replacement.replace("$1", args[1] || "") : replacement;
  });
  counts[field] += matches;
  return output;
}

function countIssuesWithScreenshots(issues: DedupedIssue[]): number {
  return issues.filter((issue) => Boolean(issue.screenshot)).length;
}

function toShareMarkdown(report: ReturnType<typeof sanitizeReport>, scope?: unknown): string {
  const rows = report.issues.slice(0, 20).map((issue) =>
    `| ${issue.severity} | \`${issue.ruleId}\` | ${issue.url || issue.file || "unknown"} | ${markdownCell(issue.message)} |`
  ).join("\n");

  return `# Sanitized Accessibility Share Report

This local report is sanitized for external review. It excludes screenshots,
visual HTML/PDF reports, raw exploration graphs, raw keyboard data, and raw
Lighthouse payloads. Review it before sharing.

| Metric | Value |
|---|---:|
| Total | ${report.summary.total} |
| Critical | ${report.summary.critical} |
| Warning | ${report.summary.warning} |
| Info | ${report.summary.info} |
| WCAG levels | ${formatCountMap(report.summary.byWcagLevel)} |
| Finding types | ${formatCountMap(report.summary.byFindingType)} |

${formatShareScope(scope)}

## Findings

| Severity | Rule | Location | Message |
|---|---|---|---|
${rows || "| - | - | No findings | - |"}

${report.issues.length > 20 ? `Showing 20 of ${report.issues.length} findings. See \`share-report.json\` for the sanitized machine-readable report.\n` : ""}
`;
}

function formatShareScope(scope: unknown): string {
  if (!scope || typeof scope !== "object") return "";
  const source = scope as {
    methodology?: { conformanceClaim?: boolean };
    target?: { urlsRequested?: unknown[] };
    sample?: {
      includedUrls?: unknown[];
      statesVisited?: unknown;
      maxDepth?: unknown;
      representativeStates?: Array<{ id?: unknown; findingCount?: unknown }>;
    };
    evidence?: {
      visualExploration?: unknown;
      keyboardTraversal?: unknown;
      lighthouseComparison?: unknown;
      manualChecklist?: unknown;
      automatedSources?: unknown[];
    };
  };
  const targetUrls = source.target?.urlsRequested?.filter((url): url is string => typeof url === "string") || [];
  const includedUrls = source.sample?.includedUrls?.filter((url): url is string => typeof url === "string") || [];
  const automatedSources = source.evidence?.automatedSources?.filter((item): item is string => typeof item === "string") || [];
  const representativeStates = source.sample?.representativeStates
    ?.slice(0, 3)
    .map((state) => `${String(state.id || "state")}: ${String(state.findingCount ?? "n/a")} finding(s)`)
    .join("; ") || "none";

  return `## Evaluation Scope

This WCAG-EM-inspired scope summary is sanitized for external review. It is reproducibility evidence, not a WCAG conformance claim.

| Scope item | Value |
|---|---|
| Conformance claim | ${source.methodology?.conformanceClaim === true ? "yes" : "no"} |
| Requested URLs | ${markdownCell(targetUrls.join(", ") || "none")} |
| URLs included | ${includedUrls.length} |
| Rendered states | ${source.sample?.statesVisited ?? "not included"} |
| Depth | ${source.sample?.maxDepth ?? "not included"} |
| Automated sources | ${markdownCell(automatedSources.join(", ") || "none")} |
| Visual exploration | ${source.evidence?.visualExploration === true ? "yes" : "no"} |
| Keyboard traversal | ${source.evidence?.keyboardTraversal === true ? "yes" : "no"} |
| Lighthouse comparison | ${source.evidence?.lighthouseComparison === true ? "yes" : "no"} |
| Manual checklist | ${source.evidence?.manualChecklist === true ? "yes" : "no"} |
| Representative states | ${markdownCell(representativeStates)} |
`;
}

function formatCountMap(value: Record<string, number> | undefined): string {
  const entries = Object.entries(value || {});
  return entries.length > 0
    ? entries.map(([key, count]) => `${key}: ${count}`).join(", ")
    : "none";
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
}

async function ensureEmptyOutput(outputDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(outputDir);
    if (entries.length > 0) {
      throw new Error(`Share output directory must be empty: ${outputDir}`);
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await fs.mkdir(outputDir, { recursive: true });
      return;
    }
    throw error;
  }
}

function isA11yReport(value: unknown): value is A11yReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<A11yReport>;
  return typeof report.generatedAt === "string" &&
    Boolean(report.summary) &&
    Array.isArray(report.issues);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
