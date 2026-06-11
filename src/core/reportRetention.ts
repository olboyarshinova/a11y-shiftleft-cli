import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import type { RetentionConfig } from "../types.js";

interface ReportRun {
  dir: string;
  mtimeMs: number;
}

export interface ReportRetentionSummary {
  enabled: boolean;
  rootDir: string;
  currentOutputDir: string;
  maxRuns: number;
  maxAgeDays: number;
  candidateRuns: number;
  deletedRuns: number;
  keptRuns: number;
}

interface ApplyReportRetentionOptions {
  now?: Date;
}

const REPORT_MARKERS = [
  "a11y-report.json",
  "a11y-comment.md",
  "a11y-metrics.csv",
  "a11y-manual-checklist.md",
  "exploration.html",
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

  if (!config.enabled) {
    return {
      enabled: false,
      rootDir,
      currentOutputDir,
      maxRuns,
      maxAgeDays,
      candidateRuns: 0,
      deletedRuns: 0,
      keptRuns: 0
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

  for (const dir of deleteSet) {
    await fs.rm(dir, { recursive: true, force: true });
  }

  return {
    enabled: true,
    rootDir,
    currentOutputDir,
    maxRuns,
    maxAgeDays,
    candidateRuns: runs.length,
    deletedRuns: deleteSet.size,
    keptRuns: runs.length - deleteSet.size
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
