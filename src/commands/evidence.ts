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
import { createEvidencePackage, verifyEvidencePackage, type EvidencePackageManifest, type EvidencePackageVerification } from "../core/evidencePackage.js";

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

interface EvidenceVerifyOptions {
  package?: string;
  requireReviewReady?: boolean;
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
    .command("verify")
    .description("Verify checksums in a local evidence package.")
    .option("--package <dir>", "Evidence package directory", "a11y-evidence")
    .option("--require-review-ready", "Fail when the package is checksum-valid but missing review handoff evidence")
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: EvidenceVerifyOptions) => {
      const format = toEvidenceVerifyFormat(options.format);
      const packageDir = path.resolve(options.package || "a11y-evidence");
      const verification = await verifyEvidencePackage(packageDir);
      console.log(formatEvidenceVerifyResult(verification, packageDir, format));
      if (shouldFailEvidenceVerify(verification, options)) {
        process.exitCode = 1;
      }
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
    `Contents: ${formatEvidencePackContents(manifest)}`,
    `Review summary: ${formatEvidencePackReviewSummary(manifest)}`,
    `Review readiness: ${formatEvidenceReviewReadiness(manifest.reviewReadiness)}`,
    `Review before sharing: ${path.join(outputDir, "evidence-summary.md")}`,
    `Machine-readable manifest: ${path.join(outputDir, "evidence-manifest.json")}`,
    `Next: npx a11y-shiftleft-cli evidence verify --package ${shellQuote(outputDir)}`,
    ...hints
  ].join("\n");
}

export function formatEvidenceVerifyOutput(verification: EvidencePackageVerification, packageDir: string): string {
  return [
    verification.valid
      ? `Evidence package verified: ${packageDir}`
      : `Evidence package verification failed: ${packageDir}`,
    `Files checked: ${verification.filesChecked}`,
    `Missing files: ${verification.missingFiles.length}`,
    `Changed files: ${verification.changedFiles.length}`,
    `Review summary: ${formatEvidenceReviewSummary(verification.reviewSummary)}`,
    `Review readiness: ${formatEvidenceReviewReadiness(verification.reviewReadiness)}`,
    ...formatEvidenceReadinessBlockers(verification.reviewReadiness),
    `Privacy: ${formatEvidenceVerifyPrivacy(verification)}`,
    `Review before sharing: ${path.join(packageDir, "evidence-summary.md")}`,
    ...formatEvidenceVerifyHints(verification),
    ...verification.missingFiles.slice(0, 5).map((file) => `  missing: ${file}`),
    ...verification.changedFiles.slice(0, 5).map((file) => `  changed: ${file}`)
  ].join("\n");
}

export type EvidenceVerifyFormat = "text" | "json";

export function formatEvidenceVerifyResult(
  verification: EvidencePackageVerification,
  packageDir: string,
  format: EvidenceVerifyFormat
): string {
  if (format === "json") {
    return `${JSON.stringify({
      package: packageDir,
      ...verification
    }, null, 2)}\n`;
  }
  return formatEvidenceVerifyOutput(verification, packageDir);
}

export function shouldFailEvidenceVerify(
  verification: EvidencePackageVerification,
  options: Pick<EvidenceVerifyOptions, "requireReviewReady"> = {}
): boolean {
  return !verification.valid || (Boolean(options.requireReviewReady) && !verification.reviewReadiness.readyForReview);
}

function formatEvidenceVerifyPrivacy(verification: EvidencePackageVerification): string {
  return [
    verification.privacy.screenshotsIncluded ? "screenshots included" : "no screenshots",
    verification.privacy.reviewRequiredBeforeSharing ? "review before sharing required" : "sharing review not marked",
    verification.privacy.warnings.length > 0
      ? `${verification.privacy.warnings.length} privacy warning${verification.privacy.warnings.length === 1 ? "" : "s"}`
      : "no privacy warnings"
  ].join("; ");
}

function formatEvidenceVerifyHints(verification: EvidencePackageVerification): string[] {
  if (verification.reviewHints.length === 0) return ["Review hints: none"];
  return [
    `Review hints: ${verification.reviewHints.length}`,
    ...verification.reviewHints.slice(0, 3).map((hint) => `  - ${hint}`),
    ...(verification.reviewHints.length > 3 ? [`  - ${verification.reviewHints.length - 3} more hint${verification.reviewHints.length - 3 === 1 ? "" : "s"} in evidence-summary.md`] : [])
  ];
}

function formatEvidencePackContents(manifest: EvidencePackageManifest): string {
  const content = manifest.contentSummary;
  return [
    `reports=${content.automatedReports}`,
    `exports=${content.evidenceExportFiles}`,
    `manual=${content.manualReviewFiles}`,
    `keyboard=${content.keyboardEvidenceFiles}`,
    `dashboard=${content.dashboardFiles}`,
    `visual=${content.visualReports}`,
    `screenshots=${content.screenshots}`
  ].join(" ");
}

