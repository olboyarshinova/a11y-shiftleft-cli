import type { Command } from "commander";
import {
  auditIgnoreFile,
  DEFAULT_IGNORE_FILE,
  type IgnoreAuditEntry,
  type IgnoreAuditResult
} from "../core/ignore.js";

interface IgnoreAuditOptions {
  file?: string;
  format?: string;
  expiryReminderDays?: string;
}

type IgnoreCleanupAction = "review-before-expiry" | "remove-or-renew" | "fix-entry";

interface IgnoreCleanupPlanItem {
  index: number;
  action: IgnoreCleanupAction;
  owner: string;
  expires: string;
  matchFields: string[];
  reason: string;
  why: string;
  nextStep: string;
}

interface IgnoreCleanupPlan {
  file: string;
  exists: boolean;
  generatedAt: string;
  items: IgnoreCleanupPlanItem[];
}

export function registerIgnoreCommand(program: Command): void {
  const ignore = program
    .command("ignore")
    .description("Review scoped a11y-ignore.json exceptions.");

  ignore
    .command("audit")
    .description("Report expired, invalid, and soon-to-expire scoped ignore rules.")
    .option("--file <file>", "Scoped ignore file path", DEFAULT_IGNORE_FILE)
    .option("--format <format>", "Output format: text or json", "text")
    .option("--expiry-reminder-days <days>", "Days before expiry to flag a rule as expiring soon", "14")
    .action(async (options: IgnoreAuditOptions) => {
      const result = await auditIgnoreFile({
        cwd: process.cwd(),
        ignoreFile: options.file,
        expiryReminderDays: toNonNegativeInteger(options.expiryReminderDays, "Expiry reminder days")
      });

      if (options.format === "json") {
        console.log(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      if (options.format && options.format !== "text") {
        throw new Error("Unsupported ignore audit format. Use text or json.");
      }

      console.log(formatIgnoreAudit(result));
    });

  ignore
    .command("cleanup-plan")
    .description("Create a read-only cleanup plan for stale scoped ignore rules.")
    .option("--file <file>", "Scoped ignore file path", DEFAULT_IGNORE_FILE)
    .option("--format <format>", "Output format: text or json", "text")
    .option("--expiry-reminder-days <days>", "Days before expiry to flag a rule as expiring soon", "14")
    .action(async (options: IgnoreAuditOptions) => {
      const result = await auditIgnoreFile({
        cwd: process.cwd(),
        ignoreFile: options.file,
        expiryReminderDays: toNonNegativeInteger(options.expiryReminderDays, "Expiry reminder days")
      });
      const plan = createIgnoreCleanupPlan(result);

      if (options.format === "json") {
        console.log(`${JSON.stringify(plan, null, 2)}\n`);
        return;
      }

      if (options.format && options.format !== "text") {
        throw new Error("Unsupported ignore cleanup-plan format. Use text or json.");
      }

      console.log(formatIgnoreCleanupPlan(plan));
    });
}

export function formatIgnoreAudit(result: IgnoreAuditResult): string {
  if (!result.exists || !result.summary) {
    return [
      "a11y-shiftleft ignore audit",
      `File: ${result.file}`,
      "Status: no scoped ignore file found",
      "Next step: create a11y-ignore.json only for reviewed temporary exceptions."
    ].join("\n");
  }

  const cleanupEntries = result.entries.filter((entry) => (
    entry.status === "expired" ||
    entry.status === "invalid" ||
    entry.expiringSoon
  ));
  const ownerRows = result.summary.ownerSummaries.filter((owner) => (
    owner.expiredRules > 0 ||
    owner.invalidRules > 0 ||
    owner.expiringSoonRules > 0
  ));

  return [
    "a11y-shiftleft ignore audit",
    `File: ${result.file}`,
    `Rules: total ${result.summary.totalRules} | active ${result.summary.activeRules} | expiring soon ${result.summary.expiringSoonRules} | expired ${result.summary.expiredRules} | invalid ${result.summary.invalidRules}`,
    cleanupEntries.length > 0
      ? ["", "Cleanup needed:", ...cleanupEntries.map(formatIgnoreCleanupEntry)].join("\n")
      : "",
    ownerRows.length > 0
      ? ["", "Owners to review:", ...ownerRows.map((owner) => `- ${owner.owner}: expiring soon ${owner.expiringSoonRules}, expired ${owner.expiredRules}, invalid ${owner.invalidRules}`)].join("\n")
      : "",
    "",
    cleanupEntries.length > 0
      ? "Next step: remove fixed exceptions, renew only reviewed temporary exceptions, and keep owner/reason/expires current."
      : "Next step: no stale ignore cleanup is needed right now."
  ].filter((line) => line !== "").join("\n");
}

function formatIgnoreCleanupEntry(entry: IgnoreAuditEntry): string {
  const fields = entry.matchFields.length > 0 ? entry.matchFields.join(", ") : "none";
  const expiringSoon = entry.expiringSoon ? " expiring-soon" : "";
  return `- [${entry.index}] ${entry.status}${expiringSoon} owner=${entry.owner} expires=${entry.expires} match=${fields} - ${entry.cleanup}`;
}

export function createIgnoreCleanupPlan(result: IgnoreAuditResult): IgnoreCleanupPlan {
  return {
    file: result.file,
    exists: result.exists,
    generatedAt: new Date().toISOString(),
    items: result.entries
      .map(toCleanupPlanItem)
      .filter((item): item is IgnoreCleanupPlanItem => Boolean(item))
  };
}

export function formatIgnoreCleanupPlan(plan: IgnoreCleanupPlan): string {
  if (!plan.exists) {
    return [
      "a11y-shiftleft ignore cleanup-plan",
      `File: ${plan.file}`,
      "Status: no scoped ignore file found",
      "Next step: no cleanup plan is needed."
    ].join("\n");
  }

  if (plan.items.length === 0) {
    return [
      "a11y-shiftleft ignore cleanup-plan",
      `File: ${plan.file}`,
      "Items: 0",
      "Next step: no stale ignore cleanup is needed right now."
    ].join("\n");
  }

  return [
    "a11y-shiftleft ignore cleanup-plan",
    `File: ${plan.file}`,
    `Items: ${plan.items.length}`,
    "",
    ...plan.items.map(formatCleanupPlanItem),
    "",
    "This is a read-only plan. Review the proposed changes before editing a11y-ignore.json."
  ].join("\n");
}

function toCleanupPlanItem(entry: IgnoreAuditEntry): IgnoreCleanupPlanItem | null {
  if (entry.status === "invalid") {
    return {
      index: entry.index,
      action: "fix-entry",
      owner: entry.owner,
      expires: entry.expires,
      matchFields: entry.matchFields,
      reason: entry.reason,
      why: "The ignore rule is invalid and does not hide findings.",
      nextStep: "Add required reason, owner, expires, and at least one match field, or delete the entry."
    };
  }

  if (entry.status === "expired") {
    return {
      index: entry.index,
      action: "remove-or-renew",
      owner: entry.owner,
      expires: entry.expires,
      matchFields: entry.matchFields,
      reason: entry.reason,
      why: "The temporary exception has expired and no longer hides findings.",
      nextStep: "Remove it if the issue is fixed, or renew it only after a fresh accessibility review."
    };
  }

  if (entry.expiringSoon) {
    return {
      index: entry.index,
      action: "review-before-expiry",
      owner: entry.owner,
      expires: entry.expires,
      matchFields: entry.matchFields,
      reason: entry.reason,
      why: "The temporary exception expires soon.",
      nextStep: "Retest the issue before expiry; remove it if fixed or renew with an updated reason."
    };
  }

  return null;
}

function formatCleanupPlanItem(item: IgnoreCleanupPlanItem): string {
  const fields = item.matchFields.length > 0 ? item.matchFields.join(", ") : "none";
  return [
    `- [${item.index}] ${item.action}`,
    `  owner: ${item.owner}`,
    `  expires: ${item.expires}`,
    `  match: ${fields}`,
    `  why: ${item.why}`,
    `  next: ${item.nextStep}`
  ].join("\n");
}

function toNonNegativeInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}
