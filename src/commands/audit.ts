import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { runEslintAdapter } from "../adapters/eslintAdapter.js";
import { readScreenshotDimensions, runExplorePlaywrightAdapter, writeExplorationGraph } from "../adapters/explorePlaywrightAdapter.js";
import { runKeyboardPlaywrightAdapter } from "../adapters/keyboardPlaywrightAdapter.js";
import { runLighthouseAdapter } from "../adapters/lighthouseAdapter.js";
import { loadConfig } from "../config/loadConfig.js";
import { createManualChecklist } from "../core/manualChecklist.js";
import { normalizeBrowserEngine, supportedBrowserEnginesText } from "../core/browserRuntime.js";
import { filterReportFindings } from "../core/findingFilter.js";
import { normalizeHideElementSelectors } from "../core/hideElements.js";
import { normalizeCliValue, normalizeHttpUrlInput } from "../core/urlInput.js";
import { dedupeIssues } from "../core/dedupe.js";
import { readScopePlanIfExists } from "../core/scopePlan.js";
import { detectFramework } from "../core/detectFramework.js";
import { MOBILE_DEVICE_PRESET, resolveDevicePreset, TABLET_DEVICE_PRESET } from "../core/devicePresets.js";
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
import type { A11yReport, BrowserEngine, ComplianceStandard, Framework, Issue, KeyboardAuditResult, LighthouseAuditResult, Severity } from "../types.js";
import { filterByWcagConformance, shouldFail } from "./check.js";

export interface AuditOptions {
  cwd?: string;
  config?: string;
  framework?: string;
  url: string;
  profile?: string;
  withLighthouse?: boolean;
  out?: string;
  browser?: string;
  browsers?: string[];
  device?: string;
  devices?: string[];
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
  safeBlockRequest?: string[];
  waitMs?: string;
  waitForSelector?: string;
  waitUntilUrl?: string;
  waitUntilPath?: string;
  pauseOnHumanVerification?: boolean;
  humanVerificationTimeoutMs?: string;
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
    .option("--browsers <engines...>", "Run separate audits for several browser engines: chromium, firefox, webkit")
    .option("--device <name>", "Playwright device preset, for example \"iPhone 13\" or \"Pixel 5\"")
    .option("--devices <profiles...>", "Run separate audits for several profiles: desktop, mobile, tablet, or Playwright device names")
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
    .option("--safe-block-request <patterns...>", "Additional network request URL patterns to abort during exploration")
    .option("--wait-ms <ms>", "Extra settle time before screenshots and scans")
    .option("--wait-for-selector <selector>", "Wait for a selector before screenshots and scans")
    .option("--wait-until-url <pattern>", "Wait until the current URL contains a pattern before screenshots and scans")
    .option("--wait-until-path <path>", "Wait until the current URL reaches a path before screenshots and scans")
    .option("--pause-on-human-verification", "Open a visible browser and wait for manual CAPTCHA or human-verification completion")
    .option("--human-verification-timeout-ms <ms>", "Maximum time to wait for manual human-verification completion", "120000")
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
      const resolvedOptions = resolveAuditProfileOptions(options, command);
      if (hasAuditBrowserMatrix(resolvedOptions) && hasAuditDeviceMatrix(resolvedOptions)) {
        throw new Error("Use either --browsers or --devices for this release. Run separate commands when you need both comparisons.");
      }
      const result = hasAuditBrowserMatrix(resolvedOptions)
        ? await runAuditBrowserMatrix(resolvedOptions)
        : hasAuditDeviceMatrix(resolvedOptions)
        ? await runAuditDeviceMatrix(resolvedOptions)
        : await runAudit(resolvedOptions);
      if (result.failed) process.exitCode = 1;
    });
}

export interface AuditBrowserTarget {
  label: string;
  slug: string;
  browser: BrowserEngine;
}

export interface AuditDeviceTarget {
  label: string;
  slug: string;
  device?: string;
}

export interface AuditDeviceSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  states?: number;
  topRules?: AuditMatrixRuleSummary[];
  topPages?: AuditMatrixPageSummary[];
  topStates?: AuditMatrixStateSummary[];
}

export interface AuditMatrixRuleSummary {
  ruleId: string;
  severity: Severity;
  count: number;
}

