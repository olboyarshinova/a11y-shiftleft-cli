import type { Command } from "commander";
import { runKeyboardPlaywrightAdapter } from "../adapters/keyboardPlaywrightAdapter.js";
import { loadConfig } from "../config/loadConfig.js";
import { dedupeIssues } from "../core/dedupe.js";
import { detectFramework } from "../core/detectFramework.js";
import { normalizeIssue } from "../core/normalize.js";
import { triageIssues } from "../core/severity.js";
import { resolveStandard } from "../core/standards.js";
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
  maxTabs?: string;
  waitMs?: string;
  failOn?: Severity | "none";
  quiet?: boolean;
  jsonSummary?: boolean;
}

export function registerKeyboardCommand(program: Command): void {
  program
    .command("keyboard")
    .description("Run a bounded keyboard focus traversal on a rendered page.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .requiredOption("--url <url>", "Page URL to test")
    .option("--out <dir>", "Output directory")
    .option("--max-tabs <count>", "Maximum Tab key presses", "40")
    .option("--wait-ms <ms>", "Extra page settle time before traversal", "250")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--quiet", "Suppress progress and console summary output")
    .option("--json-summary", "Print the machine-readable JSON summary to stdout")
    .action(async (options: KeyboardOptions) => {
      const startedAt = Date.now();
      const config = await loadConfig({ cwd: options.cwd, config: options.config }, {
        framework: toFramework(options.framework),
        outputDir: options.out,
        failOn: options.failOn,
        dynamic: { enabled: true, urls: [options.url] }
      });
      const framework = config.framework === "auto" ? await detectFramework(config.cwd) : config.framework;
      const standard = resolveStandard(config.standard);
      const audit = await runKeyboardPlaywrightAdapter({
        url: options.url,
        framework,
        maxTabs: parseBoundedInteger(options.maxTabs, 40, 1, 200),
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
      const issues = dedupeIssues(filtered);
      const report = await writeReports(config.outputDir, issues, {
        framework,
        cwd: config.cwd,
        urls: [options.url],
        standard,
        scanDurationMs: Date.now() - startedAt,
        rawCount: audit.issues.length,
        uniqueCount: issues.length,
        duplicateCount: filtered.length - issues.length
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

export function keyboardSummary(audit: Pick<Awaited<ReturnType<typeof runKeyboardPlaywrightAdapter>>, "focusableCount" | "steps" | "completedCycle" | "maxTabs">): {
  focusableCount: number;
  focusSteps: number;
  uniqueFocusTargets: number;
  completedCycle: boolean;
  maxTabs: number;
} {
  return {
    focusableCount: audit.focusableCount,
    focusSteps: audit.steps.length,
    uniqueFocusTargets: new Set(audit.steps.map((step) => step.selector)).size,
    completedCycle: audit.completedCycle,
    maxTabs: audit.maxTabs
  };
}

function formatKeyboardSummary(outputDir: string, audit: Awaited<ReturnType<typeof runKeyboardPlaywrightAdapter>>, summary: { total: number; critical: number; warning: number }): string {
  return [
    "a11y-shiftleft keyboard",
    `Focus path: ${new Set(audit.steps.map((step) => step.selector)).size}/${audit.focusableCount} controls (${audit.steps.length} steps)`,
    `Completed cycle: ${audit.completedCycle ? "yes" : "no"}`,
    `Findings: ${summary.total} | critical ${summary.critical} | warning ${summary.warning}`,
    `Reports: ${outputDir}/keyboard-path.md, ${outputDir}/keyboard-report.json, ${outputDir}/a11y-comment.md`
  ].join("\n");
}

function toFramework(value: string | undefined): Framework | undefined {
  if (value === "react" || value === "vue" || value === "angular" || value === "auto" || value === "unknown") return value;
  return undefined;
}

function parseBoundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer from ${minimum} to ${maximum}, received ${value}.`);
  }
  return parsed;
}
