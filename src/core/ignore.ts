import fs from "node:fs/promises";
import path from "node:path";
import type { DedupedIssue, IgnoreEntry, IgnoreFile, IgnoreOwnerSummary, IgnoreSummary, Severity } from "../types.js";

export const DEFAULT_IGNORE_FILE = "a11y-ignore.json";

interface ApplyIgnoreOptions {
  cwd: string;
  ignoreFile?: string;
  enabled?: boolean;
  now?: Date;
  expiryReminderDays?: number;
}

interface ApplyIgnoreResult {
  issues: DedupedIssue[];
  summary?: IgnoreSummary;
}

type IgnoreMatcher = (issue: DedupedIssue) => boolean;
export type IgnoreAuditStatus = "active" | "expired" | "invalid";

export interface IgnoreAuditEntry {
  index: number;
  status: IgnoreAuditStatus;
  owner: string;
  reason: string;
  expires: string;
  matchFields: string[];
  expiringSoon: boolean;
  cleanup: string;
}

export interface IgnoreAuditResult {
  file: string;
  exists: boolean;
  summary?: IgnoreSummary;
  entries: IgnoreAuditEntry[];
}

interface ActiveIgnoreEntry {
  entry: IgnoreEntry;
  matcher: IgnoreMatcher;
}

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
  const expiryReminderDays = options.expiryReminderDays ?? 14;
  const activeEntries: IgnoreEntry[] = [];
  const ownerSummaries = new Map<string, IgnoreOwnerSummary>();
  let expiredRules = 0;
  let invalidRules = 0;
  let expiringSoonRules = 0;

  for (const entry of ignoreFile.ignores) {
    const validity = validateIgnoreEntry(entry, now);
    const ownerSummary = ensureOwnerSummary(ownerSummaries, ignoreOwner(entry));
    ownerSummary.totalRules += 1;

    if (validity === "active") {
      activeEntries.push(entry);
      ownerSummary.activeRules += 1;
      if (isExpiringSoon(entry, now, expiryReminderDays)) {
        expiringSoonRules += 1;
        ownerSummary.expiringSoonRules += 1;
      }
    } else if (validity === "expired") {
      expiredRules += 1;
      ownerSummary.expiredRules += 1;
    } else {
      invalidRules += 1;
      ownerSummary.invalidRules += 1;
    }
  }

  const activeMatchers: ActiveIgnoreEntry[] = activeEntries.map((entry) => ({
    entry,
    matcher: createMatcher(entry)
  }));
  const actionableIssues: DedupedIssue[] = [];
  let ignoredIssues = 0;

  for (const issue of issues) {
    const matchingEntries = activeMatchers.filter(({ matcher }) => matcher(issue));

    if (matchingEntries.length === 0) {
      actionableIssues.push(issue);
      continue;
    }

    ignoredIssues += 1;
    for (const owner of new Set(matchingEntries.map(({ entry }) => ignoreOwner(entry)))) {
      ensureOwnerSummary(ownerSummaries, owner).ignoredIssues += 1;
    }
  }

  return {
    issues: actionableIssues,
    summary: {
      enabled: true,
      file: formatIgnorePath(options.cwd, ignorePath),
      totalRules: ignoreFile.ignores.length,
      activeRules: activeEntries.length,
      expiredRules,
      invalidRules,
      expiringSoonRules,
      ignoredIssues,
      ownerSummaries: [...ownerSummaries.values()].sort(compareIgnoreOwnerSummaries)
    }
  };
}

export function resolveIgnorePath(cwd: string, ignoreFile = DEFAULT_IGNORE_FILE): string {
  return path.isAbsolute(ignoreFile)
    ? ignoreFile
    : path.resolve(cwd, ignoreFile);
}

