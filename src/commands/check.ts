import type { Command } from "commander";
import { loadConfig } from "../config/loadConfig.js";
import { runEslintAdapter } from "../adapters/eslintAdapter.js";
import { runAxePlaywrightAdapter } from "../adapters/axePlaywrightAdapter.js";
import type { AxeProgressEvent } from "../adapters/axePlaywrightAdapter.js";
import { runLighthouseAdapter } from "../adapters/lighthouseAdapter.js";
import { normalizeIssue } from "../core/normalize.js";
import { dedupeIssues } from "../core/dedupe.js";
import { triageIssues } from "../core/severity.js";
import { writeReports } from "../reporters/writeReports.js";
import { detectFramework } from "../core/detectFramework.js";
import { matchesWcagLevel, matchesWcagVersion } from "../core/wcagMap.js";
import { resolveStandard } from "../core/standards.js";
import { applyBaseline } from "../core/baseline.js";
import { applyRetest } from "../core/retest.js";
import { applyRemediationTracking, DEFAULT_REMEDIATION_FILE } from "../core/remediationTracking.js";
import { applyIgnores, DEFAULT_IGNORE_FILE } from "../core/ignore.js";
import { applyReportRetention } from "../core/reportRetention.js";
import { filterReportFindings } from "../core/findingFilter.js";
import type { A11yReport, ComplianceStandard, Framework, Issue, LighthouseAuditResult, ReportFormat, ReportSummary, Severity, TriagedIssue, WcagLevel, WcagVersion } from "../types.js";

export interface CheckOptions {
  cwd?: string;
  config?: string;
  framework?: string;
  static?: boolean;
  dynamic?: boolean;
  withLighthouse?: boolean;
  url?: string[];
  crawl?: boolean;
  crawlDepth?: string;
  crawlLimit?: string;
  scroll?: boolean;
  scrollStep?: string;
  scrollMaxSteps?: string;
  scrollWaitMs?: string;
  include?: string[];
  format?: string[];
  out?: string;
  failOn?: Severity | "none";
  standard?: string;
  wcagFilter?: string;
  wcagVersion?: string;
  wcagOnly?: boolean;
  semiAuto?: boolean;
  baseline?: boolean;
  baselineFile?: string;
  updateBaseline?: boolean;
  retest?: string;
  remediationTracking?: boolean;
  remediationFile?: string;
  ignore?: boolean;
  ignoreFile?: string;
  retention?: boolean;
  retentionMaxRuns?: string;
  retentionMaxAgeDays?: string;
  retentionDryRun?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  jsonSummary?: boolean;
}

interface CheckModeOptions {
  staticRequested?: boolean;
  dynamicRequested?: boolean;
  hasDynamicInput?: boolean;
  configDynamicEnabled?: boolean;
}

export interface CheckResult {
  report: A11yReport;
  failed: boolean;
}

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("Run static and/or dynamic accessibility checks.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .option("--static", "Run static checks only")
    .option("--dynamic", "Run dynamic checks only")
    .option("--with-lighthouse", "Also collect optional Lighthouse accessibility score and audit recommendations")
    .option("--url <urls...>", "Target URL(s) for dynamic scan")
    .option("--crawl", "Discover and scan same-origin links from dynamic URLs")
    .option("--crawl-depth <depth>", "Maximum same-origin crawl depth", "1")
    .option("--crawl-limit <limit>", "Maximum discovered URLs to scan", "10")
    .option("--no-scroll", "Do not auto-scroll pages before dynamic scans")
    .option("--scroll-step <px>", "Pixels per auto-scroll step before dynamic scans")
    .option("--scroll-max-steps <count>", "Maximum auto-scroll steps per page")
    .option("--scroll-wait-ms <ms>", "Wait after each auto-scroll step")
    .option("--include <patterns...>", "Static file globs to scan")
    .option("--format <formats...>", "Report formats: json, csv, markdown, or all")
    .option("--out <dir>", "Output directory")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, or section508")
    .option("--wcag-filter <level>", "Only report findings mapped to WCAG level A, AA, or AAA")
    .option("--wcag-version <version>", "Limit mapped findings to WCAG version 2.0, 2.1, or 2.2")
    .option("--wcag-only", "Only report findings mapped to WCAG; exclude best practices and unmapped review signals")
    .option("--semi-auto", "Generate a Markdown manual review checklist alongside automated reports")
    .option("--baseline", "Compare against .a11y-baseline.json and fail only on new findings")
    .option("--baseline-file <file>", "Baseline file path")
    .option("--update-baseline", "Overwrite the baseline file with the current findings")
    .option("--retest <report>", "Compare with a previous report file or directory and fail only on new findings")
    .option("--remediation-file <file>", "Remediation status file path", DEFAULT_REMEDIATION_FILE)
    .option("--no-remediation-tracking", "Do not apply remediation statuses to findings")
    .option("--ignore-file <file>", "Scoped ignore file path", DEFAULT_IGNORE_FILE)
    .option("--no-ignore", "Disable a11y-ignore.json filtering")
    .option("--retention-max-runs <count>", "Keep at most this many report run directories including the current output")
    .option("--retention-max-age-days <days>", "Remove report run directories older than this many days")
    .option("--retention-dry-run", "Preview report retention cleanup without deleting old runs")
    .option("--no-retention", "Disable report retention cleanup")
    .option("--quiet", "Suppress console summary output")
    .option("--verbose", "Print scan mode, adapter timing, and report context before the summary")
    .option("--json-summary", "Print the machine-readable JSON summary to stdout")
    .action(async (options: CheckOptions) => {
      const result = await runCheck(options);
      if (result.failed) process.exitCode = 1;
    });
}

