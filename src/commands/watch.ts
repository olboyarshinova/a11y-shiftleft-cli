import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { runCheck } from "./check.js";
import type { CheckOptions } from "./check.js";
import type { A11yReport } from "../types.js";

const DEFAULT_WATCH_PATHS = ["src", "app", "pages", "components"];
const DEFAULT_WATCH_OUT = "reports/watch";
const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_INTERVAL_MS = 1000;
const WATCH_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".html",
  ".htm",
  ".js",
  ".jsx",
  ".less",
  ".mjs",
  ".scss",
  ".sass",
  ".ts",
  ".tsx",
  ".vue"
]);
const IGNORED_DIRECTORIES = new Set([
  ".a11y-reports",
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "dist-test",
  "node_modules",
  "out",
  "playwright-report",
  "reports"
]);

interface WatchOptions extends CheckOptions {
  watchPath?: string[];
  debounce?: string;
  interval?: string;
  maxRuns?: string;
  initial?: boolean;
}

export interface WatchFileMetadata {
  mtimeMs: number;
  size: number;
}

export type WatchSnapshot = Map<string, WatchFileMetadata>;

export interface WatchChangeSummary {
  added: string[];
  modified: string[];
  deleted: string[];
}

export interface WatchDeltaSummary {
  firstRun: boolean;
  newFindings: number;
  fixedFindings: number;
  remainingFindings: number;
  totalDelta: number;
  criticalDelta: number;
  warningDelta: number;
  infoDelta: number;
}

export function registerWatchCommand(program: Command): void {
  program
    .command("watch")
    .description("Watch local files and rerun accessibility checks after changes.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .option("--static", "Run static checks only")
    .option("--dynamic", "Run dynamic checks only")
    .option("--url <urls...>", "Target URL(s) for dynamic scan")
    .option("--crawl", "Discover and scan same-origin links from dynamic URLs")
    .option("--crawl-depth <depth>", "Maximum same-origin crawl depth", "1")
    .option("--crawl-limit <limit>", "Maximum discovered URLs to scan", "10")
    .option("--include <patterns...>", "Static file globs to scan")
    .option("--format <formats...>", "Report formats: json, csv, markdown, or all")
    .option("--out <dir>", "Output directory for refreshed reports", DEFAULT_WATCH_OUT)
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, section508, or en301549")
    .option("--wcag-filter <level>", "Only report findings mapped to WCAG level A, AA, or AAA")
    .option("--wcag-version <version>", "Limit mapped findings to WCAG version 2.0, 2.1, or 2.2")
    .option("--semi-auto", "Generate a Markdown manual review checklist alongside automated reports")
    .option("--baseline", "Compare against .a11y-baseline.json and fail only on new findings")
    .option("--baseline-file <file>", "Baseline file path")
    .option("--update-baseline", "Overwrite the baseline file with the current findings")
    .option("--ignore-file <file>", "Scoped ignore file path")
    .option("--no-ignore", "Disable a11y-ignore.json filtering")
    .option("--retention-max-runs <count>", "Keep at most this many report run directories including the current output")
    .option("--retention-max-age-days <days>", "Remove report run directories older than this many days")
    .option("--retention-dry-run", "Preview report retention cleanup without deleting old runs")
    .option("--no-retention", "Disable report retention cleanup")
    .option("--watch-path <paths...>", "Files or directories to watch", DEFAULT_WATCH_PATHS)
    .option("--debounce <ms>", "Delay after the last detected file change before rescanning", String(DEFAULT_DEBOUNCE_MS))
    .option("--interval <ms>", "File polling interval", String(DEFAULT_INTERVAL_MS))
    .option("--max-runs <count>", "Stop after this many scans; useful for smoke tests")
    .option("--no-initial", "Wait for a file change before the first scan")
    .option("--quiet", "Suppress watch status output")
    .option("--verbose", "Print changed file samples and scan timing")
    .action(async (options: WatchOptions) => {
      await runWatch(options);
    });
}

export async function runWatch(options: WatchOptions): Promise<void> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const debounceMs = toPositiveInteger(options.debounce) || DEFAULT_DEBOUNCE_MS;
  const intervalMs = toPositiveInteger(options.interval) || DEFAULT_INTERVAL_MS;
  const maxRuns = toPositiveInteger(options.maxRuns);
  const watchPaths = normalizeWatchPaths(options.watchPath);
  let snapshot = await collectWatchSnapshot(cwd, watchPaths);
  let previousReport: A11yReport | undefined;
  let runCount = 0;
  let lastFailed = false;
  let running = false;
  let pendingChanges: WatchChangeSummary | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let stopWatch: (() => void) | undefined;

  const scan = async (reason: string, changes: WatchChangeSummary): Promise<void> => {
    if (running) {
      pendingChanges = mergeWatchChanges(pendingChanges, changes);
      return;
    }

    running = true;
    const startedAt = Date.now();
    runCount += 1;
    const currentRun = runCount;

    try {
      const result = await runCheck({
        ...toCheckOptions(options),
        cwd,
        quiet: true
      });
      const durationMs = Date.now() - startedAt;
      const delta = summarizeWatchDelta(previousReport, result.report);
      lastFailed = result.failed;

      if (!options.quiet) {
        console.log(formatWatchRunSummary({
          reason,
          runCount: currentRun,
          report: result.report,
          delta,
          changes,
          outputDir: options.out || DEFAULT_WATCH_OUT,
          durationMs,
          verbose: Boolean(options.verbose)
        }));
      }

      previousReport = result.report;
    } catch (error) {
      lastFailed = true;
      console.error(formatWatchError(error));
    } finally {
      running = false;
    }

    if (maxRuns && runCount >= maxRuns) {
      if (stopWatch) {
        stopWatch();
      } else {
        stopped = true;
        if (debounceTimer) clearTimeout(debounceTimer);
        process.exitCode = lastFailed ? 1 : 0;
      }
      return;
    }

    if (pendingChanges) {
      const nextChanges = pendingChanges;
      pendingChanges = undefined;
      scheduleScan("pending changes", nextChanges);
    }
  };

  const scheduleScan = (reason: string, changes: WatchChangeSummary): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void scan(reason, changes);
    }, debounceMs);
  };

  if (!options.quiet) {
    console.log(formatWatchStart({ cwd, watchPaths, intervalMs, debounceMs, outputDir: options.out || DEFAULT_WATCH_OUT }));
  }

  if (options.initial !== false) {
    await scan("initial scan", emptyWatchChanges());
    if (stopped) return;
  }

  await new Promise<void>((resolve) => {
    const stop = (): void => {
      if (stopped) {
        resolve();
        return;
      }

      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      process.off("SIGINT", stop);
      if (!options.quiet) console.log("a11y-shiftleft watch stopped.");
      process.exitCode = lastFailed ? 1 : 0;
      resolve();
    };

    stopWatch = stop;
    process.once("SIGINT", stop);

    pollTimer = setInterval(() => {
      void (async () => {
        if (stopped || running) return;

        const nextSnapshot = await collectWatchSnapshot(cwd, watchPaths);
        const changes = diffWatchSnapshots(snapshot, nextSnapshot);
        snapshot = nextSnapshot;

        if (watchChangeCount(changes) > 0) {
          scheduleScan("file changes", changes);
        }
      })().catch((error) => {
        console.error(formatWatchError(error));
      });
    }, intervalMs);
  });
}

