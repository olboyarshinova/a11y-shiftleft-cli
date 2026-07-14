import path from "node:path";
import type { Command } from "commander";
import fs from "node:fs/promises";
import {
  createEvidenceExport,
  readA11yReport,
  serializeEvidenceExport,
  type EvidenceExportFormat
} from "../core/evidenceExport.js";
import { createEvidencePackage } from "../core/evidencePackage.js";

interface EvidencePackOptions {
  reports?: string;
  out?: string;
  includeVisual?: boolean;
}

interface EvidenceExportOptions {
  report?: string;
  out?: string;
  format?: string;
}

export function registerEvidenceCommand(program: Command): void {
  const evidence = program
    .command("evidence")
    .description("Prepare local accessibility evidence artifacts without uploading them.");

  evidence
    .command("pack")
    .description("Copy selected report artifacts into a checksummed local evidence package.")
    .option("--reports <dir>", "Source report directory", "reports")
    .option("--out <dir>", "Empty output directory", "a11y-evidence")
    .option("--include-visual", "Include exploration HTML, PDF, and screenshots")
    .action(async (options: EvidencePackOptions) => {
      const reportsDir = path.resolve(options.reports || "reports");
      const outputDir = path.resolve(options.out || "a11y-evidence");
      const manifest = await createEvidencePackage({
        reportsDir,
        outputDir,
        includeVisual: Boolean(options.includeVisual)
      });

      console.log(`Created local evidence package with ${manifest.files.length} file${manifest.files.length === 1 ? "" : "s"}: ${outputDir}`);
      console.log(`Review before sharing: ${path.join(outputDir, "evidence-manifest.json")}`);
    });

  evidence
    .command("export")
    .description("Export a machine-readable finding evidence dataset from a11y-report.json.")
    .option("--report <file>", "Path to a11y-report.json", "reports/a11y-report.json")
    .option("--out <file>", "Write evidence dataset to a file instead of stdout")
    .option("--format <format>", "Output format: json or jsonl", "json")
    .action(async (options: EvidenceExportOptions) => {
      const format = toEvidenceExportFormat(options.format);
      const reportPath = path.resolve(options.report || "reports/a11y-report.json");
      const report = await readA11yReport(reportPath);
      const evidence = createEvidenceExport(report);
      const output = serializeEvidenceExport(evidence, format);

      if (options.out) {
        const outputPath = path.resolve(options.out);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, output);
        console.log(`Wrote ${evidence.records.length} evidence record${evidence.records.length === 1 ? "" : "s"} to ${outputPath}`);
        return;
      }

      console.log(output);
    });
}

function toEvidenceExportFormat(value: string | undefined): EvidenceExportFormat {
  if (value === "json" || value === undefined) return "json";
  if (value === "jsonl") return "jsonl";
  throw new Error("Unsupported evidence export format. Use json or jsonl.");
}
