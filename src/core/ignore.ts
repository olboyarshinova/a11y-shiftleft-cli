import fs from "node:fs/promises";
import path from "node:path";
import type { DedupedIssue, IgnoreEntry, IgnoreFile, IgnoreSummary, Severity } from "../types.js";

export const DEFAULT_IGNORE_FILE = "a11y-ignore.json";

interface ApplyIgnoreOptions {
  cwd: string;
  ignoreFile?: string;
  enabled?: boolean;
  now?: Date;
}

interface ApplyIgnoreResult {
  issues: DedupedIssue[];
  summary?: IgnoreSummary;
}

type IgnoreMatcher = (issue: DedupedIssue) => boolean;

const MATCH_FIELDS = [
  "fingerprint",
  "ruleId",
  "source",
  "severity",
  "selector",
  "file",
  "url",
  "target",
  "wcag"
] as const;

export async function applyIgnores(
  issues: DedupedIssue[],
  options: ApplyIgnoreOptions
): Promise<ApplyIgnoreResult> {
  if (options.enabled === false) {
    return { issues };
  }

  const ignorePath = resolveIgnorePath(options.cwd, options.ignoreFile);
  const ignoreFile = await readIgnoreFileIfExists(ignorePath);

  if (!ignoreFile) {
    return { issues };
  }

  const now = options.now || new Date();
  const activeEntries: IgnoreEntry[] = [];
  let expiredRules = 0;
  let invalidRules = 0;

  for (const entry of ignoreFile.ignores) {
    const validity = validateIgnoreEntry(entry, now);

    if (validity === "active") {
      activeEntries.push(entry);
    } else if (validity === "expired") {
      expiredRules += 1;
    } else {
      invalidRules += 1;
    }
  }

  const matchers = activeEntries.map(createMatcher);
  const actionableIssues = issues.filter((issue) => !matchers.some((matcher) => matcher(issue)));
  const ignoredIssues = issues.length - actionableIssues.length;

  return {
    issues: actionableIssues,
    summary: {
      enabled: true,
      file: formatIgnorePath(options.cwd, ignorePath),
      totalRules: ignoreFile.ignores.length,
      activeRules: activeEntries.length,
      expiredRules,
      invalidRules,
      ignoredIssues
    }
  };
}

export function resolveIgnorePath(cwd: string, ignoreFile = DEFAULT_IGNORE_FILE): string {
  return path.isAbsolute(ignoreFile)
    ? ignoreFile
    : path.resolve(cwd, ignoreFile);
}

export function createMatcher(entry: IgnoreEntry): IgnoreMatcher {
  return (issue) => MATCH_FIELDS.every((field) => {
    const expected = entry[field];
    if (expected === undefined) return true;

    if (field === "target") {
      return matchesAny(expected, issueTarget(issue));
    }

    if (field === "wcag") {
      const values = issue.wcagCriteria.length > 0
        ? issue.wcagCriteria.map((criterion) => criterion.id)
        : issue.wcag;
      return values.some((value) => matchesAny(expected, value));
    }

    const actual = issue[field];
    if (actual === undefined) return false;
    return matchesAny(expected, String(actual));
  });
}

export function validateIgnoreEntry(entry: IgnoreEntry, now = new Date()): "active" | "expired" | "invalid" {
  if (!entry || typeof entry !== "object") return "invalid";
  if (!entry.reason?.trim() || !entry.owner?.trim() || !entry.expires?.trim()) return "invalid";
  if (!hasMatchField(entry)) return "invalid";

  const expiresAt = parseExpiry(entry.expires);
  if (!expiresAt) return "invalid";

  return expiresAt.getTime() < now.getTime() ? "expired" : "active";
}

export function issueTarget(issue: DedupedIssue): string {
  return [
    issue.url ? `url=${issue.url}` : "",
    issue.selector ? `selector=${issue.selector}` : "",
    issue.file ? `file=${issue.file}` : "",
    Number.isFinite(issue.line) ? `line=${issue.line}` : "",
    Number.isFinite(issue.column) ? `column=${issue.column}` : ""
  ].filter(Boolean).join("|") || "target=unknown";
}

function matchesAny(expected: string | string[] | Severity | Severity[], actual: string): boolean {
  const patterns = Array.isArray(expected) ? expected : [expected];
  return patterns.some((pattern) => matchesPattern(String(pattern), actual));
}

function matchesPattern(pattern: string, actual: string): boolean {
  if (pattern === "*") return true;

  if (pattern.includes("*")) {
    const escaped = pattern
      .split("*")
      .map(escapeRegExp)
      .join(".*");
    return new RegExp(`^${escaped}$`).test(actual);
  }

  return pattern === actual;
}

function hasMatchField(entry: IgnoreEntry): boolean {
  return MATCH_FIELDS.some((field) => entry[field] !== undefined);
}

function parseExpiry(value: string): Date | null {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readIgnoreFileIfExists(filePath: string): Promise<IgnoreFile | null> {
  try {
    return parseIgnoreFile(await fs.readFile(filePath, "utf8"), filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

function parseIgnoreFile(content: string, filePath: string): IgnoreFile {
  const parsed = JSON.parse(content) as Partial<IgnoreFile>;

  if (parsed.version !== 1 || !Array.isArray(parsed.ignores)) {
    throw new Error(`Invalid accessibility ignore file: ${filePath}`);
  }

  return {
    version: 1,
    ignores: parsed.ignores.filter(isObject).map((entry) => entry as IgnoreEntry)
  };
}

function isObject(entry: unknown): entry is Record<string, unknown> {
  return Boolean(entry) && typeof entry === "object" && !Array.isArray(entry);
}

function formatIgnorePath(cwd: string, filePath: string): string {
  const relativePath = path.relative(cwd, filePath);
  return relativePath && !relativePath.startsWith("..")
    ? relativePath
    : path.basename(filePath);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
