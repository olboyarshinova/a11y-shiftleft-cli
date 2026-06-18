import fs from "node:fs/promises";
import path from "node:path";
import type {
  BaselineComparisonSummary,
  BaselineEntry,
  BaselineFile,
  DedupedIssue
} from "../types.js";

export const DEFAULT_BASELINE_FILE = ".a11y-baseline.json";

interface ApplyBaselineOptions {
  cwd: string;
  baselineFile?: string;
  update?: boolean;
}

interface ApplyBaselineResult {
  issues: DedupedIssue[];
  summary: BaselineComparisonSummary;
}

export async function applyBaseline(
  issues: DedupedIssue[],
  options: ApplyBaselineOptions
): Promise<ApplyBaselineResult> {
  const baselinePath = resolveBaselinePath(options.cwd, options.baselineFile);
  const existingBaseline = options.update ? null : await readBaselineIfExists(baselinePath);
  const shouldWriteBaseline = options.update || !existingBaseline;
  const baseline = shouldWriteBaseline
    ? createBaselineFile(issues)
    : existingBaseline;

  if (shouldWriteBaseline) {
    await writeBaselineFile(baselinePath, baseline);
  }

  const baselineFingerprints = new Set(baseline.issues.map((issue) => issue.fingerprint));
  const currentFingerprints = new Set(issues.map((issue) => issue.fingerprint));
  const annotatedIssues = issues.map((issue) => ({
    ...issue,
    baselineStatus: baselineFingerprints.has(issue.fingerprint) ? "existing" as const : "new" as const
  }));
  const newIssues = annotatedIssues.filter((issue) => issue.baselineStatus === "new");
  const resolvedIssues = baseline.issues
    .filter((issue) => !currentFingerprints.has(issue.fingerprint))
    .length;

  return {
    issues: annotatedIssues,
    summary: {
      enabled: true,
      file: formatBaselinePath(options.cwd, baselinePath),
      updated: shouldWriteBaseline,
      baselineIssues: baseline.issues.length,
      currentIssues: issues.length,
      existingIssues: annotatedIssues.length - newIssues.length,
      newIssues: newIssues.length,
      resolvedIssues,
      newCritical: newIssues.filter((issue) => issue.severity === "critical").length,
      newWarning: newIssues.filter((issue) => issue.severity === "warning").length,
      newInfo: newIssues.filter((issue) => issue.severity === "info").length
    }
  };
}

export function createBaselineFile(issues: DedupedIssue[], now = new Date()): BaselineFile {
  return {
    version: 1,
    generatedAt: now.toISOString(),
    issues: issues.map(toBaselineEntry).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint))
  };
}

export function resolveBaselinePath(cwd: string, baselineFile = DEFAULT_BASELINE_FILE): string {
  return path.isAbsolute(baselineFile)
    ? baselineFile
    : path.resolve(cwd, baselineFile);
}

function toBaselineEntry(issue: DedupedIssue): BaselineEntry {
  return {
    fingerprint: issue.fingerprint,
    ruleId: issue.ruleId,
    severity: issue.severity,
    source: issue.source,
    target: baselineTarget(issue),
    wcag: issue.wcagCriteria.length > 0
      ? issue.wcagCriteria.map((criterion) => criterion.id)
      : issue.wcag
  };
}

function baselineTarget(issue: DedupedIssue): string {
  return [
    issue.url ? `url=${issue.url}` : "",
    issue.colorScheme ? `color-scheme=${issue.colorScheme}` : "",
    issue.selector ? `selector=${issue.selector}` : "",
    issue.file ? `file=${issue.file}` : "",
    Number.isFinite(issue.line) ? `line=${issue.line}` : "",
    Number.isFinite(issue.column) ? `column=${issue.column}` : ""
  ].filter(Boolean).join("|") || "target=unknown";
}

async function readBaselineIfExists(filePath: string): Promise<BaselineFile | null> {
  try {
    return parseBaselineFile(await fs.readFile(filePath, "utf8"), filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

function parseBaselineFile(content: string, filePath: string): BaselineFile {
  const parsed = JSON.parse(content) as Partial<BaselineFile>;

  if (parsed.version !== 1 || !Array.isArray(parsed.issues)) {
    throw new Error(`Invalid accessibility baseline file: ${filePath}`);
  }

  return {
    version: 1,
    generatedAt: typeof parsed.generatedAt === "string"
      ? parsed.generatedAt
      : new Date(0).toISOString(),
    issues: parsed.issues.filter(isBaselineEntry)
  };
}

function isBaselineEntry(entry: unknown): entry is BaselineEntry {
  if (!entry || typeof entry !== "object") return false;
  const candidate = entry as Partial<BaselineEntry>;

  return typeof candidate.fingerprint === "string" &&
    typeof candidate.ruleId === "string" &&
    (candidate.severity === "critical" || candidate.severity === "warning" || candidate.severity === "info") &&
    typeof candidate.source === "string" &&
    typeof candidate.target === "string" &&
    Array.isArray(candidate.wcag);
}

async function writeBaselineFile(filePath: string, baseline: BaselineFile): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(baseline, null, 2)}\n`);
}

function formatBaselinePath(cwd: string, filePath: string): string {
  const relativePath = path.relative(cwd, filePath);
  return relativePath && !relativePath.startsWith("..")
    ? relativePath
    : path.basename(filePath);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
