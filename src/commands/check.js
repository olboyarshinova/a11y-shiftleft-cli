import { loadConfig } from "../config/loadConfig.js";
import { runEslintAdapter } from "../adapters/eslintAdapter.js";
import { runAxePlaywrightAdapter } from "../adapters/axePlaywrightAdapter.js";
import { normalizeIssue } from "../core/normalize.js";
import { dedupeIssues } from "../core/dedupe.js";
import { triageIssues } from "../core/severity.js";
import { writeReports } from "../reporters/writeReports.js";
import { detectFramework } from "../core/detectFramework.js";

export function registerCheckCommand(program) {
  program
    .command("check")
    .description("Run static and/or dynamic accessibility checks.")
    .option("--cwd <dir>", "Target project directory", process.cwd())
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .option("--static", "Run static checks only")
    .option("--dynamic", "Run dynamic checks only")
    .option("--url <url>", "Target URL for dynamic scan")
    .option("--include <patterns...>", "Static file globs to scan")
    .option("--format <formats...>", "Report formats: json, csv, markdown, or all")
    .option("--out <dir>", "Output directory")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .action(async (options) => {
      const startedAt = Date.now();
      const config = await loadConfig({
        cwd: options.cwd,
        config: options.config
      }, {
        framework: options.framework,
        outputDir: options.out,
        failOn: options.failOn,
        static: {
          include: options.include
        },
        dynamic: {
          enabled: options.dynamic || Boolean(options.url) ? true : undefined,
          urls: options.url ? [options.url] : undefined
        }
      });

      const runStatic = options.static || !options.dynamic;
      const runDynamic = options.dynamic || Boolean(options.url);
      const framework = config.framework === "auto"
        ? await detectFramework(config.cwd)
        : config.framework;
      const effectiveConfig = {
        ...config,
        framework
      };

      const rawIssues = [];

      if (runStatic && effectiveConfig.static.enabled) {
        rawIssues.push(...await runEslintAdapter(effectiveConfig));
      }

      if (runDynamic && effectiveConfig.dynamic.enabled !== false) {
        rawIssues.push(...await runAxePlaywrightAdapter(effectiveConfig));
      }

      const normalized = rawIssues.map(normalizeIssue);
      const triaged = triageIssues(normalized);
      const uniqueIssues = dedupeIssues(triaged);
      const report = await writeReports(effectiveConfig.outputDir, uniqueIssues, {
        framework,
        cwd: effectiveConfig.cwd,
        urls: runDynamic ? effectiveConfig.dynamic.urls : [],
        scanDurationMs: Date.now() - startedAt,
        rawCount: rawIssues.length,
        uniqueCount: uniqueIssues.length,
        duplicateCount: rawIssues.length - uniqueIssues.length
      }, {
        formats: parseFormats(options.format)
      });

      console.log(JSON.stringify(report.summary, null, 2));

      if (shouldFail(report.summary, config.failOn)) {
        process.exitCode = 1;
      }
    });
}

export function parseFormats(formats) {
  if (!formats || formats.length === 0) {
    return ["json", "csv", "markdown"];
  }

  const normalized = formats
    .flatMap((format) => format.split(","))
    .map((format) => format.trim().toLowerCase())
    .filter(Boolean);

  if (normalized.includes("all")) {
    return ["json", "csv", "markdown"];
  }

  const supportedFormats = new Set(["json", "csv", "markdown"]);
  const unsupportedFormats = normalized.filter((format) => !supportedFormats.has(format));

  if (unsupportedFormats.length > 0) {
    throw new Error(`Unsupported report format: ${unsupportedFormats.join(", ")}`);
  }

  return normalized;
}

export function shouldFail(summary, failOn = "critical") {
  if (failOn === "none") return false;
  if (failOn === "info") return summary.info > 0 || summary.warning > 0 || summary.critical > 0;
  if (failOn === "warning") return summary.warning > 0 || summary.critical > 0;
  return summary.critical > 0;
}
