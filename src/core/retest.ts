import fs from "node:fs/promises";
import path from "node:path";
import type { A11yReport, DedupedIssue, RetestComparisonSummary } from "../types.js";

interface ApplyRetestOptions {
  cwd: string;
  previous: string;
}

interface ApplyRetestResult {
  issues: DedupedIssue[];
  summary: RetestComparisonSummary;
}

export async function applyRetest(
  issues: DedupedIssue[],
  options: ApplyRetestOptions
): Promise<ApplyRetestResult> {
  const reportPath = await resolveRetestReportPath(options.cwd, options.previous);
  const previousIssues = await readPreviousIssues(reportPath);
  const previousFingerprints = new Set(previousIssues.map((issue) => issue.fingerprint));
  const currentFingerprints = new Set(issues.map((issue) => issue.fingerprint));
  const annotatedIssues = issues.map((issue) => ({
    ...issue,
    retestStatus: previousFingerprints.has(issue.fingerprint)
      ? "remaining" as const
      : "new" as const
  }));
  const newIssues = annotatedIssues.filter((issue) => issue.retestStatus === "new");

  return {
    issues: annotatedIssues,
    summary: {
      enabled: true,
      file: formatRetestPath(options.cwd, reportPath),
      previousIssues: previousIssues.length,
      currentIssues: issues.length,
      remainingIssues: annotatedIssues.length - newIssues.length,
      newIssues: newIssues.length,
      fixedIssues: previousIssues.filter((issue) => !currentFingerprints.has(issue.fingerprint)).length,
      newCritical: newIssues.filter((issue) => issue.severity === "critical").length,
      newWarning: newIssues.filter((issue) => issue.severity === "warning").length,
      newInfo: newIssues.filter((issue) => issue.severity === "info").length
    }
  };
}

export async function resolveRetestReportPath(cwd: string, previous: string): Promise<string> {
  const candidate = path.isAbsolute(previous) ? previous : path.resolve(cwd, previous);

  try {
    const stats = await fs.stat(candidate);
    return stats.isDirectory() ? path.join(candidate, "a11y-report.json") : candidate;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Previous accessibility report not found: ${previous}`);
    }
    throw error;
  }
}

async function readPreviousIssues(filePath: string): Promise<DedupedIssue[]> {
  let parsed: Partial<A11yReport>;

  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as Partial<A11yReport>;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Previous accessibility report not found: ${filePath}`);
    }
    throw error;
  }

  if (!Array.isArray(parsed.issues) || !parsed.issues.every(isRetestIssue)) {
    throw new Error(`Invalid accessibility report for retest: ${filePath}`);
  }

  return parsed.issues;
}

function isRetestIssue(issue: unknown): issue is DedupedIssue {
  if (!issue || typeof issue !== "object") return false;
  const candidate = issue as Partial<DedupedIssue>;

  return typeof candidate.fingerprint === "string" &&
    typeof candidate.ruleId === "string" &&
    (candidate.severity === "critical" || candidate.severity === "warning" || candidate.severity === "info");
}

function formatRetestPath(cwd: string, filePath: string): string {
  const relativePath = path.relative(cwd, filePath);
  return relativePath && !relativePath.startsWith("..")
    ? relativePath
    : path.basename(filePath);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
