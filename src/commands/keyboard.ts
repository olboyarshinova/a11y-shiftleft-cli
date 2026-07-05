import type { Command } from "commander";
import { runKeyboardPlaywrightAdapter } from "../adapters/keyboardPlaywrightAdapter.js";
import { loadConfig } from "../config/loadConfig.js";
import { dedupeIssues } from "../core/dedupe.js";
import { detectFramework } from "../core/detectFramework.js";
import { applyBaseline } from "../core/baseline.js";
import { applyIgnores, DEFAULT_IGNORE_FILE } from "../core/ignore.js";
import { normalizeIssue } from "../core/normalize.js";
import { applyRemediationTracking, DEFAULT_REMEDIATION_FILE } from "../core/remediationTracking.js";
import { applyRetest } from "../core/retest.js";
import { readScopePlanIfExists } from "../core/scopePlan.js";
import { triageIssues } from "../core/severity.js";
import { resolveStandard } from "../core/standards.js";
import { normalizeBrowserEngine, supportedBrowserEnginesText } from "../core/browserRuntime.js";
import { writeKeyboardReport } from "../reporters/writeKeyboardReport.js";
import { writeReports } from "../reporters/writeReports.js";
import type { Framework, Severity } from "../types.js";
import { filterByWcagConformance, shouldFail } from "./check.js";

interface KeyboardOptions {
  cwd?: string;
  config?: string;
  framework?: string;
  url: string;
  out?: string;
  browser?: string;
  device?: string;
  maxTabs?: string;
  activation?: boolean;
  maxActivations?: string;
  waitMs?: string;
  failOn?: Severity | "none";
  quiet?: boolean;
  jsonSummary?: boolean;
  baseline?: boolean;
  baselineFile?: string;
  updateBaseline?: boolean;
  retest?: string;
  remediationTracking?: boolean;
  remediationFile?: string;
  ignore?: boolean;
  ignoreFile?: string;
}

export const DEFAULT_KEYBOARD_BASELINE_FILE = ".a11y-keyboard-baseline.json";

