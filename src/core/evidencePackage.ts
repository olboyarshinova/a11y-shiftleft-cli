import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const TEXT_EVIDENCE_FILES = [
  "a11y-report.json",
  "a11y-comment.md",
  "a11y-metrics.csv",
  "a11y-findings.csv",
  "a11y-manual-checklist.md",
  "a11y-manual-checklist.json",
  "keyboard-report.json",
  "keyboard-path.md",
  "exploration-graph.json"
] as const;

const VISUAL_EVIDENCE_FILES = [
  "exploration.html",
  "exploration.pdf"
] as const;

const SCREENSHOT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export interface EvidencePackageFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface EvidencePackageManifest {
  version: 1;
  generatedAt: string;
  source: string;
  localOnly: true;
  includeVisual: boolean;
  files: EvidencePackageFile[];
  privacy: {
    screenshotsIncluded: boolean;
    reviewRequiredBeforeSharing: true;
    warnings: string[];
  };
}

export async function createEvidencePackage(options: {
  reportsDir: string;
  outputDir: string;
  includeVisual?: boolean;
  generatedAt?: string;
}): Promise<EvidencePackageManifest> {
  const reportsDir = path.resolve(options.reportsDir);
  const outputDir = path.resolve(options.outputDir);
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

  if (files.length === 0) {
    throw new Error(`No supported accessibility report artifacts found in ${reportsDir}`);
  }

  files.sort((left, right) => left.path.localeCompare(right.path));
  const screenshotsIncluded = files.some((file) => file.path.startsWith("screenshots/"));
  const manifest: EvidencePackageManifest = {
    version: 1,
    generatedAt: options.generatedAt || new Date().toISOString(),
    source: path.basename(reportsDir),
    localOnly: true,
    includeVisual: Boolean(options.includeVisual),
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

  return manifest;
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
