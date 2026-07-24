import path from "node:path";
import type { Command } from "commander";
import fs from "node:fs/promises";
import {
  createEvidenceExport,
  readA11yReport,
  serializeEvidenceExport,
  type EvidenceExport,
  type EvidenceExportFormat
} from "../core/evidenceExport.js";
import { createEvidencePackage, type EvidencePackageManifest } from "../core/evidencePackage.js";

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

      console.log(formatEvidencePackOutput(manifest, outputDir));
    });

  evidence
    .command("export")
    .description("Export a machine-readable finding evidence dataset from a11y-report.json.")
    .option("--report <file>", "Path to a11y-report.json", "reports/a11y-report.json")
    .option("--out <file>", "Write evidence dataset to a file instead of stdout")
    .option("--format <format>", "Output format: json, jsonl, or jsonld", "json")
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
        console.log(formatEvidenceExportOutput(evidence, outputPath));
        return;
      }

      console.log(output);
    });
}

export function formatEvidencePackOutput(manifest: EvidencePackageManifest, outputDir: string): string {
  const hints = manifest.reviewHints.length > 0
    ? [
      `Review hints: ${manifest.reviewHints.length}`,
      ...manifest.reviewHints.slice(0, 3).map((hint) => `  - ${hint}`),
      ...(manifest.reviewHints.length > 3 ? [`  - ${manifest.reviewHints.length - 3} more hint${manifest.reviewHints.length - 3 === 1 ? "" : "s"} in evidence-summary.md`] : [])
    ]
    : ["Review hints: none"];
  return [
    `Created local evidence package with ${manifest.files.length} file${manifest.files.length === 1 ? "" : "s"}: ${outputDir}`,
    `Review before sharing: ${path.join(outputDir, "evidence-summary.md")}`,
    `Machine-readable manifest: ${path.join(outputDir, "evidence-manifest.json")}`,
    ...hints
  ].join("\n");
}

export function formatEvidenceExportOutput(evidence: EvidenceExport, outputPath: string): string {
  const topUrl = topEntry(evidence.summary.byUrl);
  const topCriterion = topEntry(evidence.summary.byWcagCriterion);

  return [
    `Wrote ${evidence.records.length} evidence record${evidence.records.length === 1 ? "" : "s"} to ${outputPath}`,
    `Scope: ${formatEvidenceScope(evidence)}`,
    `Summary: ${evidence.summary.critical} critical, ${evidence.summary.warning} warning, ${evidence.summary.info} info`,
    ...formatEvidenceReviewLines(evidence),
    `Evidence types: ${evidence.summary.wcagMapped} WCAG-mapped, ${evidence.summary.needsReview} needs review, ${evidence.summary.bestPractice} best practice`,
    topUrl ? `Top URL: ${topUrl[0]} (${topUrl[1]})` : "Top URL: none",
    topCriterion ? `Top WCAG criterion: ${topCriterion[0]} (${topCriterion[1]})` : "Top WCAG criterion: none"
  ].join("\n");
}

function formatEvidenceReviewLines(evidence: EvidenceExport): string[] {
  const manual = evidence.review?.manualChecklist;
  const journeys = evidence.review?.journeys || [];
  const journeyFindings = journeys.reduce((sum, journey) => sum + journey.findingCount, 0);
  if (!manual && journeys.length === 0) return [];

  return [
    manual
      ? `Manual review: ${manual.pass} pass, ${manual.fail} fail, ${manual.notReviewed} not reviewed, ${manual.targetCount} target${manual.targetCount === 1 ? "" : "s"}`
      : "Manual review: not included",
    journeys.length > 0
      ? `Journeys: ${journeys.length} tracked, ${journeyFindings} finding${journeyFindings === 1 ? "" : "s"}`
      : "Journeys: none"
  ];
}

function formatEvidenceScope(evidence: EvidenceExport): string {
  const command = evidence.provenance.command
    ? `${evidence.provenance.command.name}/${evidence.provenance.command.profile}`
    : "unknown command";
  const standard = evidence.provenance.standard?.id || "no standard preset";
  const urls = evidence.provenance.includedUrls.length || evidence.provenance.requestedUrls.length;
  const browser = evidence.provenance.browsers?.[0]?.name;

  return [
    command,
    standard,
    `${urls} URL${urls === 1 ? "" : "s"}`,
    browser
  ].filter(Boolean).join(" | ");
}

function toEvidenceExportFormat(value: string | undefined): EvidenceExportFormat {
  if (value === "json" || value === undefined) return "json";
  if (value === "jsonl") return "jsonl";
  if (value === "jsonld") return "jsonld";
  throw new Error("Unsupported evidence export format. Use json, jsonl, or jsonld.");
}

function topEntry(counts: Record<string, number>): [string, number] | undefined {
  return Object.entries(counts).sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0];
}
