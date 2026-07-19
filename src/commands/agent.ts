import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { createAgentReview, formatAgentReview, type AgentDashboardHistorySummary } from "../core/agentReview.js";
import { findPreviousReportInHistory, summarizeAgentHistory } from "../core/agentHistory.js";
import { collectDashboardData, type DashboardData } from "../core/dashboard.js";
import { readA11yReport } from "../core/evidenceExport.js";
import { openReportFile } from "../core/openReport.js";
import { prepareShareReport } from "../core/sharePrepare.js";
import { writeExplorationHtml } from "../reporters/writeExplorationHtml.js";
import type { A11yReport } from "../types.js";
import { runAudit, type AuditOptions } from "./audit.js";

interface AgentReviewOptions {
  report?: string;
  previous?: string;
  history?: string;
  historyMaxDepth?: string;
  maxItems?: string;
  out?: string;
  json?: boolean;
}

interface AgentRefreshHtmlOptions {
  report?: string;
  out?: string;
  fileName?: string;
  shareOut?: string;
  shareIncludeHtml?: boolean;
  open?: boolean;
}

interface AgentRunOptions extends AgentReviewOptions {
  url: string;
  profile?: string;
  withLighthouse?: boolean;
  browser?: string;
  device?: string;
  authState?: string;
  mobile?: boolean;
  tablet?: boolean;
  depth?: string;
  maxDepth?: string;
  limit?: string;
  actionsPerState?: string;
  maxTabs?: string;
  failOn?: AuditOptions["failOn"];
  standard?: string;
  wcagOnly?: boolean;
  screenshots?: boolean;
  safeBlockRequest?: string[];
  waitMs?: string;
  waitForSelector?: string;
  waitUntilUrl?: string;
  waitUntilPath?: string;
  pauseOnHumanVerification?: boolean;
  humanVerificationTimeoutMs?: string;
  open?: boolean;
  quiet?: boolean;
  reviewOut?: string;
}

