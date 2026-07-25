import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createEvidenceExport, readA11yReport, serializeEvidenceExport } from "./evidenceExport.js";

const TEXT_EVIDENCE_FILES = [
  "a11y-report.json",
  "a11y-comment.md",
  "a11y-metrics.csv",
  "a11y-summary.csv",
  "a11y-pages.csv",
  "a11y-rules.csv",
  "a11y-findings.csv",
  "a11y-evidence.json",
  "a11y-evidence.jsonl",
  "a11y-evidence.jsonld",
  "a11y-manual-checklist.md",
  "a11y-manual-checklist.json",
  "evaluation-scope.json",
  "keyboard-report.json",
  "keyboard-path.md",
  "exploration-graph.json",
  "dashboard.json"
] as const;

const VISUAL_EVIDENCE_FILES = [
  "a11y-report.html",
  "a11y-report.pdf",
  "exploration.html",
  "exploration.pdf",
  "dashboard.html",
  "dashboard.pdf"
] as const;

const SCREENSHOT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export interface EvidencePackageFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface EvidencePackageReportSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  baseline?: {
    enabled: boolean;
    newIssues: number;
    resolvedIssues: number;
  };
  retest?: {
    enabled: boolean;
    newIssues: number;
    fixedIssues: number;
    remainingIssues: number;
  };
}

export interface EvidencePackageReviewSummary {
  manualReviewItems: number;
  manualReviewCompleted: number;
  manualStepRecords: number;
  manualStepsCompleted: number;
  manualTaskEvidenceAttachments: number;
  manualRedactedTaskEvidence: number;
  manualTemporaryAcceptances: number;
  manualTemporaryAcceptancesExpiringSoon: number;
}

export interface EvidencePackageManifest {
  version: 1;
  generatedAt: string;
  source: string;
  localOnly: true;
  includeVisual: boolean;
  reportSummary?: EvidencePackageReportSummary;
  reviewSummary?: EvidencePackageReviewSummary;
  reviewHints: string[];
  contentSummary: {
    automatedReports: number;
    evidenceExportFiles: number;
    manualReviewFiles: number;
    evaluationScope: boolean;
    keyboardEvidenceFiles: number;
    dashboardFiles: number;
    visualReports: number;
    screenshots: number;
    rawExplorationGraph: boolean;
  };
  files: EvidencePackageFile[];
  privacy: {
    screenshotsIncluded: boolean;
    reviewRequiredBeforeSharing: true;
    warnings: string[];
  };
}

export interface EvidencePackageVerification {
  valid: boolean;
  filesChecked: number;
  missingFiles: string[];
  changedFiles: string[];
}

export async function createEvidencePackage(options: {
  reportsDir: string;
  outputDir: string;
  includeVisual?: boolean;
  generatedAt?: string;
}): Promise<EvidencePackageManifest> {
  const reportsDir = path.resolve(options.reportsDir);
  const outputDir = path.resolve(options.outputDir);
  const generatedAt = options.generatedAt || new Date().toISOString();
  await ensureDirectory(reportsDir, "Reports directory");
  await ensureEmptyOutput(outputDir);

  const files: EvidencePackageFile[] = [];
  const selectedFiles = options.includeVisual
    ? [...TEXT_EVIDENCE_FILES, ...VISUAL_EVIDENCE_FILES]
    : [...TEXT_EVIDENCE_FILES];

  for (const relativePath of selectedFiles) {
    const copied = await copyEvidenceFile(reportsDir, outputDir, relativePath);
    if (copied) files.push(copied);
  }

  if (options.includeVisual) {
    files.push(...await copyScreenshotEvidence(reportsDir, outputDir));
  }

  const generatedEvidenceExport = await createGeneratedEvidenceExport(reportsDir, outputDir, files, generatedAt);
  if (generatedEvidenceExport) files.push(generatedEvidenceExport);

  if (files.length === 0) {
    throw new Error(`No supported accessibility report artifacts found in ${reportsDir}`);
  }

  files.sort((left, right) => left.path.localeCompare(right.path));
  const screenshotsIncluded = files.some((file) => file.path.startsWith("screenshots/"));
  const reportSummary = await readReportSummary(reportsDir);
  const reviewSummary = await readReviewSummary(reportsDir);
  const contentSummary = summarizeEvidenceContents(files);
  const manifest: EvidencePackageManifest = {
    version: 1,
    generatedAt,
    source: path.basename(reportsDir),
    localOnly: true,
    includeVisual: Boolean(options.includeVisual),
    ...(reportSummary ? { reportSummary } : {}),
    ...(reviewSummary ? { reviewSummary } : {}),
    contentSummary,
    reviewHints: reviewHints(contentSummary, reportSummary, reviewSummary, Boolean(options.includeVisual)),
    files,
    privacy: {
      screenshotsIncluded,
      reviewRequiredBeforeSharing: true,
      warnings: privacyWarnings(Boolean(options.includeVisual), screenshotsIncluded)
    }
  };

  await fs.writeFile(
    path.join(outputDir, "evidence-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  await fs.writeFile(
    path.join(outputDir, "evidence-summary.md"),
    toEvidenceSummaryMarkdown(manifest)
  );

  return manifest;
}

export async function verifyEvidencePackage(packageDir: string): Promise<EvidencePackageVerification> {
  const root = path.resolve(packageDir);
  const manifest = JSON.parse(await fs.readFile(path.join(root, "evidence-manifest.json"), "utf8")) as EvidencePackageManifest;
  const missingFiles: string[] = [];
  const changedFiles: string[] = [];

  for (const file of manifest.files) {
    const filePath = path.join(root, file.path);
    const stats = await safeFileStats(filePath);
    if (!stats) {
      missingFiles.push(file.path);
      continue;
    }

    const actual = await describeFile(filePath, file.path);
    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) {
      changedFiles.push(file.path);
    }
  }

  return {
    valid: missingFiles.length === 0 && changedFiles.length === 0,
    filesChecked: manifest.files.length,
    missingFiles,
    changedFiles
  };
}

