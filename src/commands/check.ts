import type { Command } from "commander";
import { loadConfig } from "../config/loadConfig.js";
import { runEslintAdapter } from "../adapters/eslintAdapter.js";
import { runAxePlaywrightAdapter } from "../adapters/axePlaywrightAdapter.js";
import { normalizeIssue } from "../core/normalize.js";
import { dedupeIssues } from "../core/dedupe.js";
import { triageIssues } from "../core/severity.js";
import { writeReports } from "../reporters/writeReports.js";
import { detectFramework } from "../core/detectFramework.js";
import { matchesWcagLevel, matchesWcagVersion } from "../core/wcagMap.js";
import { resolveStandard } from "../core/standards.js";
import type { ComplianceStandard, Framework, ReportFormat, ReportSummary, Severity, TriagedIssue, WcagLevel, WcagVersion } from "../types.js";

interface CheckOptions {
  cwd: string;
  config?: string;
  framework?: string;
  static?: boolean;
  dynamic?: boolean;
  url?: string[];
  crawl?: boolean;
  crawlDepth?: string;
  crawlLimit?: string;
  include?: string[];
  format?: string[];
  out?: string;
  failOn?: Severity | "none";
  standard?: string;
  wcagFilter?: string;
  wcagVersion?: string;
  semiAuto?: boolean;
}

interface CheckModeOptions {
  staticRequested?: boolean;
  dynamicRequested?: boolean;
  hasDynamicInput?: boolean;
  configDynamicEnabled?: boolean;
}

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("Run static and/or dynamic accessibility checks.")
    .option("--cwd <dir>", "Target project directory", process.cwd())
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .option("--static", "Run static checks only")
    .option("--dynamic", "Run dynamic checks only")
    .option("--url <urls...>", "Target URL(s) for dynamic scan")
    .option("--crawl", "Discover and scan same-origin links from dynamic URLs")
    .option("--crawl-depth <depth>", "Maximum same-origin crawl depth", "1")
    .option("--crawl-limit <limit>", "Maximum discovered URLs to scan", "10")
    .option("--include <patterns...>", "Static file globs to scan")
    .option("--format <formats...>", "Report formats: json, csv, markdown, or all")
    .option("--out <dir>", "Output directory")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, or section508")
    .option("--wcag-filter <level>", "Only report findings mapped to WCAG level A, AA, or AAA")
    .option("--wcag-version <version>", "Limit mapped findings to WCAG version 2.0, 2.1, or 2.2")
    .option("--semi-auto", "Generate a Markdown manual review checklist alongside automated reports")
    .action(async (options: CheckOptions) => {
      const startedAt = Date.now();
      const urls = parseUrls(options.url);
      const staticOnly = Boolean(options.static && !options.dynamic);
      const config = await loadConfig({
        cwd: options.cwd,
        config: options.config
      }, {
        framework: toFramework(options.framework),
        outputDir: options.out,
        standard: toComplianceStandard(options.standard),
        wcagVersion: toWcagVersion(options.wcagVersion),
        failOn: options.failOn,
        static: {
          include: options.include
        },
        dynamic: {
          enabled: !staticOnly && (options.dynamic || urls.length > 0 || options.crawl) ? true : undefined,
          urls: urls.length > 0 ? urls : undefined,
          crawl: options.crawl ? true : undefined,
          crawlDepth: toPositiveInteger(options.crawlDepth),
          crawlLimit: toPositiveInteger(options.crawlLimit)
        }
      });

      const { runStatic, runDynamic } = resolveCheckModes({
        staticRequested: Boolean(options.static),
        dynamicRequested: Boolean(options.dynamic),
        hasDynamicInput: urls.length > 0 || Boolean(options.crawl),
        configDynamicEnabled: config.dynamic.enabled
      });
      const standard = resolveStandard(config.standard);
      const framework = config.framework === "auto"
        ? await detectFramework(config.cwd)
        : config.framework;
      const effectiveConfig = {
        ...config,
        framework,
        wcagVersion: options.wcagVersion ? config.wcagVersion : standard.wcagVersion,
        wcagLevel: standard.wcagLevel
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
      const explicitWcagFilter = toWcagLevel(options.wcagFilter);
      const filtered = filterByWcagConformance(triaged, {
        level: explicitWcagFilter || effectiveConfig.wcagLevel,
        version: effectiveConfig.wcagVersion,
        includeUnmapped: !explicitWcagFilter
      });
      const uniqueIssues = dedupeIssues(filtered);
      const report = await writeReports(effectiveConfig.outputDir, uniqueIssues, {
        framework,
        cwd: effectiveConfig.cwd,
        urls: runDynamic ? effectiveConfig.dynamic.urls : [],
        standard: {
          ...standard,
          wcagVersion: effectiveConfig.wcagVersion,
          wcagLevel: effectiveConfig.wcagLevel
        },
        scanDurationMs: Date.now() - startedAt,
        rawCount: rawIssues.length,
        uniqueCount: uniqueIssues.length,
        duplicateCount: filtered.length - uniqueIssues.length
      }, {
        formats: parseFormats(options.format),
        semiAuto: Boolean(options.semiAuto)
      });

      console.log(JSON.stringify(report.summary, null, 2));

      if (shouldFail(report.summary, config.failOn)) {
        process.exitCode = 1;
      }
    });
}

