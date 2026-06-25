import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import type { ReportRetentionEvidence, RetentionConfig } from "../types.js";

interface ReportRun {
  dir: string;
  mtimeMs: number;
}

export interface ReportRetentionSummary extends ReportRetentionEvidence {
  rootDir: string;
  currentOutputDir: string;
  plannedDeletedRunDirs: string[];
  keptRunDirs: string[];
}

interface ApplyReportRetentionOptions {
  now?: Date;
}

const REPORT_MARKERS = [
  "a11y-report.json",
  "a11y-comment.md",
  "a11y-metrics.csv",
  "a11y-summary.csv",
  "a11y-pages.csv",
  "a11y-rules.csv",
  "a11y-findings.csv",
  "a11y-remediation.csv",
  "a11y-manual-checklist.md",
  "a11y-manual-checklist.json",
  "evaluation-scope.json",
  "exploration.html",
  "exploration.pdf",
  "a11y-report.html",
  "a11y-report.pdf",
  "exploration-graph.json"
];

export async function applyReportRetention(
  outputDir: string,
  config: RetentionConfig,
  options: ApplyReportRetentionOptions = {}
): Promise<ReportRetentionSummary> {
  const currentOutputDir = path.resolve(outputDir);
  const rootDir = path.dirname(currentOutputDir);
  const maxRuns = positiveOrDefault(config.maxRuns, 5);
  const maxAgeDays = positiveOrDefault(config.maxAgeDays, 14);
  const dryRun = Boolean(config.dryRun);

  if (!config.enabled) {
    return {
      enabled: false,
      dryRun,
      rootDir,
      currentOutputDir,
      maxRuns,
      maxAgeDays,
      candidateRuns: 0,
      plannedDeletedRuns: 0,
      deletedRuns: 0,
      keptRuns: 0,
      plannedDeletedRunDirs: [],
      keptRunDirs: []
    };
  }

  const runs = await findReportRunDirectories(rootDir, currentOutputDir);
  const now = options.now || new Date();
  const cutoffMs = now.getTime() - (maxAgeDays * 24 * 60 * 60 * 1000);
  const byNewest = [...runs].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const oldRunKeepLimit = Math.max(0, maxRuns - 1);
  const deleteSet = new Set<string>();

  for (const run of runs) {
    if (run.mtimeMs < cutoffMs) {
      deleteSet.add(run.dir);
    }
  }

  for (const run of byNewest.slice(oldRunKeepLimit)) {
    deleteSet.add(run.dir);
  }

  const plannedDeletedRunDirs = [...deleteSet].sort();
  const keptRunDirs = runs
    .map((run) => run.dir)
    .filter((dir) => !deleteSet.has(dir))
    .sort();

  if (!dryRun) {
    for (const dir of plannedDeletedRunDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  return {
    enabled: true,
    dryRun,
    rootDir,
    currentOutputDir,
    maxRuns,
    maxAgeDays,
    candidateRuns: runs.length,
    plannedDeletedRuns: plannedDeletedRunDirs.length,
    deletedRuns: dryRun ? 0 : plannedDeletedRunDirs.length,
    keptRuns: keptRunDirs.length,
    plannedDeletedRunDirs,
    keptRunDirs
  };
}

async function findReportRunDirectories(rootDir: string, currentOutputDir: string): Promise<ReportRun[]> {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }

  const runs: ReportRun[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dir = path.join(rootDir, entry.name);
    if (path.resolve(dir) === currentOutputDir) continue;
    if (!await hasReportMarker(dir)) continue;

    const stat = await fs.stat(dir);
    runs.push({
      dir,
      mtimeMs: stat.mtimeMs
    });
  }

  return runs;
}

async function hasReportMarker(dir: string): Promise<boolean> {
  for (const marker of REPORT_MARKERS) {
    try {
      await fs.access(path.join(dir, marker));
      return true;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }
  }

  return false;
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
