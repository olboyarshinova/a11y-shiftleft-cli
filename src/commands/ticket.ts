import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  createTicketDrafts,
  createTicketPayloadPreviews,
  ticketDraftsToMarkdown,
  type KnownTicket,
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
  knownTickets?: string;
  skipKnown?: boolean;
  create?: boolean;
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
    .option("--format <format>", "Output format: markdown, json, or payloads", "markdown")
    .option("--tracker <tracker>", "Ticket tracker style: generic, jira, linear, or github", "generic")
    .option("--min-severity <severity>", "Minimum severity: critical, warning, or info", "warning")
    .option("--max-tickets <count>", "Maximum number of ticket drafts to export")
    .option("--known-tickets <file>", "Compare drafts with a previous ticket JSON or payload export")
    .option("--skip-known", "Do not export drafts whose fingerprint appears in --known-tickets")
    .option("--create", "Reserved for a future explicit tracker create mode; currently blocked for safety")
    .action(async (options: TicketExportOptions) => {
      if (options.create) {
        throw new Error(
          "Ticket create mode is not available yet. Run ticket export with --format markdown, json, or payloads, review the drafts, and create tracker issues manually."
        );
      }

      const reportPath = path.resolve(options.report || "reports/a11y-report.json");
      const format = toTicketFormat(options.format);
      const tracker = toTicketTracker(options.tracker);
      const minSeverity = toSeverity(options.minSeverity);
      const maxTickets = toPositiveInteger(options.maxTickets);
      const report = await readReport(reportPath);
      const knownTickets = options.knownTickets
        ? await readKnownTickets(path.resolve(options.knownTickets))
        : [];
      const drafts = createTicketDrafts(report, {
        tracker,
        minSeverity,
        maxTickets,
        knownTickets,
        skipKnown: options.skipKnown
      });
      const generatedAt = new Date().toISOString();
      const output = ticketExportOutput({
        format,
        generatedAt,
        tracker,
        drafts,
        report
      });

      if (options.out) {
        const outputPath = path.resolve(options.out);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, output);
        const knownCount = drafts.filter((draft) => draft.existingTicket).length;
        const knownSuffix = knownTickets.length > 0 ? ` (${knownCount} known duplicate${knownCount === 1 ? "" : "s"})` : "";
        console.log(`Wrote ${drafts.length} ticket draft${drafts.length === 1 ? "" : "s"}${knownSuffix} to ${outputPath}`);
        return;
      }

      console.log(output);
    });
}

async function readKnownTickets(filePath: string): Promise<KnownTicket[]> {
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  const candidates = knownTicketCandidates(parsed);

  return candidates
    .map(toKnownTicket)
    .filter((ticket): ticket is KnownTicket => Boolean(ticket));
}

function knownTicketCandidates(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const objectValue = value as Record<string, unknown>;
  if (Array.isArray(objectValue.drafts)) return objectValue.drafts;
  if (Array.isArray(objectValue.payloads)) return objectValue.payloads;
  if (Array.isArray(objectValue.tickets)) return objectValue.tickets;
  return [];
}

function toKnownTicket(value: unknown): KnownTicket | null {
  if (!value || typeof value !== "object") return null;
  const objectValue = value as Record<string, unknown>;
  const fingerprint = stringValue(objectValue.fingerprint);
  if (!fingerprint) return null;

  const payload = objectValue.payload && typeof objectValue.payload === "object"
    ? objectValue.payload as Record<string, unknown>
    : {};

  return {
    fingerprint,
    id: stringValue(objectValue.id) || stringValue(objectValue.draftId),
    title: stringValue(objectValue.title) || stringValue(payload.title),
    url: stringValue(objectValue.url) || stringValue(objectValue.webUrl),
    tracker: stringValue(objectValue.tracker),
    status: stringValue(objectValue.status)
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function readReport(reportPath: string): Promise<A11yReport> {
  const parsed = JSON.parse(await fs.readFile(reportPath, "utf8")) as Partial<A11yReport>;

  if (!parsed.generatedAt || !parsed.summary || !Array.isArray(parsed.issues)) {
    throw new Error(`Invalid accessibility report: ${reportPath}`);
  }

  return parsed as A11yReport;
}

function ticketExportOutput(options: {
  format: TicketFormat;
  generatedAt: string;
  tracker: TicketTracker;
  drafts: ReturnType<typeof createTicketDrafts>;
  report: A11yReport;
}): string {
  if (options.format === "json") {
    return `${JSON.stringify({
      generatedAt: options.generatedAt,
      tracker: options.tracker,
      dryRun: true,
      drafts: options.drafts
    }, null, 2)}\n`;
  }

  if (options.format === "payloads") {
    return `${JSON.stringify({
      generatedAt: options.generatedAt,
      tracker: options.tracker,
      dryRun: true,
      payloads: createTicketPayloadPreviews(options.drafts)
    }, null, 2)}\n`;
  }

  return ticketDraftsToMarkdown(options.drafts, options.report);
}

function toTicketFormat(value: string | undefined): TicketFormat {
  if (value === "markdown" || value === "json" || value === "payloads") return value;
  throw new Error("Unsupported ticket export format. Use markdown, json, or payloads.");
}

function toTicketTracker(value: string | undefined): TicketTracker {
  if (value === "generic" || value === "jira" || value === "linear" || value === "github") return value;
  throw new Error("Unsupported ticket tracker. Use generic, jira, linear, or github.");
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