export async function runCheck(options: CheckOptions = {}): Promise<CheckResult> {
  if (options.retest && (options.baseline || options.updateBaseline)) {
    throw new Error("Use either --retest or baseline mode, not both.");
  }

  const startedAt = Date.now();
  const urls = parseUrls(options.url);
  const staticOnly = Boolean(options.static && !options.dynamic);
  const config = await loadConfig({
    cwd: options.cwd,
    config: options.config
  }, {
    framework: toFramework(options.framework),
    outputDir: options.out,
    standard: toComplianceStandard(options.standard),
    wcagVersion: toWcagVersion(options.wcagVersion),
    failOn: options.failOn,
    static: {
      include: options.include
    },
    dynamic: {
      enabled: !staticOnly && (options.dynamic || urls.length > 0 || options.crawl) ? true : undefined,
      urls: urls.length > 0 ? urls : undefined,
      crawl: options.crawl ? true : undefined,
      crawlDepth: toPositiveInteger(options.crawlDepth),
      crawlLimit: toPositiveInteger(options.crawlLimit),
      scroll: {
        enabled: options.scroll === false ? false : undefined,
        stepPx: toPositiveInteger(options.scrollStep),
        maxSteps: toPositiveInteger(options.scrollMaxSteps),
        waitMs: toNonNegativeInteger(options.scrollWaitMs)
      }
    },
    retention: {
      enabled: retentionRequested(options),
      maxRuns: toPositiveInteger(options.retentionMaxRuns),
      maxAgeDays: toPositiveInteger(options.retentionMaxAgeDays),
      dryRun: options.retentionDryRun ? true : undefined
    }
  });

  const { runStatic, runDynamic } = resolveCheckModes({
    staticRequested: Boolean(options.static),
    dynamicRequested: Boolean(options.dynamic),
    hasDynamicInput: urls.length > 0 || Boolean(options.crawl),
    configDynamicEnabled: config.dynamic.enabled
  });
  const standard = resolveStandard(config.standard);
  const framework = config.framework === "auto"
    ? await detectFramework(config.cwd)
    : config.framework;
  const effectiveConfig = {
    ...config,
    framework,
    wcagVersion: options.wcagVersion ? config.wcagVersion : standard.wcagVersion,
    wcagLevel: standard.wcagLevel
  };

  const rawIssues = [];
  const lighthouseResults: LighthouseAuditResult[] = [];
  const adapterRuns: AdapterRunSummary[] = [];
  const progressEnabled = shouldPrintCheckProgress(options);

  if (runStatic && effectiveConfig.static.enabled) {
    const adapterStartedAt = Date.now();
    const issues = await runEslintAdapter(effectiveConfig);
    adapterRuns.push({
      name: "static",
      enabled: true,
      issueCount: issues.length,
      durationMs: Date.now() - adapterStartedAt
    });
    rawIssues.push(...issues);
  } else {
    adapterRuns.push({
      name: "static",
      enabled: false,
      issueCount: 0,
      durationMs: 0
    });
  }

  if (runDynamic && effectiveConfig.dynamic.enabled !== false) {
    const adapterStartedAt = Date.now();
    const issues = await runAxePlaywrightAdapter(effectiveConfig, {
      onProgress: (event) => {
        if (!progressEnabled) return;
        console.log(formatCheckProgressMessage(event));
      }
    });
    adapterRuns.push({
      name: "dynamic",
      enabled: true,
      issueCount: issues.length,
      durationMs: Date.now() - adapterStartedAt
    });
    rawIssues.push(...issues);
  } else {
    adapterRuns.push({
      name: "dynamic",
      enabled: false,
      issueCount: 0,
      durationMs: 0
    });
  }

  if (options.withLighthouse) {
    if (effectiveConfig.dynamic.urls.length === 0) {
      throw new Error("--with-lighthouse requires at least one --url.");
    }

    const adapterStartedAt = Date.now();
    for (const url of effectiveConfig.dynamic.urls) {
      try {
        lighthouseResults.push(await runLighthouseAdapter({ url }));
      } catch (error) {
        rawIssues.push(createCheckAdapterIssue(framework, url, "lighthouse", error));
      }
    }
    adapterRuns.push({
      name: "lighthouse",
      enabled: true,
      issueCount: lighthouseResults.reduce((total, result) => total + result.failedAudits.length, 0),
      durationMs: Date.now() - adapterStartedAt
    });
  } else {
    adapterRuns.push({
      name: "lighthouse",
      enabled: false,
      issueCount: 0,
      durationMs: 0
    });
  }

  const normalized = rawIssues.map(normalizeIssue);
  const triaged = triageIssues(normalized);
  const explicitWcagFilter = toWcagLevel(options.wcagFilter);
  const filtered = filterByWcagConformance(triaged, {
    level: explicitWcagFilter || effectiveConfig.wcagLevel,
    version: effectiveConfig.wcagVersion,
    includeUnmapped: !explicitWcagFilter
  });
  const uniqueIssues = dedupeIssues(filterReportFindings(filtered, { wcagOnly: options.wcagOnly }));
  const ignoreResult = await applyIgnores(uniqueIssues, {
    cwd: effectiveConfig.cwd,
    enabled: options.ignore !== false,
    ignoreFile: options.ignoreFile
  });
  const remediationResult = await applyRemediationTracking(ignoreResult.issues, {
    cwd: effectiveConfig.cwd,
    file: options.remediationFile,
    enabled: options.remediationTracking !== false
  });
  const baselineEnabled = Boolean(options.baseline || options.updateBaseline);
  const baselineResult = baselineEnabled
    ? await applyBaseline(remediationResult.issues, {
      cwd: effectiveConfig.cwd,
      baselineFile: options.baselineFile,
      update: Boolean(options.updateBaseline)
    })
    : undefined;
  const retestResult = options.retest
    ? await applyRetest(remediationResult.issues, {
      cwd: effectiveConfig.cwd,
      previous: options.retest
    })
    : undefined;
  const reportIssues = baselineResult?.issues || retestResult?.issues || remediationResult.issues;
  const formats = parseFormats(options.format);
  const retentionSummary = await applyReportRetention(effectiveConfig.outputDir, effectiveConfig.retention);
  const report = await writeReports(effectiveConfig.outputDir, reportIssues, {
    framework,
    cwd: effectiveConfig.cwd,
    urls: runDynamic ? effectiveConfig.dynamic.urls : [],
    standard: {
      ...standard,
      wcagVersion: effectiveConfig.wcagVersion,
      wcagLevel: effectiveConfig.wcagLevel
    },
    baseline: baselineResult?.summary,
    retest: retestResult?.summary,
    remediationTracking: remediationResult.summary,
    ignore: ignoreResult.summary,
    retention: retentionSummary.enabled ? retentionSummary : undefined,
    lighthouse: lighthouseResults.length > 0 ? lighthouseResults : undefined,
    scanDurationMs: Date.now() - startedAt,
    rawCount: rawIssues.length,
    uniqueCount: ignoreResult.issues.length,
    duplicateCount: filtered.length - uniqueIssues.length
  }, {
    formats,
    frameworkExample: config.framework === "auto" || config.framework === "unknown" ? undefined : config.framework,
    semiAuto: Boolean(options.semiAuto)
  });

  if (!options.quiet) {
    if (options.verbose) {
      console.log(formatVerboseCheckSummary({
        framework,
        runStatic,
        runDynamic,
        adapterRuns,
        urls: runDynamic ? effectiveConfig.dynamic.urls : [],
        outputDir: effectiveConfig.outputDir,
        formats,
        baselineEnabled,
        baselineFile: options.baselineFile || ".a11y-baseline.json",
        ignoreEnabled: Boolean(ignoreResult.summary?.enabled),
        ignoreFile: options.ignoreFile || DEFAULT_IGNORE_FILE,
        ignoredIssues: ignoreResult.summary?.ignoredIssues || 0,
        updateBaseline: Boolean(options.updateBaseline),
        standard: effectiveConfig.standard,
        wcagVersion: effectiveConfig.wcagVersion,
        wcagLevel: effectiveConfig.wcagLevel,
        crawl: Boolean(effectiveConfig.dynamic.crawl),
        crawlDepth: effectiveConfig.dynamic.crawlDepth,
        crawlLimit: effectiveConfig.dynamic.crawlLimit,
        scrollEnabled: effectiveConfig.dynamic.scroll.enabled,
        scrollStepPx: effectiveConfig.dynamic.scroll.stepPx,
        scrollMaxSteps: effectiveConfig.dynamic.scroll.maxSteps,
        scrollWaitMs: effectiveConfig.dynamic.scroll.waitMs,
        retentionEnabled: retentionSummary.enabled,
        retentionDryRun: retentionSummary.dryRun,
        retentionPlannedDeletedRuns: retentionSummary.plannedDeletedRuns,
        retentionDeletedRuns: retentionSummary.deletedRuns,
        lighthouseEnabled: Boolean(options.withLighthouse)
      }));
    }

    const summaryOutput = shouldPrintJsonSummary(options)
      ? JSON.stringify(report.summary, null, 2)
      : formatCheckConsoleSummary(report, {
        outputDir: effectiveConfig.outputDir,
        formats,
        semiAuto: Boolean(options.semiAuto),
        color: Boolean(process.stdout.isTTY && !process.env.NO_COLOR)
      });

    console.log(summaryOutput);
  }

  return {
    report,
    failed: shouldFail(report.summary, config.failOn)
  };
}