async function createGeneratedEvidenceExport(
  reportsDir: string,
  outputDir: string,
  files: EvidencePackageFile[],
  generatedAt: string
): Promise<EvidencePackageFile | null> {
  if (files.some((file) => file.path === "a11y-evidence.json")) return null;

  try {
    const report = await readA11yReport(path.join(reportsDir, "a11y-report.json"));
    const outputPath = path.join(outputDir, "a11y-evidence.json");
    await fs.writeFile(outputPath, serializeEvidenceExport(createEvidenceExport(report, generatedAt), "json"));
    return describeFile(outputPath, "a11y-evidence.json");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    if (error instanceof Error && error.message.startsWith("Invalid accessibility report:")) return null;
    throw error;
  }
}

async function copyEvidenceFile(
  reportsDir: string,
  outputDir: string,
  relativePath: string
): Promise<EvidencePackageFile | null> {
  const sourcePath = path.join(reportsDir, relativePath);
  const stats = await safeFileStats(sourcePath);
  if (!stats) return null;

  const destinationPath = path.join(outputDir, relativePath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  return describeFile(destinationPath, relativePath);
}

async function copyScreenshotEvidence(
  reportsDir: string,
  outputDir: string
): Promise<EvidencePackageFile[]> {
  const sourceDir = path.join(reportsDir, "screenshots");
  let entries;

  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }

  const files: EvidencePackageFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !SCREENSHOT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const relativePath = path.join("screenshots", entry.name);
    const copied = await copyEvidenceFile(reportsDir, outputDir, relativePath);
    if (copied) files.push(copied);
  }
  return files;
}

async function describeFile(filePath: string, relativePath: string): Promise<EvidencePackageFile> {
  const content = await fs.readFile(filePath);
  return {
    path: relativePath.split(path.sep).join("/"),
    bytes: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex")
  };
}

