import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { createAgentReview, formatAgentReview } from "../core/agentReview.js";
import { findPreviousReportInHistory, summarizeAgentHistory } from "../core/agentHistory.js";
import { readA11yReport } from "../core/evidenceExport.js";
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
  const review = createAgentReview({
    report,
    previousReport,
    reportPath: options.reportPath,
    previousReportPath: options.previousReportPath,
    previousReportSource: options.previousReportSource,
    history,
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