export async function collectWatchSnapshot(cwd: string, watchPaths = DEFAULT_WATCH_PATHS): Promise<WatchSnapshot> {
  const snapshot: WatchSnapshot = new Map();
  const roots = await existingWatchRoots(cwd, watchPaths);

  for (const root of roots) {
    await collectPathSnapshot(cwd, root, snapshot);
  }

  return snapshot;
}

export function diffWatchSnapshots(previous: WatchSnapshot, current: WatchSnapshot): WatchChangeSummary {
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const [file, metadata] of current) {
    const before = previous.get(file);
    if (!before) {
      added.push(file);
    } else if (before.mtimeMs !== metadata.mtimeMs || before.size !== metadata.size) {
      modified.push(file);
    }
  }

  for (const file of previous.keys()) {
    if (!current.has(file)) deleted.push(file);
  }

  return {
    added: added.sort(),
    modified: modified.sort(),
    deleted: deleted.sort()
  };
}

export function summarizeWatchDelta(previous: A11yReport | undefined, current: A11yReport): WatchDeltaSummary {
  if (!previous) {
    return {
      firstRun: true,
      newFindings: current.summary.total,
      fixedFindings: 0,
      remainingFindings: current.summary.total,
      totalDelta: 0,
      criticalDelta: 0,
      warningDelta: 0,
      infoDelta: 0
    };
  }

  const previousFingerprints = new Set(previous.issues.map((issue) => issue.fingerprint));
  const currentFingerprints = new Set(current.issues.map((issue) => issue.fingerprint));
  const fixedFindings = previous.issues.filter((issue) => !currentFingerprints.has(issue.fingerprint)).length;
  const newFindings = current.issues.filter((issue) => !previousFingerprints.has(issue.fingerprint)).length;

  return {
    firstRun: false,
    newFindings,
    fixedFindings,
    remainingFindings: current.summary.total,
    totalDelta: current.summary.total - previous.summary.total,
    criticalDelta: current.summary.critical - previous.summary.critical,
    warningDelta: current.summary.warning - previous.summary.warning,
    infoDelta: current.summary.info - previous.summary.info
  };
}