async function safeFileStats(filePath: string) {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isFile() && !stats.isSymbolicLink() ? stats : null;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

async function readReportSummary(reportsDir: string): Promise<EvidencePackageReportSummary | undefined> {
  const reportPath = path.join(reportsDir, "a11y-report.json");
  try {
    const parsed = JSON.parse(await fs.readFile(reportPath, "utf8")) as {
      summary?: {
        total?: unknown;
        critical?: unknown;
        warning?: unknown;
        info?: unknown;
        baseline?: {
          enabled?: unknown;
          newIssues?: unknown;
          resolvedIssues?: unknown;
        };
        retest?: {
          enabled?: unknown;
          newIssues?: unknown;
          fixedIssues?: unknown;
          remainingIssues?: unknown;
        };
      };
    };
    const summary = parsed.summary;
    if (!summary) return undefined;
    const total = toNumber(summary.total);
    const critical = toNumber(summary.critical);
    const warning = toNumber(summary.warning);
    const info = toNumber(summary.info);
    if (total === undefined || critical === undefined || warning === undefined || info === undefined) {
      return undefined;
    }
    return {
      total,
      critical,
      warning,
      info,
      ...(summary.baseline ? {
        baseline: {
          enabled: summary.baseline.enabled === true,
          newIssues: toNumber(summary.baseline.newIssues) || 0,
          resolvedIssues: toNumber(summary.baseline.resolvedIssues) || 0
        }
      } : {}),
      ...(summary.retest ? {
        retest: {
          enabled: summary.retest.enabled === true,
          newIssues: toNumber(summary.retest.newIssues) || 0,
          fixedIssues: toNumber(summary.retest.fixedIssues) || 0,
          remainingIssues: toNumber(summary.retest.remainingIssues) || 0
        }
      } : {})
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function readReviewSummary(reportsDir: string): Promise<EvidencePackageReviewSummary | undefined> {
  const scopePath = path.join(reportsDir, "evaluation-scope.json");
  try {
    const parsed = JSON.parse(await fs.readFile(scopePath, "utf8")) as {
      reviewStatus?: {
        manualReviewItems?: unknown;
        manualReviewCompleted?: unknown;
        manualStepRecords?: unknown;
        manualStepsCompleted?: unknown;
        manualTaskEvidenceAttachments?: unknown;
        manualRedactedTaskEvidence?: unknown;
        manualTemporaryAcceptances?: unknown;
        manualTemporaryAcceptancesExpiringSoon?: unknown;
      };
    };
    const status = parsed.reviewStatus;
    if (!status) return undefined;
    return {
      manualReviewItems: toNumber(status.manualReviewItems) || 0,
      manualReviewCompleted: toNumber(status.manualReviewCompleted) || 0,
      manualStepRecords: toNumber(status.manualStepRecords) || 0,
      manualStepsCompleted: toNumber(status.manualStepsCompleted) || 0,
      manualTaskEvidenceAttachments: toNumber(status.manualTaskEvidenceAttachments) || 0,
      manualRedactedTaskEvidence: toNumber(status.manualRedactedTaskEvidence) || 0,
      manualTemporaryAcceptances: toNumber(status.manualTemporaryAcceptances) || 0,
      manualTemporaryAcceptancesExpiringSoon: toNumber(status.manualTemporaryAcceptancesExpiringSoon) || 0
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function ensureDirectory(dirPath: string, label: string): Promise<void> {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) throw new Error(`${label} is not a directory: ${dirPath}`);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`${label} not found: ${dirPath}`);
    }
    throw error;
  }
}

async function ensureEmptyOutput(outputDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(outputDir);
    if (entries.length > 0) {
      throw new Error(`Evidence output directory must be empty: ${outputDir}`);
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await fs.mkdir(outputDir, { recursive: true });
      return;
    }
    throw error;
  }
}

function privacyWarnings(includeVisual: boolean, screenshotsIncluded: boolean): string[] {
  const warnings = [
    "Review URLs, selectors, file paths, issue messages, and manual-review notes before sharing."
  ];
  if (includeVisual) {
    warnings.push("Visual reports may contain rendered page content and user interface data.");
  }
  if (screenshotsIncluded) {
    warnings.push("Screenshots may contain personal, account, payment, or other sensitive information.");
  }
  return warnings;
}

function summarizeEvidenceContents(files: EvidencePackageFile[]): EvidencePackageManifest["contentSummary"] {
  const paths = new Set(files.map((file) => file.path));
  return {
    automatedReports: countMatching(paths, [
      "a11y-report.json",
      "a11y-comment.md",
      "a11y-summary.csv",
      "a11y-pages.csv",
      "a11y-rules.csv",
      "a11y-findings.csv",
      "a11y-metrics.csv"
    ]),
    evidenceExportFiles: countMatching(paths, [
      "a11y-evidence.json",
      "a11y-evidence.jsonl",
      "a11y-evidence.jsonld"
    ]),
    manualReviewFiles: countMatching(paths, [
      "a11y-manual-checklist.md",
      "a11y-manual-checklist.json"
    ]),
    evaluationScope: paths.has("evaluation-scope.json"),
    keyboardEvidenceFiles: countMatching(paths, [
      "keyboard-report.json",
      "keyboard-path.md"
    ]),
    dashboardFiles: countMatching(paths, [
      "dashboard.json",
      "dashboard.html",
      "dashboard.pdf"
    ]),
    visualReports: countMatching(paths, [
      "a11y-report.html",
      "a11y-report.pdf",
      "exploration.html",
      "exploration.pdf",
      "dashboard.html",
      "dashboard.pdf"
    ]),
    screenshots: files.filter((file) => file.path.startsWith("screenshots/")).length,
    rawExplorationGraph: paths.has("exploration-graph.json")
  };
}

function countMatching(paths: Set<string>, candidates: string[]): number {
  return candidates.filter((candidate) => paths.has(candidate)).length;
}

function reviewHints(
  content: EvidencePackageManifest["contentSummary"],
  reportSummary: EvidencePackageReportSummary | undefined,
  reviewSummary: EvidencePackageReviewSummary | undefined,
  includeVisual: boolean
): string[] {
  const hints: string[] = [];
  if (!reportSummary) {
    hints.push("No audit count summary was found in a11y-report.json.");
  }
  if (!content.evaluationScope) {
    hints.push("No evaluation-scope.json was included, so review scope and manual-review status are not documented in this package.");
  }
  if (!reviewSummary) {
    hints.push("No manual-review completion summary was found.");
  } else if (reviewSummary.manualReviewCompleted < reviewSummary.manualReviewItems) {
    hints.push("Manual review is incomplete; review the remaining checklist items before treating this package as final evidence.");
  }
  if (content.keyboardEvidenceFiles === 0) {
    hints.push("No keyboard evidence file was included.");
  }
  if (!includeVisual) {
    hints.push("Visual reports and screenshots were excluded. Re-run with --include-visual only when visual evidence is approved for sharing.");
  } else if (content.visualReports === 0 && content.screenshots === 0) {
    hints.push("Visual evidence was requested but no visual report or screenshot files were found.");
  }
  return hints;
}

function toEvidenceSummaryMarkdown(manifest: EvidencePackageManifest): string {
  const rows = manifest.files.map((file) =>
    `| \`${file.path}\` | ${file.bytes} | \`${file.sha256}\` |`
  ).join("\n");
  const warnings = manifest.privacy.warnings.map((warning) => `- ${warning}`).join("\n");

  return `# Accessibility Evidence Package

This local package contains copied accessibility report artifacts and checksums.
It does not upload reports anywhere. Review every file before sharing it outside
the project team.

| Field | Value |
|---|---|
| Source | ${markdownCell(manifest.source)} |
| Generated | ${manifest.generatedAt} |
| Include visual evidence | ${manifest.includeVisual ? "yes" : "no"} |
| Screenshots included | ${manifest.privacy.screenshotsIncluded ? "yes" : "no"} |
| Files copied | ${manifest.files.length} |

${formatReportSummaryMarkdown(manifest.reportSummary)}
${formatReviewSummaryMarkdown(manifest.reviewSummary)}
${formatReviewHintsMarkdown(manifest.reviewHints)}

## Evidence Contents

| Evidence type | Count |
|---|---:|
| Automated report files | ${manifest.contentSummary.automatedReports} |
| Machine-readable evidence exports | ${manifest.contentSummary.evidenceExportFiles} |
| Manual-review files | ${manifest.contentSummary.manualReviewFiles} |
| Evaluation scope | ${manifest.contentSummary.evaluationScope ? 1 : 0} |
| Keyboard evidence files | ${manifest.contentSummary.keyboardEvidenceFiles} |
| Dashboard files | ${manifest.contentSummary.dashboardFiles} |
| Visual reports | ${manifest.contentSummary.visualReports} |
| Screenshots | ${manifest.contentSummary.screenshots} |
| Raw exploration graph | ${manifest.contentSummary.rawExplorationGraph ? 1 : 0} |

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
${rows}

## Privacy Review

${warnings}
`;
}

function formatReportSummaryMarkdown(summary: EvidencePackageReportSummary | undefined): string {
  if (!summary) return "";
  return `## Audit Summary

| Metric | Value |
|---|---:|
| Total findings | ${summary.total} |
| Critical | ${summary.critical} |
| Warning | ${summary.warning} |
| Info | ${summary.info} |
${summary.baseline ? `| Baseline new findings | ${summary.baseline.newIssues} |
| Baseline resolved findings | ${summary.baseline.resolvedIssues} |
` : ""}${summary.retest ? `| Retest new findings | ${summary.retest.newIssues} |
| Retest fixed findings | ${summary.retest.fixedIssues} |
| Retest remaining findings | ${summary.retest.remainingIssues} |
` : ""}`;
}

function formatReviewSummaryMarkdown(summary: EvidencePackageReviewSummary | undefined): string {
  if (!summary) return "";
  return `## Manual Review Summary

| Metric | Value |
|---|---:|
| Manual review items | ${summary.manualReviewItems} |
| Manual review completed | ${summary.manualReviewCompleted} |
| Manual step records | ${summary.manualStepRecords} |
| Manual steps completed | ${summary.manualStepsCompleted} |
| Manual task evidence attachments | ${summary.manualTaskEvidenceAttachments} |
| Redacted manual task evidence | ${summary.manualRedactedTaskEvidence} |
| Temporary acceptances | ${summary.manualTemporaryAcceptances} |
| Temporary acceptances expiring soon | ${summary.manualTemporaryAcceptancesExpiringSoon} |
`;
}

function formatReviewHintsMarkdown(hints: string[]): string {
  if (hints.length === 0) return "";
  return `## Review Hints

${hints.map((hint) => `- ${hint}`).join("\n")}
`;
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
