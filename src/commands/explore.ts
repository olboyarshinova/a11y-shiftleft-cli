import type { Command } from "commander";
import { runExplorePlaywrightAdapter, writeExplorationGraph, type ScreenshotFormat } from "../adapters/explorePlaywrightAdapter.js";
import { loadConfig } from "../config/loadConfig.js";
import { dedupeIssues } from "../core/dedupe.js";
import { detectFramework } from "../core/detectFramework.js";
import { normalizeIssue } from "../core/normalize.js";
import { triageIssues } from "../core/severity.js";
import { resolveStandard } from "../core/standards.js";
import { applyReportRetention } from "../core/reportRetention.js";
import { filterReportFindings } from "../core/findingFilter.js";
import { openReportFile } from "../core/openReport.js";
import { readScopePlanIfExists } from "../core/scopePlan.js";
import { cleanExploreArtifacts } from "../reporters/cleanExploreArtifacts.js";
import { writeExplorationHtml } from "../reporters/writeExplorationHtml.js";
import { writeExplorationPdf } from "../reporters/writeExplorationPdf.js";
import { writeReports } from "../reporters/writeReports.js";
import type { ReportRetentionSummary } from "../core/reportRetention.js";
import type {
  A11yReport,
  ComplianceStandard,
  ExplorationGraph,
  ExplorationState,
  Framework,
  ReportFormat,
  Severity,
  WcagLevel,
  WcagVersion
} from "../types.js";
import { filterByWcagConformance, parseFormats, shouldFail } from "./check.js";

interface ExploreOptions {
  cwd?: string;
  config?: string;
  framework?: string;
  url: string;
  scope?: string;
  depth?: string;
  maxDepth?: string;
  limit?: string;
  actionsPerState?: string;
  out?: string;
  failOn?: Severity | "none";
  standard?: string;
  wcagFilter?: string;
  wcagVersion?: string;
  wcagOnly?: boolean;
  format?: string[];
  clean?: boolean;
  html?: boolean;
  pdf?: boolean;
  screenshots?: boolean;
  screenshotFormat?: string;
  screenshotQuality?: string;
  screenshotFullPage?: boolean;
  compactScreenshots?: boolean;
  screenshotRedaction?: boolean;
  safeMode?: boolean;
  safeBlockText?: string[];
  safeBlockRole?: string[];
  safeBlockUrl?: string[];
  safeBlockSelector?: string[];
  safeAllowSelector?: string[];
  dismissDialogs?: boolean;
  isolateCookies?: boolean;
  waitMs?: string;
  waitForSelector?: string;
  scroll?: boolean;
  scrollStep?: string;
  scrollMaxSteps?: string;
  scrollWaitMs?: string;
  semiAuto?: boolean;
  retention?: boolean;
  retentionMaxRuns?: string;
  retentionMaxAgeDays?: string;
  retentionDryRun?: boolean;
  open?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  jsonSummary?: boolean;
}

type ExploreSummaryOutput = A11yReport["summary"] & {
  exploration: ExplorationGraph["summary"];
  retention?: ReportRetentionSummary;
};