export function resolveCheckModes({
  staticRequested = false,
  dynamicRequested = false,
  hasDynamicInput = false,
  configDynamicEnabled = false
}: CheckModeOptions): { runStatic: boolean; runDynamic: boolean } {
  if (staticRequested && !dynamicRequested) {
    return {
      runStatic: true,
      runDynamic: false
    };
  }

  if (dynamicRequested && !staticRequested) {
    return {
      runStatic: false,
      runDynamic: true
    };
  }

  return {
    runStatic: true,
    runDynamic: dynamicRequested || hasDynamicInput || configDynamicEnabled
  };
}

export interface AdapterRunSummary {
  name: "static" | "dynamic" | "lighthouse";
  enabled: boolean;
  issueCount: number;
  durationMs: number;
}

export function formatVerboseCheckSummary(options: {
  framework: Framework;
  runStatic: boolean;
  runDynamic: boolean;
  adapterRuns: AdapterRunSummary[];
  urls: string[];
  outputDir: string;
  formats: ReportFormat[];
  baselineEnabled: boolean;
  baselineFile: string;
  ignoreEnabled: boolean;
  ignoreFile: string;
  ignoredIssues: number;
  updateBaseline: boolean;
  standard: ComplianceStandard;
  wcagVersion: WcagVersion;
  wcagLevel: WcagLevel;
  crawl?: boolean;
  crawlDepth?: number;
  crawlLimit?: number;
  scrollEnabled?: boolean;
  scrollStepPx?: number;
  scrollMaxSteps?: number;
  scrollWaitMs?: number;
  retentionEnabled: boolean;
  retentionDryRun: boolean;
  retentionPlannedDeletedRuns: number;
  retentionDeletedRuns: number;
  lighthouseEnabled?: boolean;
}): string {
  const adapterLines = options.adapterRuns.map((run) => {
    const status = run.enabled ? "enabled" : "skipped";
    return `  - ${run.name}: ${status}, findings=${run.issueCount}, duration=${run.durationMs}ms`;
  });
  const urls = options.urls.length > 0 ? options.urls.join(", ") : "none";
  const crawl = options.crawl
    ? `enabled depth=${options.crawlDepth || 1} limit=${options.crawlLimit || 10}`
    : "disabled";
  const scroll = options.scrollEnabled
    ? `enabled step=${options.scrollStepPx}px maxSteps=${options.scrollMaxSteps} wait=${options.scrollWaitMs}ms`
    : "disabled";
  const baseline = options.baselineEnabled
    ? `enabled file=${options.baselineFile}${options.updateBaseline ? " update=true" : ""}`
    : "disabled";
  const ignore = options.ignoreEnabled
    ? `enabled file=${options.ignoreFile} ignored=${options.ignoredIssues}`
    : "disabled";
  const retention = options.retentionEnabled
    ? options.retentionDryRun
      ? `dry-run plannedDeletedRuns=${options.retentionPlannedDeletedRuns}`
      : `enabled deletedRuns=${options.retentionDeletedRuns}`
    : "disabled";

  return [
    "a11y-shiftleft check",
    `framework: ${options.framework}`,
    `modes: static=${options.runStatic ? "on" : "off"}, dynamic=${options.runDynamic ? "on" : "off"}`,
    `urls: ${urls}`,
    `crawl: ${crawl}`,
    `scroll: ${scroll}`,
    `lighthouse: ${options.lighthouseEnabled ? "enabled" : "disabled"}`,
    `standard: ${options.standard}`,
    `wcag: ${options.wcagVersion} ${options.wcagLevel}`,
    `baseline: ${baseline}`,
    `ignore: ${ignore}`,
    `retention: ${retention}`,
    `output: ${options.outputDir}`,
    `formats: ${options.formats.join(", ")}`,
    "adapters:",
    ...adapterLines
  ].join("\n");
}

