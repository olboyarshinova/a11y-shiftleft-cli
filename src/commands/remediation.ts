import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  createRemediationTrackingFile,
  DEFAULT_REMEDIATION_FILE,
  readRemediationTrackingFile,
  updateRemediationStatus,
  writeRemediationTrackingFile
} from "../core/remediationTracking.js";
import type { A11yReport, RemediationStatus } from "../types.js";

interface RemediationInitOptions {
  report?: string;
  out?: string;
  force?: boolean;
}

interface RemediationSetOptions {
  file?: string;
  fingerprint: string;
  status: string;
  owner?: string;
  reason?: string;
  reviewBy?: string;
}

export function registerRemediationCommand(program: Command): void {
  const remediation = program
    .command("remediation")
    .description("Create and update persistent accessibility remediation statuses.");

  remediation
    .command("init")
    .description("Create a remediation tracking file from an accessibility report.")
    .option("--report <file>", "Path to a11y-report.json", "reports/a11y-report.json")
    .option("--out <file>", "Remediation file path", DEFAULT_REMEDIATION_FILE)
    .option("--force", "Overwrite an existing remediation file")
    .action(async (options: RemediationInitOptions) => {
      const reportPath = path.resolve(options.report || "reports/a11y-report.json");
      const outputPath = path.resolve(options.out || DEFAULT_REMEDIATION_FILE);
      if (!options.force && await exists(outputPath)) {
        throw new Error(`Remediation file already exists: ${outputPath}. Use --force to overwrite it.`);
      }

      const report = await readReport(reportPath);
      const trackingFile = createRemediationTrackingFile(report);
      await writeRemediationTrackingFile(outputPath, trackingFile);
      console.log(`Created ${outputPath} with ${trackingFile.items.length} open remediation item${trackingFile.items.length === 1 ? "" : "s"}.`);
    });

  remediation
    .command("set")
    .description("Update one remediation item by its report fingerprint.")
    .option("--file <file>", "Remediation file path", DEFAULT_REMEDIATION_FILE)
    .requiredOption("--fingerprint <fingerprint>", "Exact finding fingerprint from a11y-report.json")
    .requiredOption("--status <status>", "open, in-progress, fixed, accepted-temporarily, or manual-review")
    .option("--owner <owner>", "Responsible person or team")
    .option("--reason <reason>", "Decision or remediation context")
    .option("--review-by <date>", "Review date required for accepted-temporarily")
    .action(async (options: RemediationSetOptions) => {
      const filePath = path.resolve(options.file || DEFAULT_REMEDIATION_FILE);
      const current = await readRemediationTrackingFile(filePath);
      const updated = updateRemediationStatus(current, {
        fingerprint: options.fingerprint,
        status: toRemediationStatus(options.status),
        owner: options.owner,
        reason: options.reason,
        reviewBy: options.reviewBy
      });
      await writeRemediationTrackingFile(filePath, updated);
      console.log(`Updated ${options.fingerprint} to ${options.status} in ${filePath}.`);
    });
}

async function readReport(reportPath: string): Promise<A11yReport> {
  const parsed = JSON.parse(await fs.readFile(reportPath, "utf8")) as Partial<A11yReport>;
  if (!parsed.generatedAt || !parsed.summary || !Array.isArray(parsed.issues)) {
    throw new Error(`Invalid accessibility report: ${reportPath}`);
  }
  return parsed as A11yReport;
}

function toRemediationStatus(value: string): RemediationStatus {
  if (
    value === "open" ||
    value === "in-progress" ||
    value === "fixed" ||
    value === "accepted-temporarily" ||
    value === "manual-review"
  ) {
    return value;
  }
  throw new Error("Unsupported remediation status.");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
