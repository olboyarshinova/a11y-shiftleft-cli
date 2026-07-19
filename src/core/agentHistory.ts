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
  const root = path.resolve(options.historyRoot);
  const currentPath = path.resolve(options.currentReportPath);
  const candidates = await findHistoryReportFiles(root, positiveOrDefault(options.maxDepth, DEFAULT_HISTORY_MAX_DEPTH));
  const previous = [];

  for (const candidate of candidates) {
    const resolvedCandidate = path.resolve(candidate);
    if (resolvedCandidate === currentPath) continue;

    try {
      const report = await readA11yReport(resolvedCandidate);
      previous.push({
        path: resolvedCandidate,
        generatedAt: report.generatedAt
      });
    } catch {
      // Ignore unrelated JSON files named a11y-report.json in mixed report roots.
    }
  }

  const currentGeneratedAt = options.currentReport.generatedAt;
  const older = previous
    .filter((candidate) => candidate.generatedAt < currentGeneratedAt)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  if (older[0]) return older[0].path;

  return previous
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0]?.path;
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

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