function createCheckAdapterIssue(
  framework: Framework,
  url: string,
  adapter: string,
  error: unknown
): Issue {
  const message = error instanceof Error ? error.message : String(error);
  return {
    source: adapter,
    framework,
    ruleId: `adapter/${adapter}-scan-error`,
    severity: "warning",
    url,
    message: `${adapter} check failed: ${message}`
  };
}

export function formatCheckConsoleSummary(
  report: A11yReport,
  options: {
    outputDir: string;
    formats: ReportFormat[];
    semiAuto?: boolean;
    color?: boolean;
  }
): string {
  const summary = report.summary;
  const status = summary.total === 0
    ? "No automated findings detected"
    : "Accessibility findings detected";
  const files = reportFiles(options.outputDir, options.formats, Boolean(options.semiAuto));
  const topRules = topRuleCounts(report, 5);
  const topPages = (summary.byPage || []).slice(0, 3);
  const primaryReport = primaryReportPath(options.outputDir, options.formats);
  const standard = summary.standard
    ? `${summary.standard.label} (${summary.standard.wcagVersion} ${summary.standard.wcagLevel})`
    : "WCAG 2.2 Level AA support mode";
  const retest = summary.retest?.enabled
    ? `Retest: fixed ${summary.retest.fixedIssues} | remaining ${summary.retest.remainingIssues} | new ${summary.retest.newIssues}`
    : undefined;
  const remediation = summary.remediationTracking?.enabled
    ? `Remediation: tracked ${summary.remediationTracking.matchedIssues} | stale ${summary.remediationTracking.staleEntries} | invalid ${summary.remediationTracking.invalidEntries}`
    : undefined;
  const lighthouse = summary.lighthouse?.enabled
    ? `Lighthouse: avg score ${summary.lighthouse.averageAccessibilityScore ?? "n/a"} | failed audits ${summary.lighthouse.failedAuditCount} | manual audits ${summary.lighthouse.manualAuditCount}`
    : undefined;

  return [
    "a11y-shiftleft check",
    `Status: ${status}`,
    `Findings: total ${summary.total} | ${severityLabel("critical", summary.critical, options.color)} | ${severityLabel("warning", summary.warning, options.color)} | ${severityLabel("info", summary.info, options.color)}`,
    `Framework: ${summary.framework}`,
    `Standard: ${standard}`,
    `Sources: ${formatCountMap(summary.bySource)}`,
    `Confidence: ${formatCountMap(summary.byConfidence)}`,
    `Color-scheme findings: ${formatCountMap(summary.byColorScheme)}`,
    `WCAG levels: ${formatCountMap(summary.byWcagLevel)}`,
    `Duplicates removed: ${summary.duplicateCount} of ${summary.rawCount} raw findings`,
    ...(retest ? [retest] : []),
    ...(remediation ? [remediation] : []),
    ...(lighthouse ? [lighthouse] : []),
    `Duration: ${summary.scanDurationMs}ms`,
    "",
    "Top rules:",
    ...formatList(topRules.map(([ruleId, count]) => `${ruleId}: ${count}`), "No rule findings."),
    "",
    "Top pages:",
    ...formatList(topPages.map((page) => `${page.url}: ${page.total} findings, score ${page.severityScore}`), "No page-level findings."),
    "",
    "Reports:",
    ...files.map((file) => `  - ${file}`),
    "",
    "Next:",
    `  - Open ${primaryReport} for the generated report.`,
    "  - Use --semi-auto when you need the manual review checklist.",
    "  - Use --json-summary when a script needs the stdout summary as JSON."
  ].join("\n");
}

