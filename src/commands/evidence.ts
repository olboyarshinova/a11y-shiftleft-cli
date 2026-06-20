import path from "node:path";
import type { Command } from "commander";
import { createEvidencePackage } from "../core/evidencePackage.js";

interface EvidencePackOptions {
  reports?: string;
  out?: string;
  includeVisual?: boolean;
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
}