export function resolveCheckModes({
  staticRequested = false,
  dynamicRequested = false,
  hasDynamicInput = false,
  configDynamicEnabled = false
}: CheckModeOptions): { runStatic: boolean; runDynamic: boolean } {
  if (staticRequested && !dynamicRequested) {
    return {
      runStatic: true,
      runDynamic: false
    };
  }

  if (dynamicRequested && !staticRequested) {
    return {
      runStatic: false,
      runDynamic: true
    };
  }

  return {
    runStatic: true,
    runDynamic: dynamicRequested || hasDynamicInput || configDynamicEnabled
  };
}

export function filterByWcagLevel(issues: TriagedIssue[], level?: WcagLevel): TriagedIssue[] {
  return filterByWcagConformance(issues, { level, includeUnmapped: false });
}

export function filterByWcagConformance(
  issues: TriagedIssue[],
  options: {
    level?: WcagLevel;
    version?: WcagVersion;
    includeUnmapped?: boolean;
  } = {}
): TriagedIssue[] {
  if (!options.level && !options.version) return issues;
  const includeUnmapped = options.includeUnmapped ?? !options.level;

  return issues.flatMap((issue) => {
    if (issue.wcagCriteria.length === 0) {
      return includeUnmapped ? [issue] : [];
    }

    const criteria = issue.wcagCriteria.filter((criterion) => {
      const matchesLevel = options.level
        ? matchesWcagLevel([criterion], options.level)
        : true;
      const matchesVersion = options.version
        ? matchesWcagVersion(criterion, options.version)
        : true;

      return matchesLevel && matchesVersion;
    });

    if (criteria.length === 0) return [];

    return [{
      ...issue,
      wcag: criteria.map((criterion) => criterion.id),
      wcagCriteria: criteria
    }];
  });
}

export function parseFormats(formats?: string[]): ReportFormat[] {
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

  return normalized as ReportFormat[];
}

export function parseUrls(urls?: string[]): string[] {
  if (!urls || urls.length === 0) return [];

  return [...new Set(urls
    .flatMap((url) => url.split(","))
    .map((url) => url.trim())
    .filter(Boolean))];
}

export function shouldFail(summary: Pick<ReportSummary, "critical" | "warning" | "info">, failOn: Severity | "none" = "critical"): boolean {
  if (failOn === "none") return false;
  if (failOn === "info") return summary.info > 0 || summary.warning > 0 || summary.critical > 0;
  if (failOn === "warning") return summary.warning > 0 || summary.critical > 0;
  return summary.critical > 0;
}

function toFramework(framework: string | undefined): Framework | undefined {
  if (
    framework === "react" ||
    framework === "vue" ||
    framework === "angular" ||
    framework === "auto" ||
    framework === "unknown"
  ) {
    return framework;
  }

  return undefined;
}

function toWcagLevel(level: string | undefined): WcagLevel | undefined {
  const normalized = level?.toUpperCase();
  if (normalized === "A" || normalized === "AA" || normalized === "AAA") return normalized;
  return undefined;
}

function toWcagVersion(version: string | undefined): WcagVersion | undefined {
  if (version === "2.0" || version === "2.1" || version === "2.2") return version;
  return undefined;
}

function toComplianceStandard(standard: string | undefined): ComplianceStandard | undefined {
  if (standard === "wcag22-aa" || standard === "ada-title-ii" || standard === "section508") return standard;
  return undefined;
}

function toPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}