export function formatCheckProgressMessage(event: AxeProgressEvent): string {
  if (event.type === "crawl") {
    return `[check] crawl discovered ${event.discoveredCount}/${event.maxUrls} depth=${event.depth} queued=${event.queuedCount} ${event.url}`;
  }

  if (event.type === "scan-start") {
    return `[check] scan ${event.scannedCount}/${event.totalUrls} ${event.url}`;
  }

  if (event.type === "scan-complete") {
    return `[check] scan ${event.scannedCount}/${event.totalUrls} done issues=${event.issueCount} ${event.url}`;
  }

  return `[check] scan ${event.scannedCount}/${event.totalUrls} failed ${event.url}: ${event.message}`;
}

function shouldPrintCheckProgress(options: Pick<CheckOptions, "quiet" | "jsonSummary">): boolean {
  return Boolean(!options.quiet && !options.jsonSummary && process.stdout.isTTY && !process.env.CI);
}

function shouldPrintJsonSummary(options: Pick<CheckOptions, "jsonSummary">): boolean {
  return Boolean(options.jsonSummary || process.env.CI || !process.stdout.isTTY);
}

function reportFiles(outputDir: string, formats: ReportFormat[], semiAuto: boolean): string[] {
  const files = [];

  if (formats.includes("markdown")) files.push(joinOutputPath(outputDir, "a11y-comment.md"));
  if (formats.includes("json")) files.push(joinOutputPath(outputDir, "a11y-report.json"));
  if (formats.includes("csv")) {
    files.push(joinOutputPath(outputDir, "a11y-metrics.csv"));
    files.push(joinOutputPath(outputDir, "a11y-findings.csv"));
  }
  if (semiAuto) {
    files.push(joinOutputPath(outputDir, "a11y-manual-checklist.md"));
    files.push(joinOutputPath(outputDir, "a11y-manual-checklist.json"));
  }

  return files;
}

