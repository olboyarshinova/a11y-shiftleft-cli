import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  createTicketDrafts,
  ticketDraftsToMarkdown,
  type TicketFormat,
  type TicketTracker
} from "../core/ticketDrafts.js";
import type { A11yReport, Severity } from "../types.js";

interface TicketExportOptions {
  report?: string;
  out?: string;
  format?: string;
  tracker?: string;
  minSeverity?: string;
  maxTickets?: string;
}

export function registerTicketCommand(program: Command): void {
  const ticket = program
    .command("ticket")
    .description("Create dry-run issue tracker drafts from accessibility reports.");

  ticket
    .command("export")
    .description("Export grouped accessibility findings as dry-run ticket drafts.")
    .option("--report <file>", "Path to a11y-report.json", "reports/a11y-report.json")
    .option("--out <file>", "Write ticket drafts to a file instead of stdout")
    .option("--format <format>", "Output format: markdown or json", "markdown")
    .option("--tracker <tracker>", "Ticket tracker style: generic, jira, or linear", "generic")
    .option("--min-severity <severity>", "Minimum severity: critical, warning, or info", "warning")
    .option("--max-tickets <count>", "Maximum number of ticket drafts to export")
    .action(async (options: TicketExportOptions) => {
      const reportPath = path.resolve(options.report || "reports/a11y-report.json");
      const format = toTicketFormat(options.format);
      const tracker = toTicketTracker(options.tracker);
      const minSeverity = toSeverity(options.minSeverity);
      const maxTickets = toPositiveInteger(options.maxTickets);
      const report = await readReport(reportPath);
      const drafts = createTicketDrafts(report, {
        tracker,
        minSeverity,
        maxTickets
      });
      const output = format === "json"
        ? `${JSON.stringify({ generatedAt: new Date().toISOString(), tracker, drafts }, null, 2)}\n`
        : ticketDraftsToMarkdown(drafts, report);

      if (options.out) {
        const outputPath = path.resolve(options.out);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, output);
        console.log(`Wrote ${drafts.length} ticket draft${drafts.length === 1 ? "" : "s"} to ${outputPath}`);
        return;
      }

      console.log(output);
    });
}

async function readReport(reportPath: string): Promise<A11yReport> {
  const parsed = JSON.parse(await fs.readFile(reportPath, "utf8")) as Partial<A11yReport>;

  if (!parsed.generatedAt || !parsed.summary || !Array.isArray(parsed.issues)) {
    throw new Error(`Invalid accessibility report: ${reportPath}`);
  }

  return parsed as A11yReport;
}

function toTicketFormat(value: string | undefined): TicketFormat {
  if (value === "markdown" || value === "json") return value;
  throw new Error("Unsupported ticket export format. Use markdown or json.");
}

function toTicketTracker(value: string | undefined): TicketTracker {
  if (value === "generic" || value === "jira" || value === "linear") return value;
  throw new Error("Unsupported ticket tracker. Use generic, jira, or linear.");
}

function toSeverity(value: string | undefined): Severity {
  if (value === "critical" || value === "warning" || value === "info") return value;
  throw new Error("Unsupported minimum severity. Use critical, warning, or info.");
}

function toPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Maximum ticket count must be a positive integer.");
  }
  return parsed;
}
