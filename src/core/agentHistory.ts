import fs from "node:fs/promises";
import path from "node:path";
import type { A11yReport } from "../types.js";
import { readA11yReport } from "./evidenceExport.js";

export interface AgentHistoryOptions {
  currentReportPath: string;
  currentReport: A11yReport;
  historyRoot: string;
  maxDepth?: number;
}

export interface AgentHistorySummary {
  totalRuns: number;
  firstRunId: string;
  currentRunId: string;
  previousRunId?: string;
  totalDeltaFromFirst: number;
  criticalDeltaFromFirst: number;
  warningDeltaFromFirst: number;
  infoDeltaFromFirst: number;
  ruleRegressions: AgentHistoryRuleChange[];
  ruleImprovements: AgentHistoryRuleChange[];
  pageRegressions: AgentHistoryPageChange[];
  pageImprovements: AgentHistoryPageChange[];
}

export interface AgentHistoryRuleChange {
  ruleId: string;
  first: number;
  current: number;
  change: number;
}

export interface AgentHistoryPageChange {
  url: string;
  first: number;
  current: number;
  change: number;
}

interface AgentHistoryRun {
  path: string;
  id: string;
  generatedAt: string;
  report: A11yReport;
  total: number;
  critical: number;
  warning: number;
  info: number;
}

const DEFAULT_HISTORY_MAX_DEPTH = 6;
const REPORT_FILE = "a11y-report.json";
const IGNORED_DIRECTORIES = new Set([
  ".git",
  "dist",
  "dist-test",
  "node_modules",
  "playwright-report"
]);

export async function findPreviousReportInHistory(options: AgentHistoryOptions): Promise<string | undefined> {
  const currentPath = path.resolve(options.currentReportPath);
  const previous = (await readHistoryRuns(options)).filter((candidate) => path.resolve(candidate.path) !== currentPath);

  const currentGeneratedAt = options.currentReport.generatedAt;
  const older = previous
    .filter((candidate) => candidate.generatedAt < currentGeneratedAt)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  if (older[0]) return older[0].path;

  return previous
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0]?.path;
}

export async function summarizeAgentHistory(options: AgentHistoryOptions): Promise<AgentHistorySummary | undefined> {
  const runs = await readHistoryRuns(options);
  const currentPath = path.resolve(options.currentReportPath);
  const hasCurrent = runs.some((run) => path.resolve(run.path) === currentPath);
  const allRuns = (hasCurrent ? runs : [
    ...runs,
    toHistoryRun(currentPath, options.currentReport, options.historyRoot)
  ]).sort((left, right) => left.generatedAt.localeCompare(right.generatedAt));

  if (allRuns.length < 2) return undefined;

  const first = allRuns[0];
  const currentIndex = allRuns.findIndex((run) => path.resolve(run.path) === currentPath);
  const current = currentIndex === -1 ? allRuns.at(-1) : allRuns[currentIndex];
  if (!first || !current) return undefined;

  const previous = allRuns
    .filter((run) => run.generatedAt < current.generatedAt)
    .at(-1);

  return {
    totalRuns: allRuns.length,
    firstRunId: first.id,
    currentRunId: current.id,
    previousRunId: previous?.id,
    totalDeltaFromFirst: current.total - first.total,
    criticalDeltaFromFirst: current.critical - first.critical,
    warningDeltaFromFirst: current.warning - first.warning,
    infoDeltaFromFirst: current.info - first.info,
    ruleRegressions: compareRuleCounts(first.report, current.report, "regression").slice(0, 3),
    ruleImprovements: compareRuleCounts(first.report, current.report, "improvement").slice(0, 3),
    pageRegressions: comparePageCounts(first.report, current.report, "regression").slice(0, 3),
    pageImprovements: comparePageCounts(first.report, current.report, "improvement").slice(0, 3)
  };
}