function primaryReportPath(outputDir: string, formats: ReportFormat[]): string {
  if (formats.includes("markdown")) return joinOutputPath(outputDir, "a11y-comment.md");
  if (formats.includes("json")) return joinOutputPath(outputDir, "a11y-report.json");
  if (formats.includes("csv")) return joinOutputPath(outputDir, "a11y-metrics.csv");
  return outputDir;
}

function topRuleCounts(report: A11yReport, limit: number): [string, number][] {
  const counts = report.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.ruleId] = (acc[issue.ruleId] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit);
}

function formatList(items: string[], fallback: string): string[] {
  if (items.length === 0) return [`  - ${fallback}`];
  return items.map((item) => `  - ${item}`);
}

function severityLabel(severity: Severity, count: number, color = false): string {
  const label = `${severity.toUpperCase()} ${count}`;
  if (!color) return label;

  if (severity === "critical") return `\u001b[31m${label}\u001b[0m`;
  if (severity === "warning") return `\u001b[33m${label}\u001b[0m`;
  return `\u001b[36m${label}\u001b[0m`;
}

function formatCountMap(counts: Record<string, number> | undefined): string {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) return "none";

  return entries
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function joinOutputPath(outputDir: string, fileName: string): string {
  if (outputDir.endsWith("/")) return `${outputDir}${fileName}`;
  return `${outputDir}/${fileName}`;
}

