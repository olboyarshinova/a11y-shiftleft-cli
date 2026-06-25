import path from "node:path";
import type { Command } from "commander";
import { prepareShareReport } from "../core/sharePrepare.js";

interface SharePrepareOptions {
  report?: string;
  out?: string;
}

export function registerShareCommand(program: Command): void {
  const share = program
    .command("share")
    .description("Prepare sanitized local report copies for external review without uploading them.");

  share
    .command("prepare")
    .description("Create a sanitized static report and privacy summary from a generated a11y-report.json.")
    .option("--report <file-or-dir>", "Source a11y-report.json file or report directory", "reports/a11y-report.json")
    .option("--out <dir>", "Empty output directory", "a11y-share")
    .action(async (options: SharePrepareOptions) => {
      const manifest = await prepareShareReport({
        reportPath: path.resolve(options.report || "reports/a11y-report.json"),
        outputDir: path.resolve(options.out || "a11y-share")
      });

      console.log(formatSharePrepareSummary(manifest.outputs.length, path.resolve(options.out || "a11y-share")));
      console.log(`Review privacy summary: ${path.join(path.resolve(options.out || "a11y-share"), "privacy-summary.json")}`);
    });
}

export function formatSharePrepareSummary(outputCount: number, outputDir: string): string {
  return `Created sanitized local share package with ${outputCount} file${outputCount === 1 ? "" : "s"}: ${outputDir}`;
}