export async function findHistoryReportFiles(rootDir: string, maxDepth = DEFAULT_HISTORY_MAX_DEPTH): Promise<string[]> {
  const files: string[] = [];

  async function visit(dir: string, depth: number): Promise<void> {
    let entries: Array<import("node:fs").Dirent>;

    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);

      if (entry.isFile() && entry.name === REPORT_FILE) {
        files.push(absolutePath);
        continue;
      }

      if (!entry.isDirectory() || depth >= maxDepth || IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await visit(absolutePath, depth + 1);
    }
  }

  await visit(path.resolve(rootDir), 0);
  return files.sort();
}

async function readHistoryRuns(options: AgentHistoryOptions): Promise<AgentHistoryRun[]> {
  const root = path.resolve(options.historyRoot);
  const candidates = await findHistoryReportFiles(root, positiveOrDefault(options.maxDepth, DEFAULT_HISTORY_MAX_DEPTH));
  const runs: AgentHistoryRun[] = [];

  for (const candidate of candidates) {
    try {
      runs.push(toHistoryRun(candidate, await readA11yReport(candidate), root));
    } catch {
      // Ignore unrelated JSON files named a11y-report.json in mixed report roots.
    }
  }

  return runs;
}

function toHistoryRun(reportPath: string, report: A11yReport, rootDir: string): AgentHistoryRun {
  return {
    path: path.resolve(reportPath),
    id: normalizePath(path.relative(path.resolve(rootDir), path.resolve(reportPath))) || path.basename(path.dirname(reportPath)),
    generatedAt: report.generatedAt,
    report,
    total: report.summary.total,
    critical: report.summary.critical,
    warning: report.summary.warning,
    info: report.summary.info
  };
}

function compareRuleCounts(
  firstReport: A11yReport,
  currentReport: A11yReport,
  direction: "regression" | "improvement"
): AgentHistoryRuleChange[] {
  const firstCounts = countRules(firstReport);
  const currentCounts = countRules(currentReport);
  const ruleIds = new Set([...firstCounts.keys(), ...currentCounts.keys()]);
  const changes: AgentHistoryRuleChange[] = [];

  for (const ruleId of ruleIds) {
    const first = firstCounts.get(ruleId) || 0;
    const current = currentCounts.get(ruleId) || 0;
    const change = current - first;
    if (direction === "regression" && change <= 0) continue;
    if (direction === "improvement" && change >= 0) continue;

    changes.push({
      ruleId,
      first,
      current,
      change
    });
  }

  return changes.sort((left, right) => {
    const magnitude = Math.abs(right.change) - Math.abs(left.change);
    if (magnitude !== 0) return magnitude;
    if (right.current !== left.current) return right.current - left.current;
    return left.ruleId.localeCompare(right.ruleId);
  });
}

function countRules(report: A11yReport): Map<string, number> {
  const counts = new Map<string, number>();

  for (const issue of report.issues || []) {
    const ruleId = issue.ruleId || "unknown";
    counts.set(ruleId, (counts.get(ruleId) || 0) + 1 + (issue.duplicateCount || 0));
  }

  return counts;
}

function comparePageCounts(
  firstReport: A11yReport,
  currentReport: A11yReport,
  direction: "regression" | "improvement"
): AgentHistoryPageChange[] {
  const firstCounts = countPages(firstReport);
  const currentCounts = countPages(currentReport);
  const urls = new Set([...firstCounts.keys(), ...currentCounts.keys()]);
  const changes: AgentHistoryPageChange[] = [];

  for (const url of urls) {
    const first = firstCounts.get(url) || 0;
    const current = currentCounts.get(url) || 0;
    const change = current - first;
    if (direction === "regression" && change <= 0) continue;
    if (direction === "improvement" && change >= 0) continue;

    changes.push({
      url,
      first,
      current,
      change
    });
  }

  return changes.sort((left, right) => {
    const magnitude = Math.abs(right.change) - Math.abs(left.change);
    if (magnitude !== 0) return magnitude;
    if (right.current !== left.current) return right.current - left.current;
    return left.url.localeCompare(right.url);
  });
}

function countPages(report: A11yReport): Map<string, number> {
  const counts = new Map<string, number>();

  for (const page of report.summary.byPage || []) {
    counts.set(page.url, page.total);
  }

  return counts;
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
