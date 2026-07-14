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

function toNonNegativeInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}
