import fs from "node:fs/promises";
import path from "node:path";

const REPORT_FILES = [
  "a11y-report.json",
  "a11y-metrics.csv",
  "a11y-findings.csv",
  "a11y-comment.md",
  "a11y-manual-checklist.md",
  "exploration-graph.json",
  "exploration-visual-check.html",
  "exploration.html",
  "exploration.pdf"
];

export interface CleanExploreArtifactsResult {
  filesRemoved: number;
  screenshotsRemoved: number;
}

export async function cleanExploreArtifacts(outputDir: string): Promise<CleanExploreArtifactsResult> {
  let filesRemoved = 0;

  for (const file of REPORT_FILES) {
    if (await removeIfExists(path.join(outputDir, file))) {
      filesRemoved += 1;
    }
  }

  const screenshotsRemoved = await cleanStateScreenshots(path.join(outputDir, "screenshots"));

  return {
    filesRemoved,
    screenshotsRemoved
  };
}

async function cleanStateScreenshots(screenshotsDir: string): Promise<number> {
  let entries: string[];

  try {
    entries = await fs.readdir(screenshotsDir);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return 0;
    throw error;
  }

  let removed = 0;

  for (const entry of entries) {
    if (!/^state-\d+(?:-error-\d+)?\.(png|jpe?g)$/.test(entry)) continue;
    if (await removeIfExists(path.join(screenshotsDir, entry))) {
      removed += 1;
    }
  }

  return removed;
}

async function removeIfExists(filePath: string): Promise<boolean> {
  try {
    await fs.rm(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
