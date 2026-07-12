import type { Command } from "commander";
import { runEslintAdapter } from "../adapters/eslintAdapter.js";
import { runExplorePlaywrightAdapter, writeExplorationGraph } from "../adapters/explorePlaywrightAdapter.js";
import { runKeyboardPlaywrightAdapter } from "../adapters/keyboardPlaywrightAdapter.js";
import { runLighthouseAdapter } from "../adapters/lighthouseAdapter.js";
import { loadConfig } from "../config/loadConfig.js";
import { createManualChecklist } from "../core/manualChecklist.js";
import { normalizeBrowserEngine, supportedBrowserEnginesText } from "../core/browserRuntime.js";
import { filterReportFindings } from "../core/findingFilter.js";
import { normalizeHideElementSelectors } from "../core/hideElements.js";
import { dedupeIssues } from "../core/dedupe.js";
import { readScopePlanIfExists } from "../core/scopePlan.js";
import { detectFramework } from "../core/detectFramework.js";
import { resolveDevicePreset } from "../core/devicePresets.js";
import { applyIgnores, DEFAULT_IGNORE_FILE } from "../core/ignore.js";
import { normalizeIssue } from "../core/normalize.js";
import { openReportFile } from "../core/openReport.js";
import { resolveAuthStatePath } from "../core/authState.js";
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
  profile?: string;
  withLighthouse?: boolean;
  out?: string;
  browser?: string;
  device?: string;
  authState?: string;
  mobile?: boolean;
  tablet?: boolean;
  scope?: string;
  hideElements?: string[];
  depth?: string;
  maxDepth?: string;
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
  waitUntilUrl?: string;
  waitUntilPath?: string;
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
  open?: boolean;
  quiet?: boolean;
}

