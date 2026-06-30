import type { Command } from "commander";
import { runEslintAdapter } from "../adapters/eslintAdapter.js";
import { runExplorePlaywrightAdapter, writeExplorationGraph } from "../adapters/explorePlaywrightAdapter.js";
import { runKeyboardPlaywrightAdapter } from "../adapters/keyboardPlaywrightAdapter.js";
import { runLighthouseAdapter } from "../adapters/lighthouseAdapter.js";
import { loadConfig } from "../config/loadConfig.js";
import { createManualChecklist } from "../core/manualChecklist.js";
import { filterReportFindings } from "../core/findingFilter.js";
import { dedupeIssues } from "../core/dedupe.js";
import { readScopePlanIfExists } from "../core/scopePlan.js";
import { detectFramework } from "../core/detectFramework.js";
import { applyIgnores, DEFAULT_IGNORE_FILE } from "../core/ignore.js";
import { normalizeIssue } from "../core/normalize.js";
import { applyRemediationTracking, DEFAULT_REMEDIATION_FILE } from "../core/remediationTracking.js";
import { triageIssues } from "../core/severity.js";
import { resolveStandard } from "../core/standards.js";
import { cleanExploreArtifacts } from "../reporters/cleanExploreArtifacts.js";
import { writeExplorationHtml } from "../reporters/writeExplorationHtml.js";
import { writeExplorationPdf } from "../reporters/writeExplorationPdf.js";
import { writeReports } from "../reporters/writeReports.js";
import type { ComplianceStandard, Framework, Issue, KeyboardAuditResult, LighthouseAuditResult, Severity } from "../types.js";
import { filterByWcagConformance, shouldFail } from "./check.js";

interface AuditOptions {
  cwd?: string;
  config?: string;
  framework?: string;
  url: string;
  withLighthouse?: boolean;
  out?: string;
  depth?: string;
  limit?: string;
  actionsPerState?: string;
  maxTabs?: string;
  failOn?: Severity | "none";
  standard?: string;
  wcagOnly?: boolean;
  keyboard?: boolean;
  manualReview?: boolean;
  activation?: boolean;
  screenshots?: boolean;
  screenshotRedaction?: boolean;
  screenshotFullPage?: boolean;
  waitMs?: string;
  waitForSelector?: string;
  scroll?: boolean;
  scrollStep?: string;
  scrollMaxSteps?: string;
  scrollWaitMs?: string;
  excel?: boolean;
  pdf?: boolean;
  raw?: boolean;
  ignore?: boolean;
  ignoreFile?: string;
  remediationTracking?: boolean;
  remediationFile?: string;
  quiet?: boolean;
}