export function registerAgentCommand(program: Command): void {
  const agent = program
    .command("agent")
    .description("Local deterministic review assistant for generated accessibility reports.");

  agent
    .command("review")
    .description("Summarize an accessibility report, compare progress, and suggest the next CLI step.")
    .option("--report <file-or-dir>", "Current a11y-report.json file or report directory", "reports/a11y-report.json")
    .option("--previous <file-or-dir>", "Previous a11y-report.json file or report directory for comparison")
    .option("--history <dir>", "Find the previous report automatically inside a report-history directory")
    .option("--history-max-depth <depth>", "Maximum directory depth when searching --history", "6")
    .option("--max-items <count>", "Maximum fix-first findings to show", "5")
    .option("--out <file>", "Write the review to a file instead of stdout")
    .option("--json", "Write JSON instead of text")
    .action(async (options: AgentReviewOptions) => {
      const reportPath = await resolveReportPath(options.report || "reports/a11y-report.json");
      const previousReportPath = await resolveAgentPreviousReportPath({
        reportPath,
        previous: options.previous,
        history: options.history,
        historyMaxDepth: options.historyMaxDepth
      });
      const output = await createAgentReviewOutput({
        reportPath,
        previousReportPath,
        previousReportSource: previousReportPath ? previousSourceFromOptions(options) : undefined,
        history: options.history,
        historyMaxDepth: options.historyMaxDepth,
        maxItems: options.maxItems,
        json: options.json
      });

      if (options.out) {
        const outputPath = path.resolve(options.out);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, output);
        console.log(`Wrote agent review to ${outputPath}`);
        return;
      }

      console.log(output.trimEnd());
    });

  agent
    .command("run")
    .description("Run an audit, then summarize the generated report with local next-step guidance.")
    .requiredOption("--url <url>", "Start URL for the running application")
    .option("--previous <file-or-dir>", "Previous a11y-report.json file or report directory for comparison")
    .option("--history <dir>", "Find the previous report automatically inside a report-history directory")
    .option("--history-max-depth <depth>", "Maximum directory depth when searching --history", "6")
    .option("--out <dir>", "Audit output directory", "reports")
    .option("--review-out <file>", "Write the agent review to a file after the audit")
    .option("--max-items <count>", "Maximum fix-first findings to show", "5")
    .option("--profile <profile>", "Audit goal: risk, validation, or full")
    .option("--with-lighthouse", "Add optional Lighthouse accessibility score comparison")
    .option("--browser <engine>", "Browser engine for browser and keyboard evidence: chromium, firefox, or webkit")
    .option("--device <name>", "Playwright device preset, for example \"iPhone 13\" or \"Pixel 5\"")
    .option("--auth-state <file>", "Playwright storage state file for authenticated audits")
    .option("--mobile", "Use the default mobile browser profile (iPhone 13)")
    .option("--tablet", "Use the default tablet browser profile (iPad gen 7)")
    .option("--depth <depth>", "Maximum interaction depth", "2")
    .option("--max-depth <depth>", "Maximum interaction depth; clearer alias for --depth")
    .option("--limit <limit>", "Maximum UI states", "20")
    .option("--actions-per-state <limit>", "Maximum safe actions per state", "8")
    .option("--max-tabs <count>", "Maximum Tab presses for keyboard traversal", "40")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--standard <standard>", "wcag22-aa, ada-title-ii, section508, or en301549")
    .option("--wcag-only", "Only report findings mapped to WCAG; exclude best practices and unmapped review signals")
    .option("--no-screenshots", "Do not capture visual state screenshots")
    .option("--safe-block-request <patterns...>", "Additional network request URL patterns to abort during exploration")
    .option("--wait-ms <ms>", "Extra settle time before screenshots and scans")
    .option("--wait-for-selector <selector>", "Wait for a selector before screenshots and scans")
    .option("--wait-until-url <pattern>", "Wait until the current URL contains a pattern before screenshots and scans")
    .option("--wait-until-path <path>", "Wait until the current URL reaches a path before screenshots and scans")
    .option("--pause-on-human-verification", "Open a visible browser and wait for manual CAPTCHA or human-verification completion")
    .option("--human-verification-timeout-ms <ms>", "Maximum time to wait for manual human-verification completion", "120000")
    .option("--open", "Open the visual HTML report after the audit finishes")
    .option("--quiet", "Suppress audit progress and only print the agent review")
    .action(async (options: AgentRunOptions) => {
      const result = await runAudit(toAgentAuditOptions(options));
      const reportPath = path.join(result.outputDir, "a11y-report.json");
      const previousReportPath = await resolveAgentPreviousReportPath({
        reportPath,
        previous: options.previous,
        history: options.history,
        historyMaxDepth: options.historyMaxDepth
      });
      const output = await createAgentReviewOutput({
        reportPath,
        previousReportPath,
        previousReportSource: previousReportPath ? previousSourceFromOptions(options) : undefined,
        history: options.history,
        historyMaxDepth: options.historyMaxDepth,
        maxItems: options.maxItems,
        json: false
      });

      if (options.reviewOut) {
        const outputPath = path.resolve(options.reviewOut);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, output);
        if (!options.quiet) console.log(`Wrote agent review to ${outputPath}`);
      } else {
        console.log(output.trimEnd());
      }

      if (result.failed) process.exitCode = 1;
    });

  agent
    .command("refresh-html")
    .description("Rebuild the visual HTML report from an existing a11y-report.json without rerunning the browser audit.")
    .option("--report <file-or-dir>", "Source a11y-report.json file or report directory", "reports/a11y-report.json")
    .option("--out <dir>", "Output directory; defaults to the source report directory")
    .option("--file-name <name>", "HTML file name to write", "a11y-report.html")
    .option("--share-out <dir>", "Also create a sanitized local share package after refreshing the HTML report")
    .option("--share-include-html", "Include a self-contained visual HTML copy in --share-out; review screenshots before sharing")
    .option("--open", "Open the refreshed visual HTML report")
    .action(async (options: AgentRefreshHtmlOptions) => {
      const reportPath = await resolveReportPath(options.report || "reports/a11y-report.json");
      const report = await readA11yReport(reportPath);
      const outputDir = path.resolve(options.out || path.dirname(reportPath));
      const fileName = options.fileName || "a11y-report.html";

      const refreshSummary = await refreshVisualHtmlReport({
        report,
        reportPath,
        outputDir,
        fileName
      });
      if (refreshSummary.copiedAssetDirs > 0) {
        console.log(`Copied visual asset directories: ${refreshSummary.copiedAssetDirs}`);
      }
      if (refreshSummary.missingAssetDirs > 0) {
        console.warn(`Referenced visual asset directories not found: ${refreshSummary.missingAssetDirs}`);
      }
      if (refreshSummary.copiedReportJson) {
        console.log("Copied a11y-report.json for refreshed output.");
      }

      const htmlPath = path.join(outputDir, fileName);
      console.log(`Refreshed visual HTML report: ${htmlPath}`);

      if (options.shareOut) {
        const shareManifest = await prepareShareReport({
          reportPath: outputDir,
          outputDir: path.resolve(options.shareOut),
          includeHtml: Boolean(options.shareIncludeHtml)
        });
        console.log(`Created sanitized local share package with ${shareManifest.outputs.length} file${shareManifest.outputs.length === 1 ? "" : "s"}: ${path.resolve(options.shareOut)}`);
        console.log(`Review privacy summary: ${path.join(path.resolve(options.shareOut), "privacy-summary.json")}`);
      }

      if (options.open) {
        try {
          await openReportFile(htmlPath);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Could not open the report automatically: ${message}`);
          console.warn(`Open it manually: ${htmlPath}`);
        }
      }
    });
}

async function refreshVisualHtmlReport(options: {
  report: A11yReport;
  reportPath: string;
  outputDir: string;
  fileName: string;
}): Promise<{ copiedAssetDirs: number; missingAssetDirs: number; copiedReportJson: boolean }> {
  if (!options.report.exploration) {
    throw new Error("Cannot refresh visual HTML because this report does not include exploration evidence. Run audit or explore to create a visual report first.");
  }

  const assetSummary = await copyReferencedVisualAssets(path.dirname(options.reportPath), options.outputDir, options.report);
  const copiedReportJson = await copyReportJsonIfNeeded(options.reportPath, options.outputDir);
  await writeExplorationHtml(options.outputDir, options.report.exploration, options.report.issues, {
    fileName: options.fileName,
    title: "Accessibility Audit Report",
    keyboard: options.report.keyboard,
    manualChecklist: options.report.manualChecklist,
    lighthouse: options.report.lighthouse,
    ignore: options.report.summary.ignore,
    retention: options.report.summary.retention
  });

  return {
    ...assetSummary,
    copiedReportJson
  };
}

async function copyReportJsonIfNeeded(reportPath: string, outputDir: string): Promise<boolean> {
  const sourcePath = path.resolve(reportPath);
  const outputPath = path.resolve(outputDir, "a11y-report.json");
  if (sourcePath === outputPath) return false;

  await fs.mkdir(outputDir, { recursive: true });
  await fs.copyFile(sourcePath, outputPath);
  return true;
}

async function copyReferencedVisualAssets(
  sourceDir: string,
  outputDir: string,
  report: A11yReport
): Promise<{ copiedAssetDirs: number; missingAssetDirs: number }> {
  const from = path.resolve(sourceDir);
  const to = path.resolve(outputDir);
  if (from === to) {
    return {
      copiedAssetDirs: 0,
      missingAssetDirs: 0
    };
  }

  let copiedAssetDirs = 0;
  let missingAssetDirs = 0;

  for (const relativeDir of referencedRelativeAssetDirs(report)) {
    const sourceAssetDir = path.join(from, relativeDir);
    const outputAssetDir = path.join(to, relativeDir);

    try {
      await fs.cp(sourceAssetDir, outputAssetDir, { recursive: true, force: true });
      copiedAssetDirs += 1;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        missingAssetDirs += 1;
        continue;
      }
      throw error;
    }
  }

  return {
    copiedAssetDirs,
    missingAssetDirs
  };
}

function referencedRelativeAssetDirs(report: A11yReport): string[] {
  const paths = [
    ...(report.exploration?.states || []).flatMap((state) => [
      state.screenshot,
      ...(state.screenshotEvidence || []).map((evidence) => evidence.path)
    ]),
    ...report.issues.map((issue) => issue.screenshot)
  ].filter((value): value is string => Boolean(value));

  const dirs = paths
    .filter((value) => !path.isAbsolute(value))
    .map((value) => path.dirname(value))
    .filter((value) => value && value !== ".");

  return [...new Set(dirs)].sort();
}

async function resolveAgentPreviousReportPath(options: {
  reportPath: string;
  previous?: string;
  history?: string;
  historyMaxDepth?: string;
}): Promise<string | undefined> {
  if (options.previous) return resolveReportPath(options.previous);
  if (!options.history) return undefined;

  const currentReport = await readA11yReport(options.reportPath);
  return findPreviousReportInHistory({
    currentReportPath: options.reportPath,
    currentReport,
    historyRoot: options.history,
    maxDepth: toPositiveInteger(options.historyMaxDepth)
  });
}

async function createAgentReviewOutput(options: {
  reportPath: string;
  previousReportPath?: string;
  previousReportSource?: "explicit" | "history";
  history?: string;
  historyMaxDepth?: string;
  maxItems?: string;
  json?: boolean;
}): Promise<string> {
  const report = await readA11yReport(options.reportPath);
  const previousReport = options.previousReportPath ? await readA11yReport(options.previousReportPath) : undefined;
  const history = options.history
    ? await summarizeAgentHistory({
      currentReportPath: options.reportPath,
      currentReport: report,
      historyRoot: options.history,
      maxDepth: toPositiveInteger(options.historyMaxDepth)
    })
    : undefined;
  const dashboardHistory = options.history
    ? toAgentDashboardHistorySummary(await collectDashboardData(options.history, {
      maxDepth: toPositiveInteger(options.historyMaxDepth)
    }))
    : undefined;
  const review = createAgentReview({
    report,
    previousReport,
    reportPath: options.reportPath,
    previousReportPath: options.previousReportPath,
    previousReportSource: options.previousReportSource,
    history,
    dashboardHistory,
    historyRoot: options.history,
    maxItems: toPositiveInteger(options.maxItems)
  });

  return options.json
    ? `${JSON.stringify(review, null, 2)}\n`
    : formatAgentReview(review);
}

function previousSourceFromOptions(options: Pick<AgentReviewOptions, "previous" | "history">): "explicit" | "history" {
  return options.previous ? "explicit" : "history";
}

function toAgentAuditOptions(options: AgentRunOptions): AuditOptions {
  return {
    url: options.url,
    profile: options.profile,
    withLighthouse: options.withLighthouse,
    out: options.out,
    browser: options.browser,
    device: options.device,
    authState: options.authState,
    mobile: options.mobile,
    tablet: options.tablet,
    depth: options.depth,
    maxDepth: options.maxDepth,
    limit: options.limit,
    actionsPerState: options.actionsPerState,
    maxTabs: options.maxTabs,
    failOn: options.failOn,
    standard: options.standard,
    wcagOnly: options.wcagOnly,
    screenshots: options.screenshots,
    safeBlockRequest: options.safeBlockRequest,
    waitMs: options.waitMs,
    waitForSelector: options.waitForSelector,
    waitUntilUrl: options.waitUntilUrl,
    waitUntilPath: options.waitUntilPath,
    pauseOnHumanVerification: options.pauseOnHumanVerification,
    humanVerificationTimeoutMs: options.humanVerificationTimeoutMs,
    open: options.open,
    quiet: options.quiet
  };
}

function toAgentDashboardHistorySummary(data: DashboardData): AgentDashboardHistorySummary {
  return {
    totalRuns: data.totalRuns,
    latestRunId: data.latestDelta?.latestRunId || data.latestRun?.id,
    previousRunId: data.latestDelta?.previousRunId,
    totalChange: data.latestDelta?.total.change,
    criticalChange: data.latestDelta?.critical.change,
    lighthouseScoreChange: data.latestDelta?.lighthouseScore.change,
    ruleRegressions: (data.regressions?.rules || []).slice(0, 3).map((item) => ({
      id: item.id,
      change: item.change
    })),
    ruleResolved: (data.resolved?.rules || []).slice(0, 3).map((item) => ({
      id: item.id,
      resolved: item.resolved
    }))
  };
}

async function resolveReportPath(fileOrDir: string): Promise<string> {
  const resolved = path.resolve(fileOrDir);
  const stats = await fs.stat(resolved);
  return stats.isDirectory() ? path.join(resolved, "a11y-report.json") : resolved;
}

function toPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Maximum item count must be a positive integer.");
  }
  return parsed;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