export async function auditIgnoreFile(options: {
  cwd: string;
  ignoreFile?: string;
  now?: Date;
  expiryReminderDays?: number;
}): Promise<IgnoreAuditResult> {
  const ignorePath = resolveIgnorePath(options.cwd, options.ignoreFile);
  const ignoreFile = await readIgnoreFileIfExists(ignorePath);

  if (!ignoreFile) {
    return {
      file: formatIgnorePath(options.cwd, ignorePath),
      exists: false,
      entries: []
    };
  }

  const now = options.now || new Date();
  const expiryReminderDays = options.expiryReminderDays ?? 14;
  const ownerSummaries = new Map<string, IgnoreOwnerSummary>();
  const entries = ignoreFile.ignores.map((entry, index) => {
    const status = validateIgnoreEntry(entry, now);
    const owner = ignoreOwner(entry);
    const ownerSummary = ensureOwnerSummary(ownerSummaries, owner);
    const expiringSoon = status === "active" && isExpiringSoon(entry, now, expiryReminderDays);
    ownerSummary.totalRules += 1;

    if (status === "active") ownerSummary.activeRules += 1;
    if (status === "expired") ownerSummary.expiredRules += 1;
    if (status === "invalid") ownerSummary.invalidRules += 1;
    if (expiringSoon) ownerSummary.expiringSoonRules += 1;

    return {
      index: index + 1,
      status,
      owner,
      reason: entry.reason?.trim() || "missing",
      expires: entry.expires?.trim() || "missing",
      matchFields: ignoreMatchFields(entry),
      expiringSoon,
      cleanup: ignoreCleanupHint(status, expiringSoon)
    };
  });
  const expiredRules = entries.filter((entry) => entry.status === "expired").length;
  const invalidRules = entries.filter((entry) => entry.status === "invalid").length;
  const expiringSoonRules = entries.filter((entry) => entry.expiringSoon).length;

  return {
    file: formatIgnorePath(options.cwd, ignorePath),
    exists: true,
    entries,
    summary: {
      enabled: true,
      file: formatIgnorePath(options.cwd, ignorePath),
      totalRules: ignoreFile.ignores.length,
      activeRules: entries.filter((entry) => entry.status === "active").length,
      expiredRules,
      invalidRules,
      expiringSoonRules,
      ignoredIssues: 0,
      ownerSummaries: [...ownerSummaries.values()].sort(compareIgnoreOwnerSummaries)
    }
  };
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

function ignoreMatchFields(entry: IgnoreEntry): string[] {
  return MATCH_FIELDS.filter((field) => entry[field] !== undefined);
}

function parseExpiry(value: string): Date | null {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isExpiringSoon(entry: IgnoreEntry, now: Date, reminderDays: number): boolean {
  const expiresAt = parseExpiry(entry.expires);
  if (!expiresAt) return false;

  const reminderMs = reminderDays * 24 * 60 * 60 * 1000;
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();
  return timeUntilExpiry >= 0 && timeUntilExpiry <= reminderMs;
}

function ignoreOwner(entry: IgnoreEntry): string {
  return entry.owner?.trim() || "unknown";
}

function ensureOwnerSummary(
  summaries: Map<string, IgnoreOwnerSummary>,
  owner: string
): IgnoreOwnerSummary {
  const existing = summaries.get(owner);
  if (existing) return existing;

  const summary: IgnoreOwnerSummary = {
    owner,
    totalRules: 0,
    activeRules: 0,
    expiredRules: 0,
    invalidRules: 0,
    expiringSoonRules: 0,
    ignoredIssues: 0
  };
  summaries.set(owner, summary);
  return summary;
}

function compareIgnoreOwnerSummaries(left: IgnoreOwnerSummary, right: IgnoreOwnerSummary): number {
  if (right.ignoredIssues !== left.ignoredIssues) return right.ignoredIssues - left.ignoredIssues;
  if (right.expiredRules !== left.expiredRules) return right.expiredRules - left.expiredRules;
  if (right.expiringSoonRules !== left.expiringSoonRules) return right.expiringSoonRules - left.expiringSoonRules;
  return left.owner.localeCompare(right.owner);
}

function ignoreCleanupHint(status: IgnoreAuditStatus, expiringSoon: boolean): string {
  if (status === "invalid") {
    return "Fix required reason, owner, expires, and at least one match field.";
  }
  if (status === "expired") {
    return "Remove this entry if the issue is fixed, or renew it with a new reviewed expiry date.";
  }
  if (expiringSoon) {
    return "Review before expiry; remove it if fixed, or renew it with a current reason.";
  }
  return "No cleanup needed yet.";
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