export function registerAuditCommand(program: Command): void {
  program
    .command("audit")
    .description("Create one visual accessibility report with static, dynamic, keyboard, and manual-review evidence.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .requiredOption("--url <url>", "Start URL for the running application")
    .option("--with-lighthouse", "Add optional Lighthouse accessibility score comparison")
    .option("--out <dir>", "Output directory", "reports")
    .option("--depth <depth>", "Maximum interaction depth", "2")
    .option("--limit <limit>", "Maximum UI states", "20")
    .option("--actions-per-state <limit>", "Maximum safe actions per state", "8")
    .option("--max-tabs <count>", "Maximum Tab presses for keyboard traversal", "40")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--standard <standard>", "wcag22-aa, ada-title-ii, or section508")
    .option("--wcag-only", "Only report findings mapped to WCAG; exclude best practices and unmapped review signals")
    .option("--no-keyboard", "Skip the bounded keyboard focus traversal")
    .option("--no-manual-review", "Do not embed the manual review checklist")
    .option("--activation", "Add isolated safe Enter, Space, Escape, and arrow-key checks")
    .option("--no-screenshots", "Do not capture visual state screenshots")
    .option("--no-screenshot-redaction", "Do not mask sensitive form fields in screenshots")
    .option("--screenshot-full-page", "Force full-page screenshots instead of automatic error-region crops")
    .option("--wait-ms <ms>", "Extra settle time before screenshots and scans")
    .option("--wait-for-selector <selector>", "Wait for a selector before screenshots and scans")
    .option("--no-scroll", "Do not auto-scroll each explored state before scanning")
    .option("--scroll-step <px>", "Pixels per auto-scroll step before scanning a state")
    .option("--scroll-max-steps <count>", "Maximum auto-scroll steps per explored state")
    .option("--scroll-wait-ms <ms>", "Wait after each auto-scroll step")
    .option("--excel", "Add structured summary, page, rule, and finding CSV tables")
    .option("--pdf", "Add a11y-report.pdf")
    .option("--raw", "Add exploration-graph.json for debugging")
    .option("--ignore-file <file>", "Scoped ignore file path", DEFAULT_IGNORE_FILE)
    .option("--no-ignore", "Disable scoped ignores")
    .option("--remediation-file <file>", "Remediation status file path", DEFAULT_REMEDIATION_FILE)
    .option("--no-remediation-tracking", "Do not apply remediation statuses")
    .option("--quiet", "Suppress console summary")
    .action(async (options: AuditOptions) => {
      const result = await runAudit(options);
      if (result.failed) process.exitCode = 1;
    });
}

export async function runAudit(options: AuditOptions): Promise<{ failed: boolean; outputDir: string }> {
  const startedAt = Date.now();
  const config = await loadConfig({ cwd: options.cwd, config: options.config }, {
    framework: toFramework(options.framework),
    outputDir: options.out,
    standard: toStandard(options.standard),
    failOn: options.failOn,
    dynamic: { enabled: true, urls: [options.url] },
    explore: {
      waitMs: optionalNonNegativeInteger(options.waitMs, "Wait time"),
      waitForSelector: options.waitForSelector,
      scroll: {
        enabled: options.scroll === false ? false : undefined,
        stepPx: optionalPositiveInteger(options.scrollStep, "Scroll step"),
        maxSteps: optionalPositiveInteger(options.scrollMaxSteps, "Scroll maximum steps"),
        waitMs: optionalNonNegativeInteger(options.scrollWaitMs, "Scroll wait time")
      }
    }
  });
  const framework = config.framework === "auto" ? await detectFramework(config.cwd) : config.framework;
  const standard = resolveStandard(config.standard);
  const plannedScope = await readScopePlanIfExists(config.cwd);
  const effectiveConfig = {
    ...config,
    framework,
    wcagVersion: standard.wcagVersion,
    wcagLevel: standard.wcagLevel
  };
  await cleanExploreArtifacts(effectiveConfig.outputDir);

  const keyboardPromise: Promise<{ result?: KeyboardAuditResult; issues: Issue[] }> = options.keyboard === false
    ? Promise.resolve({ issues: [] })
    : runKeyboardPlaywrightAdapter({
      url: options.url,
      framework,
      maxTabs: boundedInteger(options.maxTabs, 40, 1, 200),
      waitMs: effectiveConfig.explore.waitMs,
      activation: Boolean(options.activation),
      maxActivations: 6,
      safeMode: effectiveConfig.explore.safeMode
    }).then((result) => ({ result, issues: [] })).catch((error: unknown) => ({
      issues: [createAuditAdapterIssue(framework, options.url, "keyboard", error)]
    }));
  const lighthousePromise: Promise<{ results: LighthouseAuditResult[]; issues: Issue[] }> = !options.withLighthouse
    ? Promise.resolve({ results: [], issues: [] })
    : runLighthouseAdapter({ url: options.url })
      .then((result) => ({ results: [result], issues: [] }))
      .catch((error: unknown) => ({
        results: [],
        issues: [createAuditAdapterIssue(framework, options.url, "lighthouse", error)]
      }));

  const [staticIssues, exploration, keyboardOutcome, lighthouseOutcome] = await Promise.all([
    runEslintAdapter(effectiveConfig),
    runExplorePlaywrightAdapter(effectiveConfig, {
      url: options.url,
      outputDir: effectiveConfig.outputDir,
      maxDepth: boundedInteger(options.depth, 2, 1, 5),
      maxStates: boundedInteger(options.limit, 20, 1, 100),
      maxActionsPerState: boundedInteger(options.actionsPerState, 8, 1, 30),
      screenshots: options.screenshots !== false,
      screenshotRedaction: options.screenshotRedaction !== false,
      screenshotFullPage: Boolean(options.screenshotFullPage),
      waitMs: effectiveConfig.explore.waitMs,
      waitForSelector: effectiveConfig.explore.waitForSelector,
      scroll: effectiveConfig.explore.scroll,
      safeMode: effectiveConfig.explore.safeMode
    }),
    keyboardPromise,
    lighthousePromise
  ]);
  const keyboard = keyboardOutcome.result;
  const lighthouse = lighthouseOutcome.results;

  // Browser evidence comes first so a duplicate static finding cannot replace
  // its state, screenshot, and element bounds in the unified visual report.
  const rawIssues = [
    ...exploration.issues,
    ...staticIssues,
    ...(keyboard?.issues || []),
    ...keyboardOutcome.issues,
    ...lighthouseOutcome.issues
  ];
  const normalized = rawIssues.map(normalizeIssue);
  const triaged = triageIssues(normalized);
  const filtered = filterByWcagConformance(triaged, {
    level: standard.wcagLevel,
    version: standard.wcagVersion,
    includeUnmapped: true
  });
  const uniqueIssues = dedupeIssues(filterReportFindings(filtered, { wcagOnly: options.wcagOnly }));
  const ignoreResult = await applyIgnores(uniqueIssues, {
    cwd: effectiveConfig.cwd,
    enabled: options.ignore !== false,
    ignoreFile: options.ignoreFile
  });
  const remediationResult = await applyRemediationTracking(ignoreResult.issues, {
    cwd: effectiveConfig.cwd,
    enabled: options.remediationTracking !== false,
    file: options.remediationFile
  });
  const urls = [...new Set(exploration.graph.states.map((state) => state.url))];
  const manualChecklist = options.manualReview === false
    ? undefined
    : createManualChecklist({
      framework,
      urls,
      issues: remediationResult.issues,
      exploration: exploration.graph
    });
  const formats = options.excel ? ["json", "markdown", "csv"] as const : ["json", "markdown"] as const;
  const report = await writeReports(effectiveConfig.outputDir, remediationResult.issues, {
    framework,
    cwd: effectiveConfig.cwd,
    urls,
    plannedScope,
    standard,
    ignore: ignoreResult.summary,
    remediationTracking: remediationResult.summary,
    lighthouse: lighthouse.length > 0 ? lighthouse : undefined,
    scanDurationMs: Date.now() - startedAt,
    rawCount: rawIssues.length,
    uniqueCount: ignoreResult.issues.length,
    duplicateCount: filtered.length - uniqueIssues.length
  }, {
    formats: [...formats],
    legacyMetrics: false,
    frameworkExample: config.framework === "auto" || config.framework === "unknown" ? undefined : config.framework,
    exploration: exploration.graph,
    keyboard,
    manualChecklist
  });

  if (options.raw) await writeExplorationGraph(effectiveConfig.outputDir, exploration.graph);
  await writeExplorationHtml(effectiveConfig.outputDir, exploration.graph, report.issues, {
    fileName: "a11y-report.html",
    title: "Accessibility Audit Report",
    keyboard,
    manualChecklist,
    lighthouse,
    plannedScope
  });
  if (options.pdf) await writeExplorationPdf(effectiveConfig.outputDir, "a11y-report");

  if (!options.quiet) {
    console.log([
      "a11y-shiftleft audit",
      `Findings: ${report.summary.total} | critical ${report.summary.critical} | warning ${report.summary.warning} | info ${report.summary.info}`,
      `States: ${exploration.graph.summary.statesVisited} | keyboard steps ${keyboard?.steps.length || 0}`,
      options.withLighthouse ? `Lighthouse: ${lighthouse[0]?.accessibilityScore ?? "not available"}` : "Lighthouse: not requested",
      `Open: ${effectiveConfig.outputDir}/a11y-report.html`,
      options.excel ? `Excel tables: ${effectiveConfig.outputDir}/a11y-summary.csv, a11y-pages.csv, a11y-rules.csv, a11y-findings.csv` : "Excel tables: not requested (add --excel)"
    ].join("\n"));
  }

  return { failed: shouldFail(report.summary, config.failOn), outputDir: effectiveConfig.outputDir };
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer from ${minimum} to ${maximum}, received ${value}.`);
  }
  return parsed;
}

function optionalPositiveInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function optionalNonNegativeInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer.`);
  return parsed;
}

function toFramework(value: string | undefined): Framework | undefined {
  if (value === "react" || value === "vue" || value === "angular" || value === "auto" || value === "unknown") return value;
  return undefined;
}

function toStandard(value: string | undefined): ComplianceStandard | undefined {
  if (value === "wcag22-aa" || value === "ada-title-ii" || value === "section508") return value;
  return undefined;
}

function createAuditAdapterIssue(
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
    message: `${adapter} audit failed: ${message}`
  };
}