export interface AuditMatrixPageSummary {
  page: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export interface AuditMatrixStateSummary {
  id: string;
  label: string;
  url: string;
  depth: number;
  issueCount: number;
  screenshot?: string;
  screenshotEvidenceCount?: number;
  screenshotFullPage?: boolean;
  visualDuplicateOf?: string;
}

export interface AuditMatrixProfilePeak {
  label: string;
  value: number;
}

export interface AuditMatrixRuleDifference {
  ruleId: string;
  severity: Severity;
  total: number;
  profileCounts: Record<string, number>;
}

export interface AuditMatrixProfileSpecificRules {
  label: string;
  rules: AuditMatrixRuleSummary[];
}

export interface AuditMatrixProfileSpecificPages {
  label: string;
  pages: AuditMatrixPageSummary[];
}

export interface AuditMatrixProfileSpecificStates {
  label: string;
  states: AuditMatrixStateSummary[];
}

export interface AuditMatrixStateEvidenceLink {
  label: string;
  report: string;
  count: number;
  screenshot?: string;
  screenshotEvidenceCount?: number;
  screenshotFullPage?: boolean;
  visualDuplicateOf?: string;
}

export interface AuditMatrixSharedStateDifference {
  stateKey: string;
  label: string;
  url: string;
  depth: number;
  total: number;
  spread: number;
  profileCounts: Record<string, number>;
  evidenceLinks: AuditMatrixStateEvidenceLink[];
}

export interface AuditMatrixVisualComparison {
  stateKey: string;
  label: string;
  url: string;
  depth: number;
  spread: number;
  compare: string;
  screenshotReview: string;
  screenshotDiff?: AuditMatrixScreenshotDiff;
  visualEvidence: AuditMatrixVisualEvidence[];
  evidenceLinks: AuditMatrixStateEvidenceLink[];
}

export interface AuditMatrixScreenshotDiff {
  status: "same-size" | "different-size" | "missing-dimensions";
  note: string;
  widthDelta?: number;
  heightDelta?: number;
}

export interface AuditMatrixVisualEvidence {
  label: string;
  report: string;
  count: number;
  screenshot?: string;
  screenshotMode: "full-page" | "viewport" | "unknown";
  screenshotEvidenceCount: number;
  screenshotWidth?: number;
  screenshotHeight?: number;
  visualDuplicateOf?: string;
}

export interface AuditMatrixCoverageOverlap {
  completedProfiles: number;
  commonPages: number;
  profileSpecificPages: number;
  commonStates: number;
  profileSpecificStates: number;
}

export interface AuditMatrixComparison {
  highestTotal?: AuditMatrixProfilePeak;
  highestCritical?: AuditMatrixProfilePeak;
  differingRules: AuditMatrixRuleDifference[];
  commonRules: AuditMatrixRuleDifference[];
  coverageOverlap: AuditMatrixCoverageOverlap;
  profileSpecificRules: AuditMatrixProfileSpecificRules[];
  profileSpecificPages: AuditMatrixProfileSpecificPages[];
  profileSpecificStates: AuditMatrixProfileSpecificStates[];
  sharedStateDifferences: AuditMatrixSharedStateDifference[];
  visualComparisonQueue: AuditMatrixVisualComparison[];
}

interface AuditDeviceRunResult {
  target: AuditDeviceTarget;
  failed: boolean;
  outputDir: string;
  summary?: AuditDeviceSummary;
}

export interface AuditDeviceMatrixReport {
  generatedAt: string;
  profiles: Array<{
    label: string;
    slug: string;
    device?: string;
    status: "completed" | "failed";
    outputDir: string;
    htmlReport: string;
    jsonReport: string;
    rerunCommand?: string;
    summary?: AuditDeviceSummary;
  }>;
  totals: AuditDeviceSummary;
  comparison: AuditMatrixComparison;
}

interface AuditBrowserRunResult {
  target: AuditBrowserTarget;
  failed: boolean;
  outputDir: string;
  summary?: AuditDeviceSummary;
}

export interface AuditBrowserMatrixReport {
  generatedAt: string;
  profiles: Array<{
    label: string;
    slug: string;
    browser: BrowserEngine;
    status: "completed" | "failed";
    outputDir: string;
    htmlReport: string;
    jsonReport: string;
    rerunCommand?: string;
    summary?: AuditDeviceSummary;
  }>;
  totals: AuditDeviceSummary;
  comparison: AuditMatrixComparison;
}

export async function runAuditBrowserMatrix(options: AuditOptions): Promise<{ failed: boolean; outputDir: string }> {
  const targets = resolveAuditBrowserTargets(options);
  if (targets.length === 0) return runAudit(options);

  const baseOutputDir = normalizeOptionalCliValue(options.out) || "reports";
  const results: AuditBrowserRunResult[] = [];

  if (!options.quiet) {
    console.log(`[audit] Running ${targets.length} browser engine${targets.length === 1 ? "" : "s"}: ${targets.map((target) => target.label).join(", ")}`);
  }

  for (const target of targets) {
    const outputDir = path.join(baseOutputDir, target.slug);
    if (!options.quiet) console.log(`[audit] Browser engine: ${target.label} -> ${outputDir}`);
    const result = await runAudit({
      ...options,
      browsers: undefined,
      browser: target.browser,
      out: outputDir
    });
    results.push({
      target,
      ...result,
      summary: await readAuditDeviceSummary(outputDir)
    });
  }

  const summaryPath = path.join(baseOutputDir, "a11y-browser-audit.md");
  const jsonSummaryPath = path.join(baseOutputDir, "a11y-browser-audit.json");
  const htmlSummaryPath = path.join(baseOutputDir, "a11y-browser-audit.html");
  const matrixReport = createAuditBrowserMatrixReport(results, undefined, options);
  await attachAuditMatrixScreenshotDiffs(matrixReport, baseOutputDir);
  await fs.mkdir(baseOutputDir, { recursive: true });
  await fs.writeFile(summaryPath, formatAuditBrowserMatrixSummary(results, options), "utf8");
  await fs.writeFile(jsonSummaryPath, `${JSON.stringify(matrixReport, null, 2)}\n`, "utf8");
  await fs.writeFile(htmlSummaryPath, renderAuditMatrixHtmlSummary("Browser Audit Summary", "browser engine", matrixReport, baseOutputDir), "utf8");

  if (!options.quiet) {
    console.log([
      "a11y-shiftleft browser audit",
      ...results.map((result) => `${result.failed ? "failed" : "completed"} ${result.target.label}: ${result.outputDir}/a11y-report.html`),
      `Visual summary: ${htmlSummaryPath}`,
      `Summary: ${summaryPath}`,
      `JSON summary: ${jsonSummaryPath}`
    ].join("\n"));
  }

  return {
    failed: results.some((result) => result.failed),
    outputDir: baseOutputDir
  };
}

export function hasAuditBrowserMatrix(options: Pick<AuditOptions, "browsers">): boolean {
  return Boolean(options.browsers?.some((browser) => browser.trim()));
}

export function resolveAuditBrowserTargets(options: Pick<AuditOptions, "browser" | "browsers">): AuditBrowserTarget[] {
  const requested = (options.browsers || []).map((browser) => browser.trim()).filter(Boolean);
  if (requested.length === 0) return [];
  if (options.browser) {
    throw new Error("Use either --browsers or --browser.");
  }

  const seen = new Set<BrowserEngine>();
  return requested.flatMap((browser) => {
    const target = auditBrowserTarget(browser);
    if (seen.has(target.browser)) return [];
    seen.add(target.browser);
    return [target];
  });
}

export function createAuditBrowserMatrixReport(
  results: Array<{ target: AuditBrowserTarget; failed: boolean; outputDir: string; summary?: AuditDeviceSummary }>,
  generatedAt = new Date().toISOString(),
  options?: Pick<AuditOptions, "url" | "depth" | "maxDepth" | "limit" | "withLighthouse" | "keyboard" | "screenshots" | "standard" | "authState" | "waitMs" | "waitForSelector">
): AuditBrowserMatrixReport {
  return {
    generatedAt,
    profiles: results.map((result) => ({
      label: result.target.label,
      slug: result.target.slug,
      browser: result.target.browser,
      status: result.failed ? "failed" : "completed",
      outputDir: result.outputDir,
      htmlReport: path.join(result.outputDir, "a11y-report.html"),
      jsonReport: path.join(result.outputDir, "a11y-report.json"),
      ...(options ? { rerunCommand: buildAuditBrowserRerunCommand(result, options) } : {}),
      ...(result.summary ? { summary: result.summary } : {})
    })),
    totals: summarizeAuditDeviceMatrix(results),
    comparison: createAuditMatrixComparison(results)
  };
}

export function formatAuditBrowserMatrixSummary(
  results: Array<{ target: AuditBrowserTarget; failed: boolean; outputDir: string; summary?: AuditDeviceSummary }>,
  options?: Pick<AuditOptions, "url" | "depth" | "maxDepth" | "limit" | "withLighthouse" | "keyboard" | "screenshots" | "standard" | "authState" | "waitMs" | "waitForSelector">
): string {
  const totals = summarizeAuditDeviceMatrix(results);
  const comparison = createAuditMatrixComparison(results);
  const rows = results.map((result) => (
    `| ${escapeMarkdownTableCell(result.target.label)} | ${result.failed ? "failed" : "completed"} | ${formatDeviceSummaryCounts(result)} | ${formatDeviceSummaryStates(result)} | [Open report](${escapeMarkdownLink(`${result.outputDir}/a11y-report.html`)}) |`
  )).join("\n");
  const commandForResult = (result: { target: AuditBrowserTarget; outputDir: string }) => (
    options ? buildAuditBrowserRerunCommand(result, options) : undefined
  );
  const hotspots = formatAuditMatrixHotspots("Browser engine", results, commandForResult);
  const reproductionNotes = formatAuditMatrixReproductionNotes("browser", "Browser engine", results, commandForResult);

  return `# Browser Audit Summary

This file links the separate visual reports generated by \`audit --browsers\`.
Use these reports to compare bounded browser evidence across Chromium, Firefox,
and WebKit. Browser-specific differences still need human review before being
treated as product defects.

Total across browsers: ${formatDeviceSummaryCounts({ summary: totals })}; ${formatDeviceSummaryStates({ summary: totals })} explored states.

| Browser engine | Status | Findings | States | Report |
|---|---|---:|---:|---|
${rows}

${formatAuditMatrixComparison("browser engine", comparison)}

${hotspots}

${reproductionNotes}
`;
}

function auditBrowserTarget(browser: string): AuditBrowserTarget {
  const normalized = browser.trim().toLowerCase();
  if (normalized !== "chromium" && normalized !== "firefox" && normalized !== "webkit") {
    throw new Error(`Unsupported browser engine: ${browser}. Use ${supportedBrowserEnginesText()}.`);
  }

  const labels: Record<BrowserEngine, string> = {
    chromium: "Chromium",
    firefox: "Firefox",
    webkit: "WebKit"
  };

  return {
    label: labels[normalized],
    slug: normalized,
    browser: normalized
  };
}

export async function runAuditDeviceMatrix(options: AuditOptions): Promise<{ failed: boolean; outputDir: string }> {
  const targets = resolveAuditDeviceTargets(options);
  if (targets.length === 0) return runAudit(options);

  const baseOutputDir = normalizeOptionalCliValue(options.out) || "reports";
  const results: AuditDeviceRunResult[] = [];

  if (!options.quiet) {
    console.log(`[audit] Running ${targets.length} device profile${targets.length === 1 ? "" : "s"}: ${targets.map((target) => target.label).join(", ")}`);
  }

  for (const target of targets) {
    const outputDir = path.join(baseOutputDir, target.slug);
    if (!options.quiet) console.log(`[audit] Device profile: ${target.label} -> ${outputDir}`);
    const result = await runAudit({
      ...options,
      devices: undefined,
      device: target.device,
      mobile: false,
      tablet: false,
      out: outputDir
    });
    results.push({
      target,
      ...result,
      summary: await readAuditDeviceSummary(outputDir)
    });
  }
  const summaryPath = path.join(baseOutputDir, "a11y-device-audit.md");
  const jsonSummaryPath = path.join(baseOutputDir, "a11y-device-audit.json");
  const htmlSummaryPath = path.join(baseOutputDir, "a11y-device-audit.html");
  const matrixReport = createAuditDeviceMatrixReport(results, undefined, options);
  await attachAuditMatrixScreenshotDiffs(matrixReport, baseOutputDir);
  await fs.mkdir(baseOutputDir, { recursive: true });
  await fs.writeFile(summaryPath, formatAuditDeviceMatrixSummary(results, options), "utf8");
  await fs.writeFile(jsonSummaryPath, `${JSON.stringify(matrixReport, null, 2)}\n`, "utf8");
  await fs.writeFile(htmlSummaryPath, renderAuditMatrixHtmlSummary("Device Audit Summary", "device profile", matrixReport, baseOutputDir), "utf8");

  if (!options.quiet) {
    console.log([
      "a11y-shiftleft device audit",
      ...results.map((result) => `${result.failed ? "failed" : "completed"} ${result.target.label}: ${result.outputDir}/a11y-report.html`),
      `Visual summary: ${htmlSummaryPath}`,
      `Summary: ${summaryPath}`,
      `JSON summary: ${jsonSummaryPath}`
    ].join("\n"));
  }

  return {
    failed: results.some((result) => result.failed),
    outputDir: baseOutputDir
  };
}

export function createAuditDeviceMatrixReport(
  results: Array<{ target: AuditDeviceTarget; failed: boolean; outputDir: string; summary?: AuditDeviceSummary }>,
  generatedAt = new Date().toISOString(),
  options?: Pick<AuditOptions, "url" | "depth" | "maxDepth" | "limit" | "withLighthouse" | "keyboard" | "screenshots" | "standard" | "authState" | "waitMs" | "waitForSelector">
): AuditDeviceMatrixReport {
  return {
    generatedAt,
    profiles: results.map((result) => ({
      label: result.target.label,
      slug: result.target.slug,
      ...(result.target.device ? { device: result.target.device } : {}),
      status: result.failed ? "failed" : "completed",
      outputDir: result.outputDir,
      htmlReport: path.join(result.outputDir, "a11y-report.html"),
      jsonReport: path.join(result.outputDir, "a11y-report.json"),
      ...(options ? { rerunCommand: buildAuditDeviceRerunCommand(result, options) } : {}),
      ...(result.summary ? { summary: result.summary } : {})
    })),
    totals: summarizeAuditDeviceMatrix(results),
    comparison: createAuditMatrixComparison(results)
  };
}

function summarizeAuditDeviceMatrix(results: Array<{ summary?: AuditDeviceSummary }>): AuditDeviceSummary {
  return results.reduce<AuditDeviceSummary>((totals, result) => {
    if (!result.summary) return totals;
    return {
      total: totals.total + result.summary.total,
      critical: totals.critical + result.summary.critical,
      warning: totals.warning + result.summary.warning,
      info: totals.info + result.summary.info,
      states: (totals.states || 0) + (result.summary.states || 0)
    };
  }, {
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    states: 0
  });
}

export function formatAuditDeviceMatrixSummary(
  results: Array<{ target: AuditDeviceTarget; failed: boolean; outputDir: string; summary?: AuditDeviceSummary }>,
  options?: Pick<AuditOptions, "url" | "depth" | "maxDepth" | "limit" | "withLighthouse" | "keyboard" | "screenshots" | "standard" | "authState" | "waitMs" | "waitForSelector">
): string {
  const totals = summarizeAuditDeviceMatrix(results);
  const comparison = createAuditMatrixComparison(results);
  const rows = results.map((result) => (
    `| ${escapeMarkdownTableCell(result.target.label)} | ${result.failed ? "failed" : "completed"} | ${formatDeviceSummaryCounts(result)} | ${formatDeviceSummaryStates(result)} | [Open report](${escapeMarkdownLink(`${result.outputDir}/a11y-report.html`)}) |`
  )).join("\n");
  const commandForResult = (result: { target: AuditDeviceTarget; outputDir: string }) => (
    options ? buildAuditDeviceRerunCommand(result, options) : undefined
  );
  const hotspots = formatAuditMatrixHotspots("Device profile", results, commandForResult);
  const reproductionNotes = formatAuditMatrixReproductionNotes("device", "Device profile", results, commandForResult);

  return `# Device Audit Summary

This file links the separate visual reports generated by \`audit --devices\`.
Use these reports to compare responsive browser evidence across bounded desktop,
phone, tablet, or named Playwright device profiles.

Total across profiles: ${formatDeviceSummaryCounts({ summary: totals })}; ${formatDeviceSummaryStates({ summary: totals })} explored states.

| Device profile | Status | Findings | States | Report |
|---|---|---:|---:|---|
${rows}

${formatAuditMatrixComparison("device profile", comparison)}

${hotspots}

${reproductionNotes}
`;
}

async function readAuditDeviceSummary(outputDir: string): Promise<AuditDeviceSummary | undefined> {
  try {
    const reportPath = path.join(outputDir, "a11y-report.json");
    const report = JSON.parse(await fs.readFile(reportPath, "utf8")) as A11yReport;
    return {
      total: Number(report.summary.total || 0),
      critical: Number(report.summary.critical || 0),
      warning: Number(report.summary.warning || 0),
      info: Number(report.summary.info || 0),
      states: report.exploration?.summary.statesVisited,
      topRules: summarizeAuditMatrixRules(report.issues || []),
      topPages: (report.summary.byPage || []).slice(0, 5).map((page) => ({
        page: page.url,
        total: page.total,
        critical: page.critical,
        warning: page.warning,
        info: page.info
      })),
      topStates: summarizeAuditMatrixStates(report.exploration)
    };
  } catch {
    return undefined;
  }
}

function summarizeAuditMatrixRules(issues: A11yReport["issues"], limit = 20): AuditMatrixRuleSummary[] {
  const groups = new Map<string, AuditMatrixRuleSummary>();
  for (const issue of issues) {
    const count = 1 + (issue.duplicateCount || 0);
    const existing = groups.get(issue.ruleId);
    if (!existing) {
      groups.set(issue.ruleId, {
        ruleId: issue.ruleId,
        severity: issue.severity,
        count
      });
      continue;
    }

    existing.count += count;
    if (severityRankValue(issue.severity) > severityRankValue(existing.severity)) {
      existing.severity = issue.severity;
    }
  }

  return [...groups.values()]
    .sort((left, right) => (
      severityRankValue(right.severity) - severityRankValue(left.severity)
      || right.count - left.count
      || left.ruleId.localeCompare(right.ruleId)
    ))
    .slice(0, limit);
}

function summarizeAuditMatrixStates(exploration: A11yReport["exploration"], limit = 5): AuditMatrixStateSummary[] {
  return (exploration?.states || [])
    .filter((state) => state.issueCount > 0)
    .sort((left, right) => (
      right.issueCount - left.issueCount
      || left.depth - right.depth
      || left.id.localeCompare(right.id)
    ))
    .slice(0, limit)
    .map((state) => ({
      id: state.id,
      label: state.actionLabel,
      url: state.url,
      depth: state.depth,
      issueCount: state.issueCount,
      ...(state.screenshot ? { screenshot: state.screenshot } : {}),
      ...(state.screenshotEvidence?.length ? { screenshotEvidenceCount: state.screenshotEvidence.length } : {}),
      ...(state.screenshotFullPage !== undefined ? { screenshotFullPage: state.screenshotFullPage } : {}),
      ...(state.visualDuplicateOf ? { visualDuplicateOf: state.visualDuplicateOf } : {})
    }));
}

function createAuditMatrixComparison(
  results: Array<{ target: { label: string }; outputDir?: string; summary?: AuditDeviceSummary }>
): AuditMatrixComparison {
  const completed = results.filter((result) => result.summary);
  const highestTotal = maxProfile(completed, (summary) => summary.total);
  const highestCritical = maxProfile(completed, (summary) => summary.critical);
  const profileLabels = completed.map((result) => result.target.label);
  const ruleMap = new Map<string, AuditMatrixRuleDifference>();

  for (const result of completed) {
    const label = result.target.label;
    for (const rule of result.summary?.topRules || []) {
      const existing = ruleMap.get(rule.ruleId) || {
        ruleId: rule.ruleId,
        severity: rule.severity,
        total: 0,
        profileCounts: Object.fromEntries(profileLabels.map((profileLabel) => [profileLabel, 0]))
      };
      existing.profileCounts[label] = rule.count;
      existing.total += rule.count;
      if (severityRankValue(rule.severity) > severityRankValue(existing.severity)) {
        existing.severity = rule.severity;
      }
      ruleMap.set(rule.ruleId, existing);
    }
  }

  const rules = [...ruleMap.values()].sort(compareAuditMatrixRules);
  const differingRules = rules
    .filter((rule) => {
      const counts = profileLabels.map((label) => rule.profileCounts[label] || 0);
      return new Set(counts).size > 1;
    })
    .slice(0, 8);
  const commonRules = rules
    .filter((rule) => profileLabels.length > 1 && profileLabels.every((label) => (rule.profileCounts[label] || 0) > 0))
    .slice(0, 5);
  const coverageOverlap = summarizeCoverageOverlap(completed);
  const profileSpecificRules = summarizeProfileSpecificRules(completed, rules);
  const profileSpecificPages = summarizeProfileSpecificPages(completed);
  const profileSpecificStates = summarizeProfileSpecificStates(completed);
  const sharedStateDifferences = summarizeSharedStateDifferences(completed);
  const visualComparisonQueue = summarizeVisualComparisonQueue(sharedStateDifferences);

  return {
    ...(highestTotal ? { highestTotal } : {}),
    ...(highestCritical ? { highestCritical } : {}),
    differingRules,
    commonRules,
    coverageOverlap,
    profileSpecificRules,
    profileSpecificPages,
    profileSpecificStates,
    sharedStateDifferences,
    visualComparisonQueue
  };
}

function summarizeCoverageOverlap(
  results: Array<{ target: { label: string }; summary?: AuditDeviceSummary }>
): AuditMatrixCoverageOverlap {
  const completedProfiles = results.length;
  const pageProfiles = collectProfileSets(results, (summary) => (summary.topPages || []).map((page) => page.page));
  const stateProfiles = collectProfileSets(results, (summary) => (summary.topStates || []).map(auditMatrixStateKey));
  const hasComparison = completedProfiles > 1;

  return {
    completedProfiles,
    commonPages: hasComparison ? countProfileSets(pageProfiles, completedProfiles) : 0,
    profileSpecificPages: hasComparison ? countProfileSets(pageProfiles, 1) : 0,
    commonStates: hasComparison ? countProfileSets(stateProfiles, completedProfiles) : 0,
    profileSpecificStates: hasComparison ? countProfileSets(stateProfiles, 1) : 0
  };
}

function collectProfileSets(
  results: Array<{ target: { label: string }; summary?: AuditDeviceSummary }>,
  pickValues: (summary: AuditDeviceSummary) => string[]
): Map<string, Set<string>> {
  const profileSets = new Map<string, Set<string>>();
  for (const result of results) {
    if (!result.summary) continue;
    for (const value of new Set(pickValues(result.summary).filter(Boolean))) {
      const profiles = profileSets.get(value) || new Set<string>();
      profiles.add(result.target.label);
      profileSets.set(value, profiles);
    }
  }
  return profileSets;
}

function countProfileSets(profileSets: Map<string, Set<string>>, size: number): number {
  return [...profileSets.values()].filter((profiles) => profiles.size === size).length;
}

function summarizeProfileSpecificRules(
  results: Array<{ target: { label: string }; summary?: AuditDeviceSummary }>,
  rules: AuditMatrixRuleDifference[],
  limit = 5
): AuditMatrixProfileSpecificRules[] {
  const labels = results.map((result) => result.target.label);
  if (labels.length < 2) return [];

  return labels.map((label) => ({
    label,
    rules: rules
      .filter((rule) => (rule.profileCounts[label] || 0) > 0)
      .filter((rule) => labels.every((otherLabel) => otherLabel === label || (rule.profileCounts[otherLabel] || 0) === 0))
      .map((rule) => ({
        ruleId: rule.ruleId,
        severity: rule.severity,
        count: rule.profileCounts[label] || 0
      }))
      .sort(compareAuditMatrixRuleSummaries)
      .slice(0, limit)
  })).filter((group) => group.rules.length > 0);
}

function compareAuditMatrixRuleSummaries(left: AuditMatrixRuleSummary, right: AuditMatrixRuleSummary): number {
  return severityRankValue(right.severity) - severityRankValue(left.severity)
    || right.count - left.count
    || left.ruleId.localeCompare(right.ruleId);
}

function summarizeProfileSpecificPages(
  results: Array<{ target: { label: string }; summary?: AuditDeviceSummary }>,
  limit = 5
): AuditMatrixProfileSpecificPages[] {
  const labels = results.map((result) => result.target.label);
  if (labels.length < 2) return [];
  const pageProfiles = new Map<string, Set<string>>();
  for (const result of results) {
    for (const page of result.summary?.topPages || []) {
      const profiles = pageProfiles.get(page.page) || new Set<string>();
      profiles.add(result.target.label);
      pageProfiles.set(page.page, profiles);
    }
  }

  return results.map((result) => ({
    label: result.target.label,
    pages: (result.summary?.topPages || [])
      .filter((page) => pageProfiles.get(page.page)?.size === 1)
      .sort(compareAuditMatrixPages)
      .slice(0, limit)
  })).filter((group) => group.pages.length > 0);
}

function summarizeProfileSpecificStates(
  results: Array<{ target: { label: string }; summary?: AuditDeviceSummary }>,
  limit = 5
): AuditMatrixProfileSpecificStates[] {
  const labels = results.map((result) => result.target.label);
  if (labels.length < 2) return [];
  const stateProfiles = new Map<string, Set<string>>();
  for (const result of results) {
    for (const state of result.summary?.topStates || []) {
      const profiles = stateProfiles.get(auditMatrixStateKey(state)) || new Set<string>();
      profiles.add(result.target.label);
      stateProfiles.set(auditMatrixStateKey(state), profiles);
    }
  }

  return results.map((result) => ({
    label: result.target.label,
    states: (result.summary?.topStates || [])
      .filter((state) => stateProfiles.get(auditMatrixStateKey(state))?.size === 1)
      .sort(compareAuditMatrixStates)
      .slice(0, limit)
  })).filter((group) => group.states.length > 0);
}

function summarizeSharedStateDifferences(
  results: Array<{ target: { label: string }; outputDir?: string; summary?: AuditDeviceSummary }>,
  limit = 5
): AuditMatrixSharedStateDifference[] {
  const labels = results.map((result) => result.target.label);
  if (labels.length < 2) return [];
  const states = new Map<string, {
    state: AuditMatrixStateSummary;
    profileCounts: Record<string, number>;
    evidenceLinks: AuditMatrixStateEvidenceLink[];
  }>();

  for (const result of results) {
    for (const state of result.summary?.topStates || []) {
      const key = auditMatrixStateKey(state);
      const existing = states.get(key) || {
        state,
        profileCounts: Object.fromEntries(labels.map((label) => [label, 0])),
        evidenceLinks: []
      };
      existing.profileCounts[result.target.label] = Math.max(existing.profileCounts[result.target.label] || 0, state.issueCount);
      if (result.outputDir) {
        const report = `${result.outputDir}/a11y-report.html#${state.id}`;
        if (!existing.evidenceLinks.some((link) => link.label === result.target.label && link.report === report)) {
          existing.evidenceLinks.push({
            label: result.target.label,
            report,
            count: state.issueCount,
            ...(state.screenshot ? { screenshot: state.screenshot } : {}),
            ...(state.screenshotEvidenceCount ? { screenshotEvidenceCount: state.screenshotEvidenceCount } : {}),
            ...(state.screenshotFullPage !== undefined ? { screenshotFullPage: state.screenshotFullPage } : {}),
            ...(state.visualDuplicateOf ? { visualDuplicateOf: state.visualDuplicateOf } : {})
          });
        }
      }
      states.set(key, existing);
    }
  }

  return [...states.entries()]
    .filter(([, state]) => labels.filter((label) => (state.profileCounts[label] || 0) > 0).length > 1)
    .map(([stateKey, state]) => {
      const counts = labels.map((label) => state.profileCounts[label] || 0);
      const total = counts.reduce((sum, count) => sum + count, 0);
      const spread = Math.max(...counts) - Math.min(...counts);
      return {
        stateKey,
        label: state.state.label || state.state.id,
        url: state.state.url,
        depth: state.state.depth,
        total,
        spread,
        profileCounts: state.profileCounts,
        evidenceLinks: state.evidenceLinks.sort((left, right) => labels.indexOf(left.label) - labels.indexOf(right.label))
      };
    })
    .filter((state) => state.spread > 0)
    .sort(compareAuditMatrixSharedStateDifferences)
    .slice(0, limit);
}

function compareAuditMatrixSharedStateDifferences(
  left: AuditMatrixSharedStateDifference,
  right: AuditMatrixSharedStateDifference
): number {
  return right.spread - left.spread
    || right.total - left.total
    || left.depth - right.depth
    || left.label.localeCompare(right.label)
    || left.url.localeCompare(right.url);
}

function summarizeVisualComparisonQueue(
  states: AuditMatrixSharedStateDifference[],
  limit = 5
): AuditMatrixVisualComparison[] {
  return states
    .map((state) => {
      const links = state.evidenceLinks
        .filter((link) => link.count > 0)
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
      const highest = links[0];
      const lowest = links[links.length - 1];
      if (!highest || !lowest || highest.label === lowest.label || highest.count === lowest.count) return undefined;
      return {
        stateKey: state.stateKey,
        label: state.label,
        url: state.url,
        depth: state.depth,
        spread: state.spread,
        compare: `${highest.label} (${highest.count}) vs ${lowest.label} (${lowest.count})`,
        screenshotReview: summarizeVisualComparisonScreenshotReview([highest, lowest]),
        visualEvidence: [highest, lowest].map(createAuditMatrixVisualEvidence),
        evidenceLinks: [highest, lowest]
      };
    })
    .filter((state): state is AuditMatrixVisualComparison => Boolean(state))
    .sort((left, right) => (
      right.spread - left.spread
      || left.depth - right.depth
      || left.label.localeCompare(right.label)
      || left.url.localeCompare(right.url)
    ))
    .slice(0, limit);
}

function createAuditMatrixVisualEvidence(link: AuditMatrixStateEvidenceLink): AuditMatrixVisualEvidence {
  return {
    label: link.label,
    report: link.report,
    count: link.count,
    ...(link.screenshot ? { screenshot: link.screenshot } : {}),
    screenshotMode: link.screenshotFullPage === true ? "full-page" : link.screenshotFullPage === false ? "viewport" : "unknown",
    screenshotEvidenceCount: link.screenshotEvidenceCount || 0,
    ...(link.visualDuplicateOf ? { visualDuplicateOf: link.visualDuplicateOf } : {})
  };
}

export async function attachAuditMatrixScreenshotDiffs(
  report: Pick<AuditBrowserMatrixReport | AuditDeviceMatrixReport, "profiles" | "comparison">,
  baseOutputDir = "."
): Promise<void> {
  for (const item of report.comparison.visualComparisonQueue) {
    for (const evidence of item.visualEvidence) {
      const dimensions = await readAuditMatrixEvidenceDimensions(evidence, report.profiles, baseOutputDir);
      if (!dimensions) continue;
      evidence.screenshotWidth = dimensions.width;
      evidence.screenshotHeight = dimensions.height;
    }
    item.screenshotDiff = summarizeAuditMatrixScreenshotDiff(item.visualEvidence);
  }
}

async function readAuditMatrixEvidenceDimensions(
  evidence: AuditMatrixVisualEvidence,
  profiles: Array<{ label: string; outputDir: string }>,
  baseOutputDir: string
): Promise<{ width: number; height: number } | undefined> {
  if (!evidence.screenshot) return undefined;
  const screenshotPath = resolveAuditMatrixScreenshotFilePath(evidence, profiles, baseOutputDir);
  const format = inferScreenshotFormat(screenshotPath);
  if (!format) return undefined;
  try {
    return readScreenshotDimensions(await fs.readFile(screenshotPath), format);
  } catch {
    return undefined;
  }
}

function resolveAuditMatrixScreenshotFilePath(
  evidence: AuditMatrixVisualEvidence,
  profiles: Array<{ label: string; outputDir: string }>,
  baseOutputDir: string
): string {
  const profile = profiles.find((candidate) => candidate.label === evidence.label);
  if (!profile || !evidence.screenshot) return evidence.screenshot || "";
  const profileOutputDir = path.isAbsolute(profile.outputDir) ? profile.outputDir : path.join(baseOutputDir, profile.outputDir);
  const screenshotPath = path.join(profileOutputDir, evidence.screenshot);
  return path.isAbsolute(screenshotPath) ? screenshotPath : path.resolve(screenshotPath);
}

function inferScreenshotFormat(filePath: string): "png" | "jpeg" | undefined {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "png";
  if (extension === ".jpg" || extension === ".jpeg") return "jpeg";
  return undefined;
}

function summarizeAuditMatrixScreenshotDiff(evidence: AuditMatrixVisualEvidence[]): AuditMatrixScreenshotDiff {
  const [left, right] = evidence.filter((entry) => entry.screenshot).slice(0, 2);
  if (!left || !right || !left.screenshotWidth || !left.screenshotHeight || !right.screenshotWidth || !right.screenshotHeight) {
    return {
      status: "missing-dimensions",
      note: "Screenshot dimensions were unavailable for one or both profiles."
    };
  }
  const widthDelta = Math.abs(left.screenshotWidth - right.screenshotWidth);
  const heightDelta = Math.abs(left.screenshotHeight - right.screenshotHeight);
  if (widthDelta === 0 && heightDelta === 0) {
    return {
      status: "same-size",
      note: `Both screenshots are ${left.screenshotWidth} x ${left.screenshotHeight}.`
    };
  }
  return {
    status: "different-size",
    widthDelta,
    heightDelta,
    note: `Screenshot sizes differ: ${left.label} is ${left.screenshotWidth} x ${left.screenshotHeight}; ${right.label} is ${right.screenshotWidth} x ${right.screenshotHeight}.`
  };
}

function summarizeVisualComparisonScreenshotReview(links: AuditMatrixStateEvidenceLink[]): string {
  if (links.every((link) => !link.screenshot && !link.screenshotEvidenceCount)) {
    return "No screenshot evidence captured; rerun with screenshots enabled before comparing visually.";
  }
  if (links.some((link) => link.visualDuplicateOf)) {
    return "At least one profile reuses a screenshot from another state; confirm the linked report before treating it as a visual difference.";
  }
  const modes = new Set(links.map((link) => (
    link.screenshotFullPage === true ? "full-page" : link.screenshotFullPage === false ? "viewport" : "unknown"
  )));
  if (modes.size > 1) {
    return "Screenshot capture modes differ; compare the linked full-page and viewport evidence carefully.";
  }
  if (links.every((link) => Boolean(link.screenshotEvidenceCount))) {
    return "Focused screenshot evidence is available for both profiles.";
  }
  return "Screenshot evidence is available for at least one profile; use the linked visual reports for confirmation.";
}

function compareAuditMatrixPages(left: AuditMatrixPageSummary, right: AuditMatrixPageSummary): number {
  return right.critical - left.critical
    || right.warning - left.warning
    || right.total - left.total
    || left.page.localeCompare(right.page);
}

function compareAuditMatrixStates(left: AuditMatrixStateSummary, right: AuditMatrixStateSummary): number {
  return right.issueCount - left.issueCount
    || left.depth - right.depth
    || left.label.localeCompare(right.label)
    || left.url.localeCompare(right.url);
}

function auditMatrixStateKey(state: AuditMatrixStateSummary): string {
  return `${state.url}::${state.label}::depth-${state.depth}`;
}

function maxProfile(
  results: Array<{ target: { label: string }; summary?: AuditDeviceSummary }>,
  pick: (summary: AuditDeviceSummary) => number
): AuditMatrixProfilePeak | undefined {
  return results.reduce<AuditMatrixProfilePeak | undefined>((highest, result) => {
    if (!result.summary) return highest;
    const value = pick(result.summary);
    if (!highest || value > highest.value) return { label: result.target.label, value };
    return highest;
  }, undefined);
}

function compareAuditMatrixRules(left: AuditMatrixRuleDifference, right: AuditMatrixRuleDifference): number {
  return severityRankValue(right.severity) - severityRankValue(left.severity)
    || right.total - left.total
    || left.ruleId.localeCompare(right.ruleId);
}

function formatAuditMatrixComparison(kind: string, comparison: AuditMatrixComparison): string {
  const lines = [
    "## Difference Review",
    "",
    `Use this section to spot findings that may be specific to one ${kind}. Treat differences as review signals until a person confirms the behavior in the visual reports.`,
    "",
    `- Most findings: ${comparison.highestTotal ? `${comparison.highestTotal.label} (${comparison.highestTotal.value})` : "not available"}.`,
    `- Most critical findings: ${comparison.highestCritical ? `${comparison.highestCritical.label} (${comparison.highestCritical.value})` : "not available"}.`,
    `- Coverage overlap: ${formatCoverageOverlapSentence(comparison.coverageOverlap)}.`,
    "",
    "### Rules That Differ",
    "",
    formatAuditMatrixRuleTable(comparison.differingRules),
    "",
    "### Rules Seen In Every Completed Profile",
    "",
    formatAuditMatrixRuleTable(comparison.commonRules),
    "",
    "### Profile-Specific Rule Signals",
    "",
    formatProfileSpecificRuleSignals(comparison.profileSpecificRules),
    "",
    "### Profile-Specific Page And State Signals",
    "",
    formatProfileSpecificCoverageSignals(comparison),
    "",
    "### Shared States With Different Finding Counts",
    "",
    formatSharedStateDifferences(comparison.sharedStateDifferences),
    "",
    "### Visual Comparison Queue",
    "",
    formatVisualComparisonQueue(comparison.visualComparisonQueue)
  ];

  return lines.join("\n");
}

function formatCoverageOverlapSentence(overlap: AuditMatrixCoverageOverlap): string {
  if (overlap.completedProfiles < 2) return "not enough completed profiles to compare";
  return [
    `${overlap.commonPages} shared affected page${overlap.commonPages === 1 ? "" : "s"}`,
    `${overlap.profileSpecificPages} profile-specific affected page${overlap.profileSpecificPages === 1 ? "" : "s"}`,
    `${overlap.commonStates} shared affected state${overlap.commonStates === 1 ? "" : "s"}`,
    `${overlap.profileSpecificStates} profile-specific affected state${overlap.profileSpecificStates === 1 ? "" : "s"}`
  ].join("; ");
}

function formatProfileSpecificRuleSignals(groups: AuditMatrixProfileSpecificRules[]): string {
  if (groups.length === 0) return "No profile-specific rule signals found in the available summaries.";
  return [
    "| Profile | Rules found only in this profile |",
    "|---|---|",
    ...groups.map((group) => (
      `| ${escapeMarkdownTableCell(group.label)} | ${escapeMarkdownTableCell(group.rules.map((rule) => `${rule.ruleId}: ${rule.count} ${rule.severity}`).join("; "))} |`
    ))
  ].join("\n");
}

function formatProfileSpecificCoverageSignals(comparison: AuditMatrixComparison): string {
  const pageRows = comparison.profileSpecificPages.flatMap((group) => (
    group.pages.map((page) => (
      `| ${escapeMarkdownTableCell(group.label)} | page | ${escapeMarkdownTableCell(`${page.page} (${page.total} finding${page.total === 1 ? "" : "s"})`)} |`
    ))
  ));
  const stateRows = comparison.profileSpecificStates.flatMap((group) => (
    group.states.map((state) => (
      `| ${escapeMarkdownTableCell(group.label)} | state | ${escapeMarkdownTableCell(`${state.label || state.id} (${state.issueCount} finding${state.issueCount === 1 ? "" : "s"}, depth ${state.depth})`)} |`
    ))
  ));
  const rows = [...pageRows, ...stateRows].slice(0, 10);
  if (rows.length === 0) return "No profile-specific page or state signals found in the available summaries.";
  return [
    "| Profile | Signal | Review target |",
    "|---|---|---|",
    ...rows
  ].join("\n");
}

function formatSharedStateDifferences(states: AuditMatrixSharedStateDifference[]): string {
  if (states.length === 0) return "No shared states with different finding counts found in the available summaries.";
  return [
    "| State | URL | Depth | Difference | Profile counts | Visual evidence |",
    "|---|---|---:|---:|---|---|",
    ...states.map((state) => (
      `| ${escapeMarkdownTableCell(state.label)} | ${escapeMarkdownTableCell(state.url)} | ${state.depth} | ${state.spread} | ${escapeMarkdownTableCell(formatProfileCounts(state.profileCounts))} | ${formatAuditMatrixEvidenceLinks(state.evidenceLinks)} |`
    ))
  ].join("\n");
}

function formatAuditMatrixEvidenceLinks(links: AuditMatrixStateEvidenceLink[]): string {
  if (links.length === 0) return "Open the profile reports";
  return links
    .map((link) => `${formatAuditMatrixEvidenceLink(link)}${formatAuditMatrixScreenshotHint(link)}`)
    .join("; ");
}

function formatAuditMatrixEvidenceLink(link: AuditMatrixStateEvidenceLink): string {
  return `[${escapeMarkdownTableCell(`${link.label}: ${link.count}`)}](${escapeMarkdownLink(link.report)})`;
}

function formatAuditMatrixScreenshotHint(link: AuditMatrixStateEvidenceLink): string {
  const details = [
    link.screenshotFullPage === true ? "full-page" : link.screenshotFullPage === false ? "viewport" : "",
    link.screenshotEvidenceCount ? `${link.screenshotEvidenceCount} screenshot${link.screenshotEvidenceCount === 1 ? "" : "s"}` : "",
    link.visualDuplicateOf ? `reuses ${link.visualDuplicateOf}` : ""
  ].filter(Boolean);
  return details.length > 0 ? ` (${escapeMarkdownTableCell(details.join(", "))})` : "";
}

function formatVisualComparisonQueue(queue: AuditMatrixVisualComparison[]): string {
  if (queue.length === 0) return "No visual comparison queue was available from the completed profile summaries.";
  return [
    "| State | Compare first | Why | Screenshot review | Screenshot diff | Evidence |",
    "|---|---|---|---|---|---|",
    ...queue.map((item) => (
      `| ${escapeMarkdownTableCell(item.label)} | ${escapeMarkdownTableCell(item.compare)} | ${escapeMarkdownTableCell(`${item.spread} finding spread at depth ${item.depth}`)} | ${escapeMarkdownTableCell(item.screenshotReview)} | ${escapeMarkdownTableCell(formatAuditMatrixScreenshotDiff(item.screenshotDiff))} | ${formatAuditMatrixEvidenceLinks(item.evidenceLinks)} |`
    ))
  ].join("\n");
}

function formatAuditMatrixScreenshotDiff(diff?: AuditMatrixScreenshotDiff): string {
  if (!diff) return "not measured";
  if (diff.status === "different-size") {
    return `${diff.status}; width delta ${diff.widthDelta || 0}px; height delta ${diff.heightDelta || 0}px`;
  }
  return diff.status;
}

export function renderAuditMatrixHtmlSummary(
  title: string,
  profileKind: string,
  report: Pick<AuditBrowserMatrixReport | AuditDeviceMatrixReport, "generatedAt" | "profiles" | "totals" | "comparison">,
  baseOutputDir = "."
): string {
  const visualQueue = report.comparison.visualComparisonQueue;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --bg: #f6f8fb; --panel: #ffffff; --text: #172033; --muted: #526071; --border: #d8e0eb; --critical: #e0002a; --warning: #c84f00; --info: #075dc8; --ok: #0b7a4b; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 40px; }
    h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    h3 { margin: 0 0 8px; font-size: 16px; }
    a { color: #075dc8; }
    .muted { color: var(--muted); }
    .meta { margin: 0 0 20px; color: var(--muted); }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 18px 0; }
    .summary-card, .panel, .evidence-card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; }
    .summary-card { padding: 12px 14px; }
    .summary-card strong { display: block; font-size: 22px; line-height: 1.1; }
    .critical { color: var(--critical); }
    .warning { color: var(--warning); }
    .info { color: var(--info); }
    .ok { color: var(--ok); }
    .panel { padding: 16px; margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-top: 1px solid var(--border); padding: 8px; text-align: left; vertical-align: top; }
    th { color: var(--muted); font-weight: 700; }
    .comparison-card { display: grid; gap: 12px; }
    .comparison-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
    .diff-slider { border: 1px solid var(--border); border-radius: 8px; background: #ffffff; overflow: hidden; }
    .diff-slider header { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .diff-frame { position: relative; min-height: 220px; max-height: 520px; background: #eef2f7; overflow: hidden; }
    .diff-frame img { display: block; width: 100%; max-height: 520px; object-fit: contain; }
    .diff-frame .diff-overlay { position: absolute; inset: 0; clip-path: inset(0 calc(100% - var(--split, 50%)) 0 0); }
    .diff-frame .diff-divider { position: absolute; top: 0; bottom: 0; left: var(--split, 50%); width: 3px; background: #ffffff; box-shadow: 0 0 0 1px rgba(23, 32, 51, 0.35); }
    .diff-control { display: grid; gap: 6px; padding: 10px 12px 12px; }
    .diff-control input { width: 100%; }
    .evidence-card { overflow: hidden; }
    .evidence-card header { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .evidence-card img { display: block; width: 100%; max-height: 460px; object-fit: contain; background: #eef2f7; border-bottom: 1px solid var(--border); }
    .evidence-card dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 10px; margin: 0; padding: 10px 12px 12px; }
    .evidence-card dt { color: var(--muted); }
    .evidence-card dd { margin: 0; overflow-wrap: anywhere; }
    .empty { padding: 16px; background: #fffdf4; border: 1px solid #f4d28e; border-radius: 8px; color: #6d3a00; }
    @media (max-width: 760px) {
      main { width: min(100vw - 20px, 1180px); padding-top: 18px; }
      .summary-grid, .comparison-grid { grid-template-columns: 1fr; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Generated <time datetime="${escapeAttribute(report.generatedAt)}">${escapeHtml(report.generatedAt)}</time>. Use this local page to compare ${escapeHtml(profileKind)} visual evidence side by side.</p>
    ${renderAuditMatrixHtmlTotals(report.totals)}
    ${renderAuditMatrixHtmlProfiles(report.profiles, profileKind, baseOutputDir)}
    ${renderAuditMatrixHtmlVisualQueue(visualQueue, report.profiles, baseOutputDir)}
  </main>
  <script>
    document.querySelectorAll("[data-diff-slider]").forEach(function(slider) {
      var input = slider.querySelector("[data-diff-input]");
      if (!input) return;
      var update = function() {
        slider.style.setProperty("--split", input.value + "%");
      };
      input.addEventListener("input", update);
      update();
    });
  </script>
</body>
</html>
`;
}

function renderAuditMatrixHtmlTotals(totals: AuditDeviceSummary): string {
  return `<section class="summary-grid" aria-label="Summary totals">
    <div class="summary-card"><strong>${totals.total}</strong><span>Total findings</span></div>
    <div class="summary-card"><strong class="${totals.critical ? "critical" : "ok"}">${totals.critical}</strong><span>Critical</span></div>
    <div class="summary-card"><strong class="${totals.warning ? "warning" : "ok"}">${totals.warning}</strong><span>Warning</span></div>
    <div class="summary-card"><strong class="${totals.info ? "info" : "ok"}">${totals.info}</strong><span>Info</span></div>
  </section>`;
}

function renderAuditMatrixHtmlProfiles(
  profiles: Array<{ label: string; status: string; outputDir: string; htmlReport: string; summary?: AuditDeviceSummary }>,
  profileKind: string,
  baseOutputDir: string
): string {
  return `<section class="panel">
    <h2>${escapeHtml(capitalizeWords(profileKind))} Reports</h2>
    <table aria-label="${escapeAttribute(profileKind)} reports">
      <thead><tr><th>${escapeHtml(capitalizeWords(profileKind))}</th><th>Status</th><th>Findings</th><th>States</th><th>Report</th></tr></thead>
      <tbody>${profiles.map((profile) => `<tr>
        <th scope="row">${escapeHtml(profile.label)}</th>
        <td>${escapeHtml(profile.status)}</td>
        <td>${escapeHtml(formatDeviceSummaryCounts(profile))}</td>
        <td>${escapeHtml(formatDeviceSummaryStates(profile))}</td>
        <td><a href="${escapeAttribute(relativeMatrixPath(baseOutputDir, profile.htmlReport))}">Open report</a></td>
      </tr>`).join("")}</tbody>
    </table>
  </section>`;
}

function renderAuditMatrixHtmlVisualQueue(
  queue: AuditMatrixVisualComparison[],
  profiles: Array<{ label: string; outputDir: string }>,
  baseOutputDir: string
): string {
  if (queue.length === 0) {
    return `<section class="panel"><h2>Side-by-side Review</h2><p class="empty">No shared states with different finding counts were available for visual comparison.</p></section>`;
  }
  return `<section class="panel">
    <h2>Side-by-side Review</h2>
    ${queue.map((item) => `<article class="comparison-card" aria-labelledby="comparison-${escapeAttribute(slugifyMatrixId(item.stateKey))}">
      <div>
        <h3 id="comparison-${escapeAttribute(slugifyMatrixId(item.stateKey))}">${escapeHtml(item.label)}</h3>
        <p class="muted">${escapeHtml(item.compare)} · ${escapeHtml(`${item.spread} finding spread at depth ${item.depth}`)}<br>${escapeHtml(item.screenshotReview)}<br>${escapeHtml(formatAuditMatrixScreenshotDiffNote(item.screenshotDiff))}</p>
      </div>
      ${renderAuditMatrixHtmlDiffSlider(item, profiles, baseOutputDir)}
      <div class="comparison-grid">
        ${item.visualEvidence.map((evidence) => renderAuditMatrixHtmlEvidenceCard(evidence, profiles, baseOutputDir, item.label)).join("")}
      </div>
    </article>`).join("")}
  </section>`;
}

function renderAuditMatrixHtmlDiffSlider(
  item: AuditMatrixVisualComparison,
  profiles: Array<{ label: string; outputDir: string }>,
  baseOutputDir: string
): string {
  const evidence = item.visualEvidence.filter((entry) => entry.screenshot).slice(0, 2);
  const [left, right] = evidence;
  if (!left || !right) return "";
  const leftSrc = resolveAuditMatrixScreenshotSrc(left, profiles, baseOutputDir);
  const rightSrc = resolveAuditMatrixScreenshotSrc(right, profiles, baseOutputDir);
  return `<section class="diff-slider" data-diff-slider style="--split: 50%;" aria-label="${escapeAttribute(`Visual overlay comparison for ${item.label}`)}">
    <header>
      <strong>Visual overlay</strong>
      <span class="muted">${escapeHtml(left.label)} vs ${escapeHtml(right.label)}</span>
    </header>
    <div class="diff-frame">
      <img src="${escapeAttribute(leftSrc)}" alt="${escapeAttribute(`${left.label} screenshot for ${item.label}`)}" loading="lazy">
      <img class="diff-overlay" src="${escapeAttribute(rightSrc)}" alt="${escapeAttribute(`${right.label} screenshot for ${item.label}`)}" loading="lazy">
      <span class="diff-divider" aria-hidden="true"></span>
    </div>
    <label class="diff-control">
      <span>Drag to reveal ${escapeHtml(right.label)} over ${escapeHtml(left.label)}</span>
      <input type="range" min="0" max="100" value="50" data-diff-input aria-label="${escapeAttribute(`Reveal ${right.label} over ${left.label}`)}">
    </label>
  </section>`;
}

function renderAuditMatrixHtmlEvidenceCard(
  evidence: AuditMatrixVisualEvidence,
  profiles: Array<{ label: string; outputDir: string }>,
  baseOutputDir: string,
  stateLabel: string
): string {
  const screenshotSrc = evidence.screenshot ? resolveAuditMatrixScreenshotSrc(evidence, profiles, baseOutputDir) : undefined;
  return `<article class="evidence-card">
    <header>
      <strong>${escapeHtml(evidence.label)}</strong>
      <a href="${escapeAttribute(relativeMatrixPath(baseOutputDir, evidence.report))}">Open state</a>
    </header>
    ${screenshotSrc ? `<a href="${escapeAttribute(screenshotSrc)}"><img src="${escapeAttribute(screenshotSrc)}" alt="${escapeAttribute(`${evidence.label} screenshot evidence for ${stateLabel}`)}" loading="lazy"></a>` : `<p class="empty">No screenshot image was captured for this profile.</p>`}
    <dl>
      <dt>Findings</dt><dd>${evidence.count}</dd>
      <dt>Screenshot</dt><dd>${escapeHtml(evidence.screenshotMode)}</dd>
      <dt>Size</dt><dd>${escapeHtml(formatAuditMatrixEvidenceSize(evidence))}</dd>
      <dt>Focused evidence</dt><dd>${evidence.screenshotEvidenceCount}</dd>
      ${evidence.visualDuplicateOf ? `<dt>Reuse</dt><dd>${escapeHtml(evidence.visualDuplicateOf)}</dd>` : ""}
    </dl>
  </article>`;
}

function formatAuditMatrixScreenshotDiffNote(diff?: AuditMatrixScreenshotDiff): string {
  if (!diff) return "Screenshot dimensions were not measured.";
  if (diff.status === "same-size") return `Screenshot diff: same size. ${diff.note}`;
  if (diff.status === "different-size") return `Screenshot diff: different size. ${diff.note}`;
  return `Screenshot diff: dimensions unavailable. ${diff.note}`;
}

function formatAuditMatrixEvidenceSize(evidence: AuditMatrixVisualEvidence): string {
  if (!evidence.screenshotWidth || !evidence.screenshotHeight) return "not measured";
  return `${evidence.screenshotWidth} x ${evidence.screenshotHeight}`;
}

function resolveAuditMatrixScreenshotSrc(
  evidence: AuditMatrixVisualEvidence,
  profiles: Array<{ label: string; outputDir: string }>,
  baseOutputDir: string
): string {
  const profile = profiles.find((candidate) => candidate.label === evidence.label);
  if (!profile || !evidence.screenshot) return evidence.screenshot || "";
  return relativeMatrixPath(baseOutputDir, path.join(profile.outputDir, evidence.screenshot));
}

function relativeMatrixPath(baseOutputDir: string, targetPath: string): string {
  const [filePath, hash = ""] = targetPath.split("#", 2);
  const relative = path.relative(baseOutputDir, filePath).replace(/\\/g, "/") || path.basename(filePath);
  return `${relative}${hash ? `#${hash}` : ""}`;
}

function slugifyMatrixId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "state";
}

function capitalizeWords(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditMatrixRuleTable(rules: AuditMatrixRuleDifference[]): string {
  if (rules.length === 0) return "No rule-level differences found in the available summaries.";
  return [
    "| Rule | Severity | Total | Profile counts |",
    "|---|---|---:|---|",
    ...rules.map((rule) => (
      `| \`${escapeMarkdownTableCell(rule.ruleId)}\` | ${rule.severity} | ${rule.total} | ${escapeMarkdownTableCell(formatProfileCounts(rule.profileCounts))} |`
    ))
  ].join("\n");
}

function formatAuditMatrixHotspots<T extends { target: { label: string }; outputDir: string; summary?: AuditDeviceSummary }>(
  profileHeading: string,
  results: T[],
  commandForResult?: (result: T) => string | undefined
): string {
  const completed = results.filter((result) => result.summary);
  if (completed.length === 0) {
    return `## Review Hotspots

No completed profile summaries were available. Open each generated visual report directly.`;
  }

  return [
    "## Review Hotspots",
    "",
    "Open the visual report for the profile, then start with these pages or states.",
    "",
    `| ${profileHeading} | Start here | Top rule signals | Report | Re-run just this profile |`,
    "|---|---|---|---|---|",
    ...completed.map((result) => (
      `| ${escapeMarkdownTableCell(result.target.label)} | ${escapeMarkdownTableCell(formatAuditMatrixHotspotTarget(result.summary))} | ${escapeMarkdownTableCell(formatAuditMatrixTopRules(result.summary))} | [Open report](${escapeMarkdownLink(`${result.outputDir}/a11y-report.html`)}) | ${formatAuditMatrixRerunCell(commandForResult?.(result))} |`
    ))
  ].join("\n");
}

function formatAuditMatrixReproductionNotes<T extends { target: { label: string }; failed: boolean; outputDir: string; summary?: AuditDeviceSummary }>(
  kind: "device" | "browser",
  profileHeading: string,
  results: T[],
  commandForResult?: (result: T) => string | undefined
): string {
  const completed = results.filter((result) => result.summary);
  if (completed.length === 0) {
    return `## Reproduction Notes

No completed profile summaries were available. Re-run the failed profiles after checking server availability, auth state, and bot-detection blockers.`;
  }

  return [
    "## Reproduction Notes",
    "",
    kind === "device"
      ? "Responsive differences should be reproduced in the same viewport or Playwright device before filing a bug."
      : "Browser differences should be reproduced in the same browser engine before filing a bug.",
    "",
    `| ${profileHeading} | What to confirm | Re-run command |`,
    "|---|---|---|",
    ...completed.map((result) => (
      `| ${escapeMarkdownTableCell(result.target.label)} | ${escapeMarkdownTableCell(formatAuditMatrixReproductionNote(kind, result.target.label))} | ${formatAuditMatrixRerunCell(commandForResult?.(result))} |`
    ))
  ].join("\n");
}

function formatAuditMatrixReproductionNote(kind: "device" | "browser", label: string): string {
  if (kind === "device") {
    return /^desktop$/i.test(label)
      ? "Use as the desktop comparison baseline for responsive issues."
      : "Compare against the desktop report; treat profile-only findings as responsive signals until confirmed.";
  }

  return /^chromium$/i.test(label)
    ? "Use as the Chromium comparison baseline unless your target users rely on another browser."
    : "Compare against Chromium and this browser report; treat engine-only findings as browser signals until confirmed.";
}

function formatAuditMatrixHotspotTarget(summary?: AuditDeviceSummary): string {
  const topState = summary?.topStates?.[0];
  if (topState) {
    return `${topState.label || topState.id} (${topState.issueCount} finding${topState.issueCount === 1 ? "" : "s"}, depth ${topState.depth})`;
  }

  const topPage = summary?.topPages?.[0];
  if (topPage) {
    return `${topPage.page} (${topPage.total} finding${topPage.total === 1 ? "" : "s"})`;
  }

  return "No findings in completed summary";
}

function formatAuditMatrixTopRules(summary?: AuditDeviceSummary, limit = 3): string {
  const rules = (summary?.topRules || []).slice(0, limit);
  if (rules.length === 0) return "No rule findings";
  return rules.map((rule) => `${rule.ruleId}: ${rule.count}`).join("; ");
}

function formatAuditMatrixRerunCell(command?: string): string {
  return command ? `\`${escapeMarkdownTableCell(command)}\`` : "not available";
}

function buildAuditDeviceRerunCommand(
  result: { target: AuditDeviceTarget; outputDir: string },
  options: Pick<AuditOptions, "url" | "depth" | "maxDepth" | "limit" | "withLighthouse" | "keyboard" | "screenshots" | "standard" | "authState" | "waitMs" | "waitForSelector">
): string {
  const args = baseAuditRerunArgs(options, result.outputDir);
  if (result.target.device) args.push("--device", result.target.device);
  return formatCliCommand(args);
}

function buildAuditBrowserRerunCommand(
  result: { target: AuditBrowserTarget; outputDir: string },
  options: Pick<AuditOptions, "url" | "depth" | "maxDepth" | "limit" | "withLighthouse" | "keyboard" | "screenshots" | "standard" | "authState" | "waitMs" | "waitForSelector">
): string {
  return formatCliCommand([
    ...baseAuditRerunArgs(options, result.outputDir),
    "--browser",
    result.target.browser
  ]);
}

function baseAuditRerunArgs(
  options: Pick<AuditOptions, "url" | "depth" | "maxDepth" | "limit" | "withLighthouse" | "keyboard" | "screenshots" | "standard" | "authState" | "waitMs" | "waitForSelector">,
  outputDir: string
): string[] {
  const args = [
    "audit",
    "--url",
    options.url,
    "--max-depth",
    resolveAuditDepthOption(options) || "2",
    "--limit",
    options.limit || "20",
    "--out",
    outputDir
  ];
  if (options.standard) args.push("--standard", options.standard);
  if (options.authState) args.push("--auth-state", options.authState);
  if (options.waitMs) args.push("--wait-ms", options.waitMs);
  if (options.waitForSelector) args.push("--wait-for-selector", options.waitForSelector);
  if (options.withLighthouse) args.push("--with-lighthouse");
  if (options.keyboard === false) args.push("--no-keyboard");
  if (options.screenshots === false) args.push("--no-screenshots");
  return args;
}

function formatCliCommand(args: string[]): string {
  return ["npx", "a11y-shiftleft-cli", ...args.map(quoteCliArg)].join(" ");
}

function quoteCliArg(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function formatProfileCounts(profileCounts: Record<string, number>): string {
  return Object.entries(profileCounts)
    .map(([label, count]) => `${label}: ${count}`)
    .join("; ");
}

function severityRankValue(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function formatDeviceSummaryCounts(result: { summary?: AuditDeviceSummary }): string {
  if (!result.summary) return "not available";
  return `${result.summary.total} total (${result.summary.critical} critical, ${result.summary.warning} warning, ${result.summary.info} info)`;
}

function formatDeviceSummaryStates(result: { summary?: AuditDeviceSummary }): string {
  if (!result.summary || result.summary.states === undefined) return "not available";
  return String(result.summary.states);
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
}

function escapeMarkdownLink(value: string): string {
  return value.replace(/\)/g, "%29").replace(/[\r\n]+/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

export function hasAuditDeviceMatrix(options: Pick<AuditOptions, "devices">): boolean {
  return Boolean(options.devices?.some((device) => device.trim()));
}

export function resolveAuditDeviceTargets(options: Pick<AuditOptions, "device" | "devices" | "mobile" | "tablet">): AuditDeviceTarget[] {
  const requested = (options.devices || []).map((profile) => profile.trim()).filter(Boolean);
  if (requested.length === 0) return [];
  if (options.device || options.mobile || options.tablet) {
    throw new Error("Use either --devices or one of --device, --mobile, --tablet.");
  }

  const seen = new Set<string>();
  return requested.flatMap((profile) => {
    const target = auditDeviceTarget(profile);
    const key = `${target.label}|${target.device || ""}`.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [target];
  });
}

function auditDeviceTarget(profile: string): AuditDeviceTarget {
  const normalized = profile.toLowerCase();
  if (normalized === "desktop") return { label: "desktop", slug: "desktop" };
  if (normalized === "mobile") return { label: `mobile (${MOBILE_DEVICE_PRESET})`, slug: "mobile", device: MOBILE_DEVICE_PRESET };
  if (normalized === "tablet") return { label: `tablet (${TABLET_DEVICE_PRESET})`, slug: "tablet", device: TABLET_DEVICE_PRESET };
  return {
    label: profile,
    slug: slugifyDeviceProfile(profile),
    device: profile
  };
}

function slugifyDeviceProfile(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "device";
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
        blockedRequests: normalizePatternList(options.safeBlockRequest),
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
      pauseOnHumanVerification: Boolean(options.pauseOnHumanVerification),
      humanVerificationTimeoutMs: optionalNonNegativeInteger(options.humanVerificationTimeoutMs, "Human verification timeout"),
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

        if (event.type === "human-verification") {
          console.log(`[audit] Human verification detected (${event.message}). Complete it in the opened browser; waiting up to ${event.timeoutMs}ms.`);
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
      exploration: exploration.graph,
      plannedScope
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
    lighthouse,
    ignore: report.summary.ignore
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
  return normalizeHttpUrlInput(value, "--url");
}

function normalizeOptionalCliValue(value: string | undefined): string | undefined {
  return value === undefined ? undefined : normalizeCliValue(value);
}

function normalizePatternList(values: string[] | undefined): string[] | undefined {
  const patterns = (values || []).map((value) => value.trim()).filter(Boolean);
  return patterns.length > 0 ? patterns : undefined;
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
