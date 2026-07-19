import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { createAgentReview, formatAgentReview } from "../core/agentReview.js";
import { readA11yReport } from "../core/evidenceExport.js";

interface AgentReviewOptions {
  report?: string;
  previous?: string;
  maxItems?: string;
  out?: string;
  json?: boolean;
}

export function registerAgentCommand(program: Command): void {
  const agent = program
    .command("agent")
    .description("Local deterministic review assistant for generated accessibility reports.");

  agent
    .command("review")
    .description("Summarize an accessibility report, compare progress, and suggest the next CLI step.")
    .option("--report <file-or-dir>", "Current a11y-report.json file or report directory", "reports/a11y-report.json")
    .option("--previous <file-or-dir>", "Previous a11y-report.json file or report directory for comparison")
    .option("--max-items <count>", "Maximum fix-first findings to show", "5")
    .option("--out <file>", "Write the review to a file instead of stdout")
    .option("--json", "Write JSON instead of text")
    .action(async (options: AgentReviewOptions) => {
      const reportPath = await resolveReportPath(options.report || "reports/a11y-report.json");
      const previousReportPath = options.previous ? await resolveReportPath(options.previous) : undefined;
      const report = await readA11yReport(reportPath);
      const previousReport = previousReportPath ? await readA11yReport(previousReportPath) : undefined;
      const review = createAgentReview({
        report,
        previousReport,
        reportPath,
        previousReportPath,
        maxItems: toPositiveInteger(options.maxItems)
      });
      const output = options.json
        ? `${JSON.stringify(review, null, 2)}\n`
        : formatAgentReview(review);

      if (options.out) {
        const outputPath = path.resolve(options.out);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, output);
        console.log(`Wrote agent review to ${outputPath}`);
        return;
      }

      console.log(output.trimEnd());
    });
}

async function resolveReportPath(fileOrDir: string): Promise<string> {
  const resolved = path.resolve(fileOrDir);
  const stats = await fs.stat(resolved);
  return stats.isDirectory() ? path.join(resolved, "a11y-report.json") : resolved;
}

function toPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Maximum item count must be a positive integer.");
  }
  return parsed;
}