export function registerAuditCommand(program: Command): void {
  program
    .command("audit")
    .alias("quick")
    .description("Create one visual accessibility report with static, dynamic, keyboard, and manual-review evidence.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .requiredOption("--url <url>", "Start URL for the running application")
    .option("--profile <profile>", "Audit goal: risk, validation, or full")
    .option("--with-lighthouse", "Add optional Lighthouse accessibility score comparison")
    .option("--out <dir>", "Output directory", "reports")
    .option("--browser <engine>", "Browser engine for browser and keyboard evidence: chromium, firefox, or webkit")
    .option("--device <name>", "Playwright device preset, for example \"iPhone 13\" or \"Pixel 5\"")
    .option("--auth-state <file>", "Playwright storage state file for authenticated audits")
    .option("--mobile", "Use the default mobile browser profile (iPhone 13)")
    .option("--tablet", "Use the default tablet browser profile (iPad gen 7)")
    .option("--scope <selector>", "Limit visual axe checks and safe action discovery to one CSS selector")
    .option("--hide-elements <selectors...>", "Hide matching CSS selectors before visual browser checks and screenshots")
    .option("--depth <depth>", "Maximum interaction depth", "2")
    .option("--max-depth <depth>", "Maximum interaction depth; clearer alias for --depth")
    .option("--limit <limit>", "Maximum UI states", "20")
    .option("--actions-per-state <limit>", "Maximum safe actions per state", "8")
    .option("--max-tabs <count>", "Maximum Tab presses for keyboard traversal", "40")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--standard <standard>", "wcag22-aa, ada-title-ii, section508, or en301549")
    .option("--wcag-only", "Only report findings mapped to WCAG; exclude best practices and unmapped review signals")
    .option("--no-keyboard", "Skip the bounded keyboard focus traversal")
    .option("--no-manual-review", "Do not embed the manual review checklist")
    .option("--activation", "Add isolated safe Enter, Space, Escape, and arrow-key checks")
    .option("--no-screenshots", "Do not capture visual state screenshots")
    .option("--no-screenshot-redaction", "Do not mask sensitive form fields in screenshots")
    .option("--screenshot-full-page", "Force full-page screenshots instead of automatic error-region crops")
    .option("--wait-ms <ms>", "Extra settle time before screenshots and scans")
    .option("--wait-for-selector <selector>", "Wait for a selector before screenshots and scans")
    .option("--wait-until-url <pattern>", "Wait until the current URL contains a pattern before screenshots and scans")
    .option("--wait-until-path <path>", "Wait until the current URL reaches a path before screenshots and scans")
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
    .option("--open", "Open the visual HTML report after the audit finishes")
    .option("--quiet", "Suppress console summary")
    .action(async (options: AuditOptions, command: Command) => {
      const result = await runAudit(resolveAuditProfileOptions(options, command));
      if (result.failed) process.exitCode = 1;
    });
}

export async function runAudit(options: AuditOptions): Promise<{ failed: boolean; outputDir: string }> {
  options = resolveAuditProfileOptions(options);
  const startedAt = Date.now();
  const targetUrl = normalizeAuditUrl(options.url);
  const outputDir = normalizeOptionalCliValue(options.out);
  const device = resolveDevicePreset(options);
  const authState = resolveAuthStatePath(options.authState, options.cwd);
  const config = await loadConfig({ cwd: options.cwd, config: options.config }, {
    framework: toFramework(options.framework),
    outputDir,
    standard: toStandard(options.standard),
    failOn: options.failOn,
    dynamic: { enabled: true, urls: [targetUrl], authState },
    explore: {
      browser: toBrowserEngine(options.browser),
      device,
      authState,
      waitMs: optionalNonNegativeInteger(options.waitMs, "Wait time"),
      waitForSelector: options.waitForSelector,
      waitUntilUrl: options.waitUntilUrl,
      waitUntilPath: options.waitUntilPath,
      scopeSelector: options.scope,
      hideElements: options.hideElements ? normalizeHideElementSelectors(options.hideElements) : undefined,
      scroll: {
        enabled: options.scroll === false ? false : undefined,
        stepPx: optionalPositiveInteger(options.scrollStep, "Scroll step"),
        maxSteps: optionalPositiveInteger(options.scrollMaxSteps, "Scroll maximum steps"),
        waitMs: optionalNonNegativeInteger(options.scrollWaitMs, "Scroll wait time")
      },
      safeMode: {
        isolateCookies: authState ? false : undefined
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

  const maxDepth = boundedInteger(resolveAuditDepthOption(options), 2, 1, 5);
  const maxStates = boundedInteger(options.limit, 20, 1, 100);
  const maxActionsPerState = boundedInteger(options.actionsPerState, 8, 1, 30);
  const progressEnabled = shouldPrintAuditProgress(options);
  let visitedStates = 0;
  if (progressEnabled) {
    console.log(`[audit] Starting ${targetUrl}`);
    console.log(`[audit] Output: ${effectiveConfig.outputDir}`);
    console.log(`[audit] Exploring browser states and capturing ${options.screenshots === false ? "no screenshots" : "screenshots"}`);
  }

  const keyboardPromise: Promise<{ result?: KeyboardAuditResult; issues: Issue[] }> = options.keyboard === false
    ? Promise.resolve({ issues: [] })
    : runKeyboardPlaywrightAdapter({
      url: targetUrl,
      framework,
      maxTabs: boundedInteger(options.maxTabs, 40, 1, 200),
      waitMs: effectiveConfig.explore.waitMs,
      browser: effectiveConfig.explore.browser,
      device: effectiveConfig.explore.device,
      authState: effectiveConfig.explore.authState,
      activation: Boolean(options.activation),
      maxActivations: 6,
      safeMode: effectiveConfig.explore.safeMode
    }).then((result) => ({ result, issues: [] })).catch((error: unknown) => ({
      issues: [createAuditAdapterIssue(framework, targetUrl, "keyboard", error)]
    }));
  const lighthousePromise: Promise<{ results: LighthouseAuditResult[]; issues: Issue[] }> = !options.withLighthouse
    ? Promise.resolve({ results: [], issues: [] })
    : runLighthouseAdapter({ url: targetUrl, cwd: effectiveConfig.cwd })
      .then((result) => ({ results: [result], issues: [] }))
      .catch((error: unknown) => ({
        results: [],
        issues: [createAuditAdapterIssue(framework, targetUrl, "lighthouse", error)]
      }));

  const [staticIssues, exploration, keyboardOutcome, lighthouseOutcome] = await Promise.all([
    runEslintAdapter(effectiveConfig),
    runExplorePlaywrightAdapter(effectiveConfig, {
      url: targetUrl,
      outputDir: effectiveConfig.outputDir,
      maxDepth,
      maxStates,
      maxActionsPerState,
      screenshots: options.screenshots !== false,
      screenshotRedaction: options.screenshotRedaction !== false,
      screenshotFullPage: Boolean(options.screenshotFullPage),
      waitMs: effectiveConfig.explore.waitMs,
      waitForSelector: effectiveConfig.explore.waitForSelector,
      waitUntilUrl: effectiveConfig.explore.waitUntilUrl,
      waitUntilPath: effectiveConfig.explore.waitUntilPath,
      scopeSelector: effectiveConfig.explore.scopeSelector,
      hideElements: effectiveConfig.explore.hideElements,
      browser: effectiveConfig.explore.browser,
      device: effectiveConfig.explore.device,
      authState: effectiveConfig.explore.authState,
      scroll: effectiveConfig.explore.scroll,
      safeMode: effectiveConfig.explore.safeMode,
      onProgress: (event) => {
        if (!progressEnabled) return;

        if (event.type === "state") {
          visitedStates += 1;
          const screenshot = event.state.screenshot ? ` screenshot=${event.state.screenshot}` : "";
          console.log(`[audit] rendered ${visitedStates}/${maxStates} ${event.state.id} depth=${event.state.depth} issues=${event.state.issueCount}${screenshot}`);
        }

        if (event.type === "actions") {
          console.log(`[audit] ${event.stateId} actions queued=${event.actionCount} skipped=${event.skippedActionCount}`);
        }
      }
    }),
    keyboardPromise,
    lighthousePromise
  ]);
  if (progressEnabled) console.log("[audit] Writing reports");
  const keyboard = keyboardOutcome.result;
  const lighthouse = lighthouseOutcome.results;

  // Visual exploration findings come first so a duplicate static finding cannot
  // replace state, screenshot, and element-bounds evidence in the report.
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
    commandName: "audit",
    commandProfile: auditCommandProfile(options),
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
    generatedFiles: [
      "a11y-report.html",
      ...(options.pdf ? ["a11y-report.pdf"] : []),
      ...(options.raw ? ["exploration-graph.json"] : [])
    ],
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
    lighthouse
  });
  if (options.pdf) await writeExplorationPdf(effectiveConfig.outputDir, "a11y-report");

  const reportPath = `${effectiveConfig.outputDir}/a11y-report.html`;

  if (!options.quiet) {
    console.log([
      "a11y-shiftleft audit",
      `Findings: ${report.summary.total} | critical ${report.summary.critical} | warning ${report.summary.warning} | info ${report.summary.info}`,
      `States: ${exploration.graph.summary.statesVisited} | keyboard steps ${keyboard?.steps.length || 0}`,
      `Browser: ${exploration.graph.summary.browser?.name || effectiveConfig.explore.browser}`,
      ...(exploration.graph.summary.scopeSelector ? [`Scope: ${exploration.graph.summary.scopeSelector}`] : []),
      options.withLighthouse ? `Lighthouse: ${lighthouse[0]?.accessibilityScore ?? "not available"}` : "Lighthouse: not requested",
      `Open: ${reportPath}`,
      options.excel ? `Excel tables: ${effectiveConfig.outputDir}/a11y-summary.csv, a11y-pages.csv, a11y-rules.csv, a11y-findings.csv` : "Excel tables: not requested (add --excel)"
    ].join("\n"));
  }

  if (options.open) {
    try {
      await openReportFile(reportPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Could not open the report automatically: ${message}`);
      console.warn(`Open it manually: ${reportPath}`);
    }
  }

  return { failed: shouldFail(report.summary, config.failOn), outputDir: effectiveConfig.outputDir };
}

type AuditProfile = "risk" | "validation" | "full";

interface AuditProfilePreset {
  maxDepth: string;
  limit: string;
  actionsPerState: string;
  maxTabs: string;
  withLighthouse?: boolean;
  activation?: boolean;
}

const AUDIT_PROFILE_PRESETS: Record<AuditProfile, AuditProfilePreset> = {
  risk: {
    maxDepth: "1",
    limit: "10",
    actionsPerState: "4",
    maxTabs: "25"
  },
  validation: {
    maxDepth: "2",
    limit: "20",
    actionsPerState: "8",
    maxTabs: "40"
  },
  full: {
    maxDepth: "3",
    limit: "50",
    actionsPerState: "12",
    maxTabs: "80",
    withLighthouse: true,
    activation: true
  }
};

export function resolveAuditProfileOptions(options: AuditOptions, command?: Command): AuditOptions {
  const profile = toAuditProfile(options.profile);
  if (!profile) return options;
  const preset = AUDIT_PROFILE_PRESETS[profile];

  return {
    ...options,
    profile,
    maxDepth: chooseProfileValue(options.maxDepth, preset.maxDepth, command, "maxDepth", "depth"),
    limit: chooseProfileValue(options.limit, preset.limit, command, "limit"),
    actionsPerState: chooseProfileValue(options.actionsPerState, preset.actionsPerState, command, "actionsPerState"),
    maxTabs: chooseProfileValue(options.maxTabs, preset.maxTabs, command, "maxTabs"),
    withLighthouse: chooseProfileValue(options.withLighthouse, preset.withLighthouse, command, "withLighthouse"),
    activation: chooseProfileValue(options.activation, preset.activation, command, "activation")
  };
}

function auditCommandProfile(options: AuditOptions): string {
  const profile = toAuditProfile(options.profile);
  return profile ? `${profile}-audit` : "visual-audit";
}

function toAuditProfile(value: string | undefined): AuditProfile | undefined {
  if (value === undefined) return undefined;
  if (value === "risk" || value === "validation" || value === "full") return value;
  throw new Error(`Unsupported audit profile: ${value}. Use risk, validation, or full.`);
}

function optionWasProvided(command: Command | undefined, key: string): boolean {
  if (!command) return false;
  const source = command.getOptionValueSource(key);
  return source !== undefined && source !== "default";
}

function chooseProfileValue<T>(
  currentValue: T | undefined,
  profileValue: T | undefined,
  command: Command | undefined,
  key: string,
  alternateKey?: string
): T | undefined {
  if (command) {
    return optionWasProvided(command, key) || (alternateKey ? optionWasProvided(command, alternateKey) : false)
      ? currentValue
      : profileValue;
  }
  return currentValue ?? profileValue;
}

export function resolveAuditDepthOption(options: Pick<AuditOptions, "depth" | "maxDepth">): string | undefined {
  return options.maxDepth ?? options.depth;
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

function toBrowserEngine(browser: string | undefined) {
  if (!browser) return undefined;
  const normalized = normalizeBrowserEngine(browser);
  if (normalized !== browser) {
    throw new Error(`Unsupported browser engine: ${browser}. Use ${supportedBrowserEnginesText()}.`);
  }
  return normalized;
}

export function normalizeAuditUrl(value: string): string {
  const normalized = normalizeRequiredCliValue(value);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Invalid --url value: ${value}. Use a full URL such as https://example.com or http://localhost:5173.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid --url protocol: ${parsed.protocol}. Use http:// or https://.`);
  }

  return parsed.toString();
}

function normalizeRequiredCliValue(value: string): string {
  const normalized = normalizeOptionalCliValue(value);
  if (!normalized) throw new Error("Expected a non-empty value.");
  return normalized;
}

function normalizeOptionalCliValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value
    .trim()
    .replace(/^[“”"«»']+/, "")
    .replace(/[“”"«»']+$/, "")
    .trim();
}

function shouldPrintAuditProgress(options: Pick<AuditOptions, "quiet">): boolean {
  return Boolean(!options.quiet && !process.env.CI);
}

function toFramework(value: string | undefined): Framework | undefined {
  if (value === "react" || value === "vue" || value === "angular" || value === "auto" || value === "unknown") return value;
  return undefined;
}

function toStandard(value: string | undefined): ComplianceStandard | undefined {
  if (value === "wcag22-aa" || value === "ada-title-ii" || value === "section508" || value === "en301549") return value;
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