export function filterByWcagLevel(issues: TriagedIssue[], level?: WcagLevel): TriagedIssue[] {
  return filterByWcagConformance(issues, { level, includeUnmapped: false });
}

export function filterByWcagConformance(
  issues: TriagedIssue[],
  options: {
    level?: WcagLevel;
    version?: WcagVersion;
    includeUnmapped?: boolean;
  } = {}
): TriagedIssue[] {
  if (!options.level && !options.version) return issues;
  const includeUnmapped = options.includeUnmapped ?? !options.level;

  return issues.flatMap((issue) => {
    if (issue.wcagCriteria.length === 0) {
      return includeUnmapped ? [issue] : [];
    }

    const criteria = issue.wcagCriteria.filter((criterion) => {
      const matchesLevel = options.level
        ? matchesWcagLevel([criterion], options.level)
        : true;
      const matchesVersion = options.version
        ? matchesWcagVersion(criterion, options.version)
        : true;

      return matchesLevel && matchesVersion;
    });

    if (criteria.length === 0) return [];

    return [{
      ...issue,
      wcag: criteria.map((criterion) => criterion.id),
      wcagCriteria: criteria
    }];
  });
}

export function parseFormats(formats?: string[]): ReportFormat[] {
  if (!formats || formats.length === 0) {
    return ["json", "csv", "markdown"];
  }

  const normalized = formats
    .flatMap((format) => format.split(","))
    .map((format) => format.trim().toLowerCase())
    .filter(Boolean);

  if (normalized.includes("all")) {
    return ["json", "csv", "markdown"];
  }

  const supportedFormats = new Set(["json", "csv", "markdown"]);
  const unsupportedFormats = normalized.filter((format) => !supportedFormats.has(format));

  if (unsupportedFormats.length > 0) {
    throw new Error(`Unsupported report format: ${unsupportedFormats.join(", ")}`);
  }

  return normalized as ReportFormat[];
}

export function parseUrls(urls?: string[]): string[] {
  if (!urls || urls.length === 0) return [];

  return [...new Set(urls
    .flatMap((url) => url.split(","))
    .map((url) => url.trim())
    .filter(Boolean))];
}

export function shouldFail(
  summary: Pick<ReportSummary, "critical" | "warning" | "info" | "baseline" | "retest">,
  failOn: Severity | "none" = "critical"
): boolean {
  if (failOn === "none") return false;
  const counts = summary.retest?.enabled
    ? {
      critical: summary.retest.newCritical,
      warning: summary.retest.newWarning,
      info: summary.retest.newInfo
    }
    : summary.baseline?.enabled
    ? {
      critical: summary.baseline.newCritical,
      warning: summary.baseline.newWarning,
      info: summary.baseline.newInfo
    }
    : summary;

  if (failOn === "info") return counts.info > 0 || counts.warning > 0 || counts.critical > 0;
  if (failOn === "warning") return counts.warning > 0 || counts.critical > 0;
  return counts.critical > 0;
}

function toFramework(framework: string | undefined): Framework | undefined {
  if (
    framework === "react" ||
    framework === "vue" ||
    framework === "angular" ||
    framework === "auto" ||
    framework === "unknown"
  ) {
    return framework;
  }

  return undefined;
}

function toWcagLevel(level: string | undefined): WcagLevel | undefined {
  const normalized = level?.toUpperCase();
  if (normalized === "A" || normalized === "AA" || normalized === "AAA") return normalized;
  return undefined;
}

function toWcagVersion(version: string | undefined): WcagVersion | undefined {
  if (version === "2.0" || version === "2.1" || version === "2.2") return version;
  return undefined;
}

function toComplianceStandard(standard: string | undefined): ComplianceStandard | undefined {
  if (standard === "wcag22-aa" || standard === "ada-title-ii" || standard === "section508") return standard;
  return undefined;
}

function toPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

function toNonNegativeInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Scroll wait time must be a non-negative integer.");
  }
  return parsed;
}

function retentionRequested(options: Pick<CheckOptions, "retention" | "retentionMaxRuns" | "retentionMaxAgeDays" | "retentionDryRun">): boolean | undefined {
  if (options.retention === false) return false;
  if (options.retentionDryRun) return true;
  if (options.retentionMaxRuns || options.retentionMaxAgeDays) return true;
  return undefined;
}