export function registerExploreCommand(program: Command): void {
  program
    .command("explore")
    .description("Safely explore UI states and run dynamic accessibility checks.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .requiredOption("--url <url>", "Start URL for UI exploration")
    .option("--scope <selector>", "Limit axe checks and safe action discovery to one CSS selector")
    .option("--depth <depth>", "Maximum interaction depth", "2")
    .option("--max-depth <depth>", "Maximum interaction depth; clearer alias for --depth")
    .option("--limit <limit>", "Maximum UI states to scan", "20")
    .option("--actions-per-state <limit>", "Maximum safe actions to try per state", "8")
    .option("--out <dir>", "Output directory")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, or section508")
    .option("--wcag-filter <level>", "Only report findings mapped to WCAG level A, AA, or AAA")
    .option("--wcag-version <version>", "Limit mapped findings to WCAG version 2.0, 2.1, or 2.2")
    .option("--wcag-only", "Only report findings mapped to WCAG; exclude best practices and unmapped review signals")
    .option("--format <formats...>", "Report formats: json, csv, markdown, or all")
    .option("--no-clean", "Keep previous generated report artifacts in the output directory")
    .option("--no-html", "Do not generate exploration.html")
    .option("--pdf", "Generate exploration.pdf from the visual HTML report")
    .option("--no-screenshots", "Do not save state screenshots")
    .option("--screenshot-format <format>", "Screenshot format: jpeg or png", "jpeg")
    .option("--screenshot-quality <quality>", "JPEG screenshot quality from 1 to 100", "70")
    .option("--screenshot-full-page", "Force full-page screenshots instead of automatic error-region crops")
    .option("--compact-screenshots", "Use automatic compact evidence capture (default)")
    .option("--no-screenshot-redaction", "Do not mask sensitive fields in screenshots")
    .option("--no-safe-mode", "Disable safe-mode action blocking for exploration")
    .option("--safe-block-text <patterns...>", "Additional text patterns to skip during exploration")
    .option("--safe-block-role <patterns...>", "Additional role patterns to skip during exploration")
    .option("--safe-block-url <patterns...>", "Additional URL patterns to skip during exploration")
    .option("--safe-block-selector <selectors...>", "Additional selectors to skip during exploration")
    .option("--safe-allow-selector <selectors...>", "Selectors allowed to override form-button safety blocks")
    .option("--no-dismiss-dialogs", "Do not auto-dismiss browser dialogs during exploration")
    .option("--no-isolate-cookies", "Allow cookies to persist between explored states")
    .option("--wait-ms <ms>", "Extra settle time before screenshots and scans")
    .option("--wait-for-selector <selector>", "Wait for a selector before screenshots and scans")
    .option("--no-scroll", "Do not auto-scroll each explored state before screenshots and scans")
    .option("--scroll-step <px>", "Pixels per auto-scroll step before scanning a state")
    .option("--scroll-max-steps <count>", "Maximum auto-scroll steps per explored state")
    .option("--scroll-wait-ms <ms>", "Wait after each auto-scroll step")
    .option("--semi-auto", "Generate a Markdown manual review checklist alongside automated reports")
    .option("--retention-max-runs <count>", "Keep at most this many report run directories including the current output")
    .option("--retention-max-age-days <days>", "Remove report run directories older than this many days")
    .option("--retention-dry-run", "Preview report retention cleanup without deleting old runs")
    .option("--no-retention", "Disable report retention cleanup")
    .option("--open", "Open exploration.html after the scan finishes")
    .option("--quiet", "Suppress progress and console summary output")
    .option("--verbose", "Print exploration settings before progress and the summary")
    .option("--json-summary", "Print the machine-readable JSON summary to stdout")
    .action(async (options: ExploreOptions) => {
      const startedAt = Date.now();
      if (options.pdf && options.html === false) {
        throw new Error("PDF export requires exploration.html. Remove --no-html or omit --pdf.");
      }
      if (options.open && options.html === false) {
        throw new Error("--open requires exploration.html. Remove --no-html or omit --open.");
      }

      const config = await loadConfig({
        cwd: options.cwd,
        config: options.config
      }, {
        framework: toFramework(options.framework),
        outputDir: options.out,
        standard: toComplianceStandard(options.standard),
        wcagVersion: toWcagVersion(options.wcagVersion),
        failOn: options.failOn,
        dynamic: {
          enabled: true,
          urls: [options.url]
        },
        explore: {
          waitMs: toNonNegativeInteger(options.waitMs),
          waitForSelector: options.waitForSelector,
          scopeSelector: options.scope,
          scroll: {
            enabled: options.scroll === false ? false : undefined,
            stepPx: toPositiveInteger(options.scrollStep),
            maxSteps: toPositiveInteger(options.scrollMaxSteps),
            waitMs: parseNonNegativeInteger(options.scrollWaitMs, "Scroll wait time must be a non-negative integer.")
          },
          safeMode: {
            enabled: options.safeMode === false ? false : undefined,
            blockedText: toPatternList(options.safeBlockText),
            blockedRoles: toPatternList(options.safeBlockRole),
            blockedUrls: toPatternList(options.safeBlockUrl),
            blockedSelectors: toPatternList(options.safeBlockSelector),
            allowedSelectors: toPatternList(options.safeAllowSelector),
            dismissDialogs: options.dismissDialogs === false ? false : undefined,
            isolateCookies: options.isolateCookies === false ? false : undefined
          }
        },
        retention: {
          enabled: retentionRequested(options),
          maxRuns: toPositiveInteger(options.retentionMaxRuns),
          maxAgeDays: toPositiveInteger(options.retentionMaxAgeDays),
          dryRun: options.retentionDryRun ? true : undefined
        }
      });
      const standard = resolveStandard(config.standard);
      const framework = config.framework === "auto"
        ? await detectFramework(config.cwd)
        : config.framework;
      const plannedScope = await readScopePlanIfExists(config.cwd);
      const effectiveConfig = {
        ...config,
        framework,
        wcagVersion: options.wcagVersion ? config.wcagVersion : standard.wcagVersion,
        wcagLevel: standard.wcagLevel
      };

      if (options.clean !== false) {
        await cleanExploreArtifacts(effectiveConfig.outputDir);
      }

      const maxDepth = toPositiveInteger(resolveDepthOption(options));
      const maxStates = toPositiveInteger(options.limit);
      const maxActionsPerState = toPositiveInteger(options.actionsPerState);
      const waitMs = toNonNegativeInteger(options.waitMs) ?? effectiveConfig.explore.waitMs;
      const screenshotFormat = toScreenshotFormat(options.screenshotFormat);
      const screenshotQuality = toScreenshotQuality(options.screenshotQuality);
      const screenshotFullPage = resolveFullPageScreenshots(options);
      const formats = parseFormats(options.format);
      const progressEnabled = shouldPrintExploreProgress(options);
      let visitedStates = 0;

      if (!options.quiet && options.verbose) {
        console.log(formatVerboseExploreSummary({
          url: options.url,
          framework,
          outputDir: effectiveConfig.outputDir,
          maxDepth: maxDepth || 2,
          maxStates: maxStates || 20,
          maxActionsPerState: maxActionsPerState || 8,
          formats,
          html: options.html !== false,
          pdf: Boolean(options.pdf),
          screenshots: options.screenshots !== false,
          screenshotFormat,
          screenshotQuality: screenshotQuality || 70,
          screenshotFullPage,
          screenshotRedaction: options.screenshotRedaction !== false,
          waitMs,
          waitForSelector: effectiveConfig.explore.waitForSelector,
          scopeSelector: effectiveConfig.explore.scopeSelector,
          scrollEnabled: effectiveConfig.explore.scroll.enabled,
          scrollStepPx: effectiveConfig.explore.scroll.stepPx,
          scrollMaxSteps: effectiveConfig.explore.scroll.maxSteps,
          scrollWaitMs: effectiveConfig.explore.scroll.waitMs,
          safeModeEnabled: effectiveConfig.explore.safeMode.enabled,
          safeModeDismissDialogs: effectiveConfig.explore.safeMode.dismissDialogs,
          safeModeIsolateCookies: effectiveConfig.explore.safeMode.isolateCookies,
          safeModeBlockedText: effectiveConfig.explore.safeMode.blockedText,
          safeModeBlockedRoles: effectiveConfig.explore.safeMode.blockedRoles,
          safeModeBlockedUrls: effectiveConfig.explore.safeMode.blockedUrls,
          safeModeBlockedSelectors: effectiveConfig.explore.safeMode.blockedSelectors,
          retentionEnabled: effectiveConfig.retention.enabled,
          retentionDryRun: effectiveConfig.retention.dryRun
        }));
      }

      const exploration = await runExplorePlaywrightAdapter(effectiveConfig, {
        url: options.url,
        outputDir: effectiveConfig.outputDir,
        maxDepth,
        maxStates,
        maxActionsPerState,
        screenshots: options.screenshots,
        screenshotFormat,
        screenshotQuality,
        screenshotFullPage,
        screenshotRedaction: options.screenshotRedaction,
        waitMs,
        waitForSelector: effectiveConfig.explore.waitForSelector,
        scopeSelector: effectiveConfig.explore.scopeSelector,
        scroll: effectiveConfig.explore.scroll,
        safeMode: effectiveConfig.explore.safeMode,
        onProgress: (event) => {
          if (!progressEnabled) return;

          if (event.type === "state") {
            visitedStates += 1;
            console.log(formatExploreProgressMessage({
              type: "state",
              state: event.state,
              visitedStates,
              maxStates: maxStates || 20
            }));
          }

          if (event.type === "actions") {
            console.log(formatExploreProgressMessage({
              type: "actions",
              stateId: event.stateId,
              actionCount: event.actionCount,
              skippedActionCount: event.skippedActionCount
            }));
          }
        }
      });

      await writeExplorationGraph(effectiveConfig.outputDir, exploration.graph);

      const normalized = exploration.issues.map(normalizeIssue);
      const triaged = triageIssues(normalized);
      const explicitWcagFilter = toWcagLevel(options.wcagFilter);
      const filtered = filterByWcagConformance(triaged, {
        level: explicitWcagFilter || effectiveConfig.wcagLevel,
        version: effectiveConfig.wcagVersion,
        includeUnmapped: !explicitWcagFilter
      });
      const uniqueIssues = dedupeIssues(filterReportFindings(filtered, { wcagOnly: options.wcagOnly }));
      const retentionSummary = await applyReportRetention(effectiveConfig.outputDir, effectiveConfig.retention);
      const report = await writeReports(effectiveConfig.outputDir, uniqueIssues, {
        commandName: "explore",
        commandProfile: "visual-exploration",
        framework,
        cwd: effectiveConfig.cwd,
        urls: [...new Set(exploration.graph.states.map((state) => state.url))],
        plannedScope,
        standard: {
          ...standard,
          wcagVersion: effectiveConfig.wcagVersion,
          wcagLevel: effectiveConfig.wcagLevel
        },
        retention: retentionSummary.enabled ? retentionSummary : undefined,
        scanDurationMs: Date.now() - startedAt,
        rawCount: exploration.issues.length,
        uniqueCount: uniqueIssues.length,
        duplicateCount: filtered.length - uniqueIssues.length
      }, {
        formats,
        generatedFiles: [
          ...(options.html === false ? [] : ["exploration.html"]),
          ...(options.pdf ? ["exploration.pdf"] : []),
          "exploration-graph.json"
        ],
        frameworkExample: config.framework === "auto" || config.framework === "unknown" ? undefined : config.framework,
        exploration: exploration.graph,
        semiAuto: Boolean(options.semiAuto)
      });
      if (options.html !== false) {
        await writeExplorationHtml(effectiveConfig.outputDir, exploration.graph, report.issues, {
          plannedScope,
          auditTrail: report.summary.auditTrail,
          wcagCoverage: report.summary.wcagCoverage
        });
      }
      if (options.pdf) {
        await writeExplorationPdf(effectiveConfig.outputDir);
      }

      const visualReportPath = `${effectiveConfig.outputDir}/exploration.html`;

      if (!options.quiet) {
        const summary: ExploreSummaryOutput = {
          ...report.summary,
          exploration: exploration.graph.summary,
          retention: retentionSummary.enabled ? retentionSummary : undefined
        };
        const summaryOutput = shouldPrintExploreJsonSummary(options)
          ? JSON.stringify(summary, null, 2)
          : formatExploreConsoleSummary(report, exploration.graph, {
            outputDir: effectiveConfig.outputDir,
            formats,
            html: options.html !== false,
            pdf: Boolean(options.pdf),
            screenshots: options.screenshots !== false,
            retention: retentionSummary.enabled ? retentionSummary : undefined
          });

        console.log(summaryOutput);
      }

      if (options.open) {
        try {
          await openReportFile(visualReportPath);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Could not open the report automatically: ${message}`);
          console.warn(`Open it manually: ${visualReportPath}`);
        }
      }

      if (shouldFail(report.summary, config.failOn)) {
        process.exitCode = 1;
      }
    });
}

export function resolveDepthOption(options: Pick<ExploreOptions, "depth" | "maxDepth">): string | undefined {
  return options.maxDepth ?? options.depth;
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
  return parseNonNegativeInteger(value, "Wait time must be a non-negative integer.");
}

function parseNonNegativeInteger(value: string | undefined, message: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(message);
  }
  return parsed;
}

function toScreenshotFormat(value: string | undefined): ScreenshotFormat {
  if (value === "jpeg" || value === "png") return value;
  throw new Error("Unsupported screenshot format. Use jpeg or png.");
}

function toScreenshotQuality(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("Screenshot quality must be an integer from 1 to 100.");
  }
  return parsed;
}

export function formatVerboseExploreSummary(options: {
  url: string;
  framework: Framework;
  outputDir: string;
  maxDepth: number;
  maxStates: number;
  maxActionsPerState: number;
  formats: string[];
  html: boolean;
  pdf: boolean;
  screenshots: boolean;
  screenshotFormat: ScreenshotFormat;
  screenshotQuality: number;
  screenshotFullPage: boolean;
  screenshotRedaction: boolean;
  waitMs: number;
  waitForSelector?: string;
  scopeSelector?: string;
  scrollEnabled: boolean;
  scrollStepPx: number;
  scrollMaxSteps: number;
  scrollWaitMs: number;
  safeModeEnabled: boolean;
  safeModeDismissDialogs: boolean;
  safeModeIsolateCookies: boolean;
  safeModeBlockedText: string[];
  safeModeBlockedRoles: string[];
  safeModeBlockedUrls: string[];
  safeModeBlockedSelectors: string[];
  retentionEnabled: boolean;
  retentionDryRun: boolean;
}): string {
  const retention = options.retentionEnabled
    ? options.retentionDryRun ? "dry-run" : "on"
    : "off";

  return [
    "a11y-shiftleft explore",
    `url: ${options.url}`,
    `framework: ${options.framework}`,
    `limits: depth=${options.maxDepth}, states=${options.maxStates}, actionsPerState=${options.maxActionsPerState}`,
    `output: ${options.outputDir}`,
    `formats: ${options.formats.join(", ")}`,
    `html: ${options.html ? "on" : "off"}`,
    `pdf: ${options.pdf ? "on" : "off"}`,
    `screenshots: ${options.screenshots ? `${options.screenshotFormat} quality=${options.screenshotQuality}` : "off"}`,
    `screenshotCapture: ${options.screenshotFullPage ? "forced full-page" : "automatic error regions"}`,
    `screenshotRedaction: ${options.screenshotRedaction ? "on" : "off"}`,
    `wait: ${options.waitMs}ms${options.waitForSelector ? ` selector=${options.waitForSelector}` : ""}`,
    `scope: ${options.scopeSelector || "whole page"}`,
    `scroll: ${options.scrollEnabled ? `on step=${options.scrollStepPx}px maxSteps=${options.scrollMaxSteps} wait=${options.scrollWaitMs}ms` : "off"}`,
    `safeMode: ${options.safeModeEnabled ? "on" : "off"}`,
    `safeModeDismissDialogs: ${options.safeModeDismissDialogs ? "on" : "off"}`,
    `safeModeIsolateCookies: ${options.safeModeIsolateCookies ? "on" : "off"}`,
    `safeModeBlockedText: ${formatPatternList(options.safeModeBlockedText)}`,
    `safeModeBlockedRoles: ${formatPatternList(options.safeModeBlockedRoles)}`,
    `safeModeBlockedUrls: ${formatPatternList(options.safeModeBlockedUrls)}`,
    `safeModeBlockedSelectors: ${formatPatternList(options.safeModeBlockedSelectors)}`,
    `retention: ${retention}`
  ].join("\n");
}

export function resolveFullPageScreenshots(options: {
  screenshotFullPage?: boolean;
  compactScreenshots?: boolean;
}): boolean {
  return Boolean(options.screenshotFullPage) && !options.compactScreenshots;
}

export function formatExploreProgressMessage(event:
  | {
    type: "state";
    state: ExplorationState;
    visitedStates: number;
    maxStates: number;
  }
  | {
    type: "actions";
    stateId: string;
    actionCount: number;
    skippedActionCount: number;
  }
): string {
  if (event.type === "state") {
    const screenshot = event.state.screenshot ? ` screenshot=${event.state.screenshot}` : "";
    const colorScheme = event.state.colorScheme
      ? ` color-scheme=${event.state.colorScheme}`
      : "";
    return `[explore] rendered ${event.visitedStates} ${event.state.id} depth=${event.state.depth} issues=${event.state.issueCount}${colorScheme}${screenshot}`;
  }

  return `[explore] ${event.stateId} queued=${event.actionCount} skipped=${event.skippedActionCount}`;
}

export function formatExploreConsoleSummary(
  report: A11yReport,
  graph: ExplorationGraph,
  options: {
    outputDir: string;
    formats: ReportFormat[];
    html: boolean;
    pdf: boolean;
    screenshots: boolean;
    retention?: ReportRetentionSummary;
  }
): string {
  const summary = report.summary;
  const status = summary.total === 0
    ? "No automated findings detected"
    : "Accessibility findings detected";
  const files = explorationReportFiles(options.outputDir, options.formats, {
    html: options.html,
    pdf: options.pdf,
    screenshots: options.screenshots
  });
  const topRules = topRuleCounts(report, 5);
  const topStates = [...graph.states]
    .sort((a, b) => {
      if (b.issueCount !== a.issueCount) return b.issueCount - a.issueCount;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 5);
  const retention = options.retention
    ? options.retention.dryRun
      ? `dry-run planned delete ${options.retention.plannedDeletedRuns}, kept ${options.retention.keptRuns}`
      : `deleted ${options.retention.deletedRuns}, kept ${options.retention.keptRuns}`
    : "off";
  const colorSchemes = [...new Set(
    graph.states.map((state) => state.colorScheme).filter(Boolean)
  )].join(", ") || "single/default";
  const uiStatesVisited = graph.summary.uiStatesVisited ?? graph.summary.statesVisited;

  return [
    "a11y-shiftleft explore",
    `Status: ${status}`,
    `Exploration: UI states ${uiStatesVisited}/${graph.summary.maxStates} | rendered states ${graph.summary.statesVisited} | actions tried ${graph.summary.actionsTried} | skipped ${graph.summary.skippedActions} | unique screenshots ${graph.summary.screenshots} | duplicate screenshots skipped ${graph.summary.duplicateScreenshots || 0}`,
    ...(graph.summary.scopeSelector ? [`Scope: ${graph.summary.scopeSelector}`] : []),
    `Findings: total ${summary.total} | CRITICAL ${summary.critical} | WARNING ${summary.warning} | INFO ${summary.info}`,
    `Color schemes: ${colorSchemes}`,
    `Framework: ${summary.framework}`,
    `Retention: ${retention}`,
    "",
    "Top rules:",
    ...formatList(topRules.map(([ruleId, count]) => `${ruleId}: ${count}`), "No rule findings."),
    "",
    "Top states:",
    ...formatList(topStates.map((state) => `${state.id}: ${state.issueCount} findings at ${state.url}`), "No explored states."),
    "",
    "Reports:",
    ...files.map((file) => `  - ${file}`),
    "",
    "Next:",
    options.html
      ? `  - Open ${joinOutputPath(options.outputDir, "exploration.html")} for the visual state report.`
      : `  - Open ${primaryReportPath(options.outputDir, options.formats)} for the generated report.`,
    options.pdf
      ? `  - Attach ${joinOutputPath(options.outputDir, "exploration.pdf")} when a portable evidence artifact is needed.`
      : "  - Add --pdf when a portable visual report artifact is needed.",
    "  - Use --no-screenshots for sensitive pages or CI runs that must not store images.",
    "  - Use --json-summary when a script needs the stdout summary as JSON."
  ].join("\n");
}

function shouldPrintExploreProgress(options: Pick<ExploreOptions, "quiet">): boolean {
  return Boolean(!options.quiet && process.stdout.isTTY && !process.env.CI);
}

function shouldPrintExploreJsonSummary(options: Pick<ExploreOptions, "jsonSummary">): boolean {
  return Boolean(options.jsonSummary || process.env.CI || !process.stdout.isTTY);
}

function explorationReportFiles(
  outputDir: string,
  formats: ReportFormat[],
  options: {
    html: boolean;
    pdf: boolean;
    screenshots: boolean;
  }
): string[] {
  const files = [];

  if (options.html) files.push(joinOutputPath(outputDir, "exploration.html"));
  if (options.pdf) files.push(joinOutputPath(outputDir, "exploration.pdf"));
  files.push(joinOutputPath(outputDir, "exploration-graph.json"));
  if (formats.includes("markdown")) files.push(joinOutputPath(outputDir, "a11y-comment.md"));
  if (formats.includes("json")) files.push(joinOutputPath(outputDir, "a11y-report.json"));
  if (formats.includes("csv")) {
    files.push(joinOutputPath(outputDir, "a11y-metrics.csv"));
    files.push(joinOutputPath(outputDir, "a11y-findings.csv"));
  }
  if (options.screenshots) files.push(joinOutputPath(outputDir, "screenshots/"));

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

function joinOutputPath(outputDir: string, fileName: string): string {
  if (outputDir.endsWith("/")) return `${outputDir}${fileName}`;
  return `${outputDir}/${fileName}`;
}

function toPatternList(values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) return undefined;

  const patterns = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return patterns.length > 0 ? patterns : undefined;
}

function formatPatternList(patterns: string[]): string {
  return patterns.length > 0 ? patterns.join(", ") : "none";
}

function retentionRequested(options: Pick<ExploreOptions, "retention" | "retentionMaxRuns" | "retentionMaxAgeDays" | "retentionDryRun">): boolean | undefined {
  if (options.retention === false) return false;
  if (options.retentionDryRun) return true;
  if (options.retentionMaxRuns || options.retentionMaxAgeDays) return true;
  return undefined;
}