function formatEvidencePackReviewSummary(manifest: EvidencePackageManifest): string {
  return formatEvidenceReviewSummary(manifest.reviewSummary);
}

function formatEvidenceReviewReadiness(readiness: EvidencePackageManifest["reviewReadiness"] | EvidencePackageVerification["reviewReadiness"]): string {
  if (readiness.readyForReview) return "ready for review handoff";
  const count = readiness.blockingHints.length;
  return `not ready for review handoff (${count} blocker${count === 1 ? "" : "s"})`;
}

function formatEvidenceReadinessBlockers(readiness: EvidencePackageManifest["reviewReadiness"] | EvidencePackageVerification["reviewReadiness"]): string[] {
  if (readiness.readyForReview || readiness.blockingHints.length === 0) return [];
  return [
    "Review readiness blockers:",
    ...readiness.blockingHints.slice(0, 5).map((hint) => `  - ${hint}`),
    ...(readiness.blockingHints.length > 5 ? [`  - ${readiness.blockingHints.length - 5} more blocker${readiness.blockingHints.length - 5 === 1 ? "" : "s"} in evidence-summary.md`] : [])
  ];
}

function formatEvidenceReviewSummary(summary: EvidencePackageManifest["reviewSummary"] | EvidencePackageVerification["reviewSummary"]): string {
  if (!summary) return "none included";

  const parts = [
    `manual ${summary.manualReviewCompleted}/${summary.manualReviewItems} completed`,
    `steps ${summary.manualStepsCompleted}/${summary.manualStepRecords} reviewed`,
    `journeys ${summary.criticalJourneys} tracked`,
    `${summary.journeyFindings} journey finding${summary.journeyFindings === 1 ? "" : "s"}`
  ];

  if (summary.journeyFindings > 0) {
    parts.push(`${summary.journeyCritical} critical, ${summary.journeyWarning} warning, ${summary.journeyInfo} info`);
  }

  return parts.join("; ");
}

export function formatEvidenceExportOutput(evidence: EvidenceExport, outputPath: string): string {
  const topUrl = topEntry(evidence.summary.byUrl);
  const topCriterion = topEntry(evidence.summary.byWcagCriterion);
  const topJourney = topEntry(evidence.summary.byJourney);

  return [
    `Wrote ${evidence.records.length} evidence record${evidence.records.length === 1 ? "" : "s"} to ${outputPath}`,
    `Scope: ${formatEvidenceScope(evidence)}`,
    `Summary: ${evidence.summary.critical} critical, ${evidence.summary.warning} warning, ${evidence.summary.info} info`,
    ...formatEvidenceReviewLines(evidence),
    `Evidence types: ${evidence.summary.wcagMapped} WCAG-mapped, ${evidence.summary.needsReview} needs review, ${evidence.summary.bestPractice} best practice`,
    ...(topJourney ? [`Top journey: ${topJourney[0]} (${topJourney[1]})`] : []),
    topUrl ? `Top URL: ${topUrl[0]} (${topUrl[1]})` : "Top URL: none",
    topCriterion ? `Top WCAG criterion: ${topCriterion[0]} (${topCriterion[1]})` : "Top WCAG criterion: none"
  ].join("\n");
}

function formatEvidenceReviewLines(evidence: EvidenceExport): string[] {
  const manual = evidence.review?.manualChecklist;
  const journeys = evidence.review?.journeys || [];
  const journeyFindings = journeys.reduce((sum, journey) => sum + journey.findingCount, 0);
  const journeyCritical = journeys.reduce((sum, journey) => sum + journey.critical, 0);
  const journeyWarning = journeys.reduce((sum, journey) => sum + journey.warning, 0);
  const journeyInfo = journeys.reduce((sum, journey) => sum + journey.info, 0);
  if (!manual && journeys.length === 0) return [];

  return [
    manual
      ? `Manual review: ${manual.pass} pass, ${manual.fail} fail, ${manual.notReviewed} not reviewed, ${manual.targetCount} target${manual.targetCount === 1 ? "" : "s"}`
      : "Manual review: not included",
    journeys.length > 0
      ? `Journeys: ${journeys.length} tracked, ${journeyFindings} finding${journeyFindings === 1 ? "" : "s"} (${journeyCritical} critical, ${journeyWarning} warning, ${journeyInfo} info)`
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

function toEvidenceVerifyFormat(value: string | undefined): EvidenceVerifyFormat {
  if (value === "text" || value === undefined) return "text";
  if (value === "json") return "json";
  throw new Error("Unsupported evidence verify format. Use text or json.");
}

function topEntry(counts: Record<string, number>): [string, number] | undefined {
  return Object.entries(counts).sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0];
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}
