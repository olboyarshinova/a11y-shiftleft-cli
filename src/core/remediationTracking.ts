import fs from "node:fs/promises";
import path from "node:path";
import type {
  DedupedIssue,
  RemediationTrackingEntry,
  RemediationTrackingFile,
  RemediationTrackingSummary
} from "../types.js";

export const DEFAULT_REMEDIATION_FILE = "a11y-remediation.json";

interface ApplyRemediationTrackingOptions {
  cwd: string;
  file?: string;
  enabled?: boolean;
}

interface ApplyRemediationTrackingResult {
  issues: DedupedIssue[];
  summary?: RemediationTrackingSummary;
}

export async function applyRemediationTracking(
  issues: DedupedIssue[],
  options: ApplyRemediationTrackingOptions
): Promise<ApplyRemediationTrackingResult> {
  if (options.enabled === false) return { issues };

  const filePath = resolveRemediationPath(options.cwd, options.file);
  const trackingFile = await readTrackingFileIfExists(filePath);
  if (!trackingFile) return { issues };

  const validEntries = trackingFile.items.filter(isValidTrackingEntry);
  const entriesByFingerprint = new Map(validEntries.map((entry) => [entry.fingerprint, entry]));
  const currentFingerprints = new Set(issues.map((issue) => issue.fingerprint));
  const trackedIssues = issues.map((issue) => {
    const tracking = entriesByFingerprint.get(issue.fingerprint);
    return tracking ? { ...issue, remediationTracking: tracking } : issue;
  });
  const matchedEntries = validEntries.filter((entry) => currentFingerprints.has(entry.fingerprint));

  return {
    issues: trackedIssues,
    summary: {
      enabled: true,
      file: formatPath(options.cwd, filePath),
      totalEntries: trackingFile.items.length,
      validEntries: validEntries.length,
      invalidEntries: trackingFile.items.length - validEntries.length,
      matchedIssues: matchedEntries.length,
      staleEntries: validEntries.length - matchedEntries.length,
      byStatus: countStatuses(matchedEntries)
    }
  };
}

export function resolveRemediationPath(cwd: string, file = DEFAULT_REMEDIATION_FILE): string {
  return path.isAbsolute(file) ? file : path.resolve(cwd, file);
}

export function isValidTrackingEntry(entry: RemediationTrackingEntry): boolean {
  if (!entry || typeof entry !== "object") return false;
  if (!entry.fingerprint?.trim() || !entry.updatedAt?.trim()) return false;
  if (!isValidDate(entry.updatedAt)) return false;
  if (!entry.owner?.trim() && entry.status !== "open") return false;

  if (entry.status === "accepted-temporarily") {
    return Boolean(entry.reason?.trim() && entry.reviewBy?.trim() && isValidDate(entry.reviewBy));
  }

  return ["open", "in-progress", "fixed", "manual-review"].includes(entry.status);
}

async function readTrackingFileIfExists(filePath: string): Promise<RemediationTrackingFile | null> {
  try {
    return parseTrackingFile(await fs.readFile(filePath, "utf8"), filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

function parseTrackingFile(content: string, filePath: string): RemediationTrackingFile {
  const parsed = JSON.parse(content) as Partial<RemediationTrackingFile>;
  if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error(`Invalid accessibility remediation file: ${filePath}`);
  }

  return {
    version: 1,
    items: parsed.items.filter(isObject).map((entry) => entry as RemediationTrackingEntry)
  };
}

function countStatuses(entries: RemediationTrackingEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.status] = (counts[entry.status] || 0) + 1;
    return counts;
  }, {});
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatPath(cwd: string, filePath: string): string {
  const relativePath = path.relative(cwd, filePath);
  return relativePath && !relativePath.startsWith("..") ? relativePath : path.basename(filePath);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