export function formatWatchRunSummary(options: {
  reason: string;
  runCount: number;
  report: A11yReport;
  delta: WatchDeltaSummary;
  changes: WatchChangeSummary;
  outputDir: string;
  durationMs: number;
  verbose?: boolean;
}): string {
  const summary = options.report.summary;
  const changes = watchChangeCount(options.changes);
  const delta = options.delta.firstRun
    ? `first run, tracking ${summary.total} current findings`
    : `fixed ${options.delta.fixedFindings}, new ${options.delta.newFindings}, remaining ${options.delta.remainingFindings}, total delta ${formatSignedNumber(options.delta.totalDelta)}`;
  const lines = [
    "",
    `a11y-shiftleft watch run ${options.runCount}`,
    `Reason: ${options.reason}`,
    `Changed files: ${changes}`,
    `Findings: total ${summary.total} | critical ${summary.critical} | warning ${summary.warning} | info ${summary.info}`,
    `Delta: ${delta}`,
    `Duration: ${options.durationMs}ms`,
    `Reports: ${joinOutputPath(options.outputDir, "a11y-comment.md")}`
  ];

  if (options.verbose && changes > 0) {
    lines.push("Changed file sample:");
    lines.push(...formatChangedFileSample(options.changes).map((file) => `  - ${file}`));
  }

  return lines.join("\n");
}

export function formatWatchStart(options: {
  cwd: string;
  watchPaths: string[];
  intervalMs: number;
  debounceMs: number;
  outputDir: string;
}): string {
  return [
    "a11y-shiftleft watch",
    `Project: ${options.cwd}`,
    `Watching: ${options.watchPaths.join(", ")}`,
    `Interval: ${options.intervalMs}ms`,
    `Debounce: ${options.debounceMs}ms`,
    `Reports: ${joinOutputPath(options.outputDir, "a11y-comment.md")}`,
    "Press Ctrl+C to stop."
  ].join("\n");
}

function toCheckOptions(options: WatchOptions): CheckOptions {
  return {
    cwd: options.cwd,
    config: options.config,
    framework: options.framework,
    static: options.static,
    dynamic: options.dynamic,
    url: options.url,
    crawl: options.crawl,
    crawlDepth: options.crawlDepth,
    crawlLimit: options.crawlLimit,
    include: options.include,
    format: options.format,
    out: options.out || DEFAULT_WATCH_OUT,
    failOn: options.failOn,
    standard: options.standard,
    wcagFilter: options.wcagFilter,
    wcagVersion: options.wcagVersion,
    semiAuto: options.semiAuto,
    baseline: options.baseline,
    baselineFile: options.baselineFile,
    updateBaseline: options.updateBaseline,
    ignore: options.ignore,
    ignoreFile: options.ignoreFile,
    retention: options.retention,
    retentionMaxRuns: options.retentionMaxRuns,
    retentionMaxAgeDays: options.retentionMaxAgeDays,
    retentionDryRun: options.retentionDryRun,
    verbose: false,
    jsonSummary: false
  };
}

function normalizeWatchPaths(paths: string[] | undefined): string[] {
  const normalized = (paths && paths.length > 0 ? paths : DEFAULT_WATCH_PATHS)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
}

async function existingWatchRoots(cwd: string, watchPaths: string[]): Promise<string[]> {
  const roots: string[] = [];

  for (const watchPath of normalizeWatchPaths(watchPaths)) {
    const resolved = path.resolve(cwd, watchPath);

    try {
      await fs.stat(resolved);
      roots.push(resolved);
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }
  }

  return roots.length > 0 ? roots : [cwd];
}

async function collectPathSnapshot(cwd: string, filePath: string, snapshot: WatchSnapshot): Promise<void> {
  let stat;

  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;
    throw error;
  }

  if (stat.isDirectory()) {
    if (IGNORED_DIRECTORIES.has(path.basename(filePath))) return;

    const entries = await fs.readdir(filePath, { withFileTypes: true });
    const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sorted) {
      await collectPathSnapshot(cwd, path.join(filePath, entry.name), snapshot);
    }

    return;
  }

  if (!stat.isFile() || !shouldWatchFile(filePath)) return;

  snapshot.set(path.relative(cwd, filePath), {
    mtimeMs: stat.mtimeMs,
    size: stat.size
  });
}

function shouldWatchFile(filePath: string): boolean {
  return WATCH_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function emptyWatchChanges(): WatchChangeSummary {
  return {
    added: [],
    modified: [],
    deleted: []
  };
}

function mergeWatchChanges(left: WatchChangeSummary | undefined, right: WatchChangeSummary): WatchChangeSummary {
  if (!left) return right;

  return {
    added: uniqueSorted([...left.added, ...right.added]),
    modified: uniqueSorted([...left.modified, ...right.modified]),
    deleted: uniqueSorted([...left.deleted, ...right.deleted])
  };
}

function watchChangeCount(changes: WatchChangeSummary): number {
  return changes.added.length + changes.modified.length + changes.deleted.length;
}

function formatChangedFileSample(changes: WatchChangeSummary, limit = 8): string[] {
  return [
    ...changes.added.map((file) => `added ${file}`),
    ...changes.modified.map((file) => `modified ${file}`),
    ...changes.deleted.map((file) => `deleted ${file}`)
  ].slice(0, limit);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function toPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

function formatSignedNumber(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function joinOutputPath(outputDir: string, fileName: string): string {
  if (outputDir.endsWith("/")) return `${outputDir}${fileName}`;
  return `${outputDir}/${fileName}`;
}

function formatWatchError(error: unknown): string {
  if (error instanceof Error) return `a11y-shiftleft watch failed: ${error.message}`;
  return `a11y-shiftleft watch failed: ${String(error)}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