export function registerKeyboardCommand(program: Command): void {
  program
    .command("keyboard")
    .description("Run a bounded keyboard focus traversal on a rendered page.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .requiredOption("--url <url>", "Page URL to test")
    .option("--out <dir>", "Output directory")
    .option("--browser <engine>", "Browser engine: chromium, firefox, or webkit")
    .option("--device <name>", "Playwright device preset, for example \"iPhone 13\" or \"Pixel 5\"")
    .option("--max-tabs <count>", "Maximum Tab key presses", "40")
    .option("--activation", "Test bounded safe Enter, Space, Escape, and arrow-key interactions")
    .option("--max-activations <count>", "Maximum isolated keyboard activation attempts", "6")
    .option("--wait-ms <ms>", "Extra page settle time before traversal", "250")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--baseline", "Compare with the keyboard baseline and fail only on new findings")
    .option("--baseline-file <file>", "Keyboard baseline file path", DEFAULT_KEYBOARD_BASELINE_FILE)
    .option("--update-baseline", "Overwrite the keyboard baseline with current findings")
    .option("--retest <report>", "Compare with a previous keyboard a11y-report.json")
    .option("--remediation-file <file>", "Remediation status file path", DEFAULT_REMEDIATION_FILE)
    .option("--no-remediation-tracking", "Do not apply remediation statuses to findings")
    .option("--ignore-file <file>", "Scoped ignore file path", DEFAULT_IGNORE_FILE)
    .option("--no-ignore", "Disable a11y-ignore.json filtering")
    .option("--quiet", "Suppress progress and console summary output")
    .option("--json-summary", "Print the machine-readable JSON summary to stdout")
    .action(async (options: KeyboardOptions) => {
      validateKeyboardComparisonOptions(options);
      const startedAt = Date.now();
      const config = await loadConfig({ cwd: options.cwd, config: options.config }, {
        framework: toFramework(options.framework),
        outputDir: options.out,
        failOn: options.failOn,
        dynamic: {
          enabled: true,
          urls: [options.url],
          browser: toBrowserEngine(options.browser),
          device: options.device
        }
      });
      const framework = config.framework === "auto" ? await detectFramework(config.cwd) : config.framework;
      const standard = resolveStandard(config.standard);
      const plannedScope = await readScopePlanIfExists(config.cwd);
      const audit = await runKeyboardPlaywrightAdapter({
        url: options.url,
        framework,
        maxTabs: parseBoundedInteger(options.maxTabs, 40, 1, 200),
        activation: Boolean(options.activation),
        maxActivations: parseBoundedInteger(options.maxActivations, 6, 1, 20),
        safeMode: config.explore.safeMode,
        browser: config.dynamic.browser,
        device: config.dynamic.device,
        waitMs: parseBoundedInteger(options.waitMs, 250, 0, 30_000),
        onProgress: options.quiet || options.jsonSummary || !process.stdout.isTTY
          ? undefined
          : (step) => console.log(`[keyboard] ${step.index}/${options.maxTabs || 40} ${step.selector}`)
      });
      const triaged = triageIssues(audit.issues.map(normalizeIssue));
      const filtered = filterByWcagConformance(triaged, {
        level: standard.wcagLevel,
        version: standard.wcagVersion,
        includeUnmapped: true
      });
      const uniqueIssues = dedupeIssues(filtered);
      const ignoreResult = await applyIgnores(uniqueIssues, {
        cwd: config.cwd,
        enabled: options.ignore !== false,
        ignoreFile: options.ignoreFile
      });
      const remediationResult = await applyRemediationTracking(ignoreResult.issues, {
        cwd: config.cwd,
        file: options.remediationFile,
        enabled: options.remediationTracking !== false
      });
      const baselineEnabled = Boolean(options.baseline || options.updateBaseline);
      const baselineResult = baselineEnabled
        ? await applyBaseline(remediationResult.issues, {
          cwd: config.cwd,
          baselineFile: options.baselineFile || DEFAULT_KEYBOARD_BASELINE_FILE,
          update: Boolean(options.updateBaseline)
        })
        : undefined;
      const retestResult = options.retest
        ? await applyRetest(remediationResult.issues, {
          cwd: config.cwd,
          previous: options.retest
        })
        : undefined;
      const reportIssues = baselineResult?.issues || retestResult?.issues || remediationResult.issues;
      const report = await writeReports(config.outputDir, reportIssues, {
        commandName: "keyboard",
        commandProfile: "keyboard-focus-audit",
        framework,
        cwd: config.cwd,
        urls: [options.url],
        plannedScope,
        standard,
        baseline: baselineResult?.summary,
        retest: retestResult?.summary,
        remediationTracking: remediationResult.summary,
        ignore: ignoreResult.summary,
        scanDurationMs: Date.now() - startedAt,
        rawCount: audit.issues.length,
        uniqueCount: ignoreResult.issues.length,
        duplicateCount: filtered.length - uniqueIssues.length
      }, {
        frameworkExample: config.framework === "auto" || config.framework === "unknown" ? undefined : config.framework,
        keyboard: audit
      });
      await writeKeyboardReport(config.outputDir, { ...audit, issues: report.issues });

      if (!options.quiet) {
        console.log(options.jsonSummary || !process.stdout.isTTY
          ? JSON.stringify({ ...report.summary, keyboard: keyboardSummary(audit) }, null, 2)
          : formatKeyboardSummary(config.outputDir, audit, report.summary));
      }

      if (shouldFail(report.summary, config.failOn)) process.exitCode = 1;
    });
}

export function validateKeyboardComparisonOptions(options: Pick<KeyboardOptions, "retest" | "baseline" | "updateBaseline">): void {
  if (options.retest && (options.baseline || options.updateBaseline)) {
    throw new Error("Use either --retest or keyboard baseline mode, not both.");
  }
}

export function keyboardSummary(audit: Pick<Awaited<ReturnType<typeof runKeyboardPlaywrightAdapter>>, "focusableCount" | "steps" | "backwardSteps" | "completedCycle" | "reverseOrderMatches" | "maxTabs" | "activationAttempts">): {
  focusableCount: number;
  focusSteps: number;
  uniqueFocusTargets: number;
  completedCycle: boolean;
  reverseFocusSteps: number;
  reverseOrderMatches: boolean | null;
  maxTabs: number;
  activationAttempts: number;
  activationChanges: number;
  activationSkipped: number;
} {
  const activationAttempts = audit.activationAttempts || [];
  return {
    focusableCount: audit.focusableCount,
    focusSteps: audit.steps.length,
    uniqueFocusTargets: new Set(audit.steps.map((step) => step.selector)).size,
    completedCycle: audit.completedCycle,
    reverseFocusSteps: audit.backwardSteps.length,
    reverseOrderMatches: audit.reverseOrderMatches,
    maxTabs: audit.maxTabs,
    activationAttempts: activationAttempts.length,
    activationChanges: activationAttempts.filter((attempt) => attempt.outcome === "changed").length,
    activationSkipped: activationAttempts.filter((attempt) => attempt.outcome === "skipped").length
  };
}

function formatKeyboardSummary(outputDir: string, audit: Awaited<ReturnType<typeof runKeyboardPlaywrightAdapter>>, summary: { total: number; critical: number; warning: number }): string {
  return [
    "a11y-shiftleft keyboard",
    `Browser: ${audit.browser?.name || "Chromium"}`,
    `Focus path: ${new Set(audit.steps.map((step) => step.selector)).size}/${audit.focusableCount} controls (${audit.steps.length} steps)`,
    `Completed cycle: ${audit.completedCycle ? "yes" : "no"}`,
    `Reverse order: ${audit.reverseOrderMatches === null ? "not tested" : audit.reverseOrderMatches ? "matches" : "mismatch"} (${audit.backwardSteps.length} steps)`,
    ...(audit.activationEnabled
      ? [`Activation: ${audit.activationAttempts?.length || 0} attempts | changed ${audit.activationAttempts?.filter((attempt) => attempt.outcome === "changed").length || 0} | skipped ${audit.activationAttempts?.filter((attempt) => attempt.outcome === "skipped").length || 0}`]
      : []),
    `Findings: ${summary.total} | critical ${summary.critical} | warning ${summary.warning}`,
    `Reports: ${outputDir}/keyboard-path.md, ${outputDir}/keyboard-report.json, ${outputDir}/a11y-comment.md`
  ].join("\n");
}

function toFramework(value: string | undefined): Framework | undefined {
  if (value === "react" || value === "vue" || value === "angular" || value === "auto" || value === "unknown") return value;
  return undefined;
}

function toBrowserEngine(browser: string | undefined) {
  if (!browser) return undefined;
  const normalized = normalizeBrowserEngine(browser);
  if (normalized !== browser) {
    throw new Error(`Unsupported browser engine: ${browser}. Use ${supportedBrowserEnginesText()}.`);
  }
  return normalized;
}

function parseBoundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer from ${minimum} to ${maximum}, received ${value}.`);
  }
  return parsed;
}
