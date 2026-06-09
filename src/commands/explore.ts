import type { Command } from "commander";
import { runExplorePlaywrightAdapter, writeExplorationGraph } from "../adapters/explorePlaywrightAdapter.js";
import { loadConfig } from "../config/loadConfig.js";
import { dedupeIssues } from "../core/dedupe.js";
import { detectFramework } from "../core/detectFramework.js";
import { normalizeIssue } from "../core/normalize.js";
import { triageIssues } from "../core/severity.js";
import { resolveStandard } from "../core/standards.js";
import { writeExplorationHtml } from "../reporters/writeExplorationHtml.js";
import { writeReports } from "../reporters/writeReports.js";
import type {
  ComplianceStandard,
  Framework,
  Severity,
  WcagLevel,
  WcagVersion
} from "../types.js";
import { filterByWcagConformance, parseFormats, shouldFail } from "./check.js";

interface ExploreOptions {
  cwd?: string;
  config?: string;
  framework?: string;
  url: string;
  depth?: string;
  limit?: string;
  actionsPerState?: string;
  out?: string;
  failOn?: Severity | "none";
  standard?: string;
  wcagFilter?: string;
  wcagVersion?: string;
  format?: string[];
  html?: boolean;
  screenshots?: boolean;
  semiAuto?: boolean;
}

export function registerExploreCommand(program: Command): void {
  program
    .command("explore")
    .description("Safely explore UI states and run dynamic accessibility checks.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "react, vue, angular, or auto")
    .requiredOption("--url <url>", "Start URL for UI exploration")
    .option("--depth <depth>", "Maximum interaction depth", "2")
    .option("--limit <limit>", "Maximum UI states to scan", "20")
    .option("--actions-per-state <limit>", "Maximum safe actions to try per state", "8")
    .option("--out <dir>", "Output directory")
    .option("--fail-on <severity>", "critical, warning, info, or none")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, or section508")
    .option("--wcag-filter <level>", "Only report findings mapped to WCAG level A, AA, or AAA")
    .option("--wcag-version <version>", "Limit mapped findings to WCAG version 2.0, 2.1, or 2.2")
    .option("--format <formats...>", "Report formats: json, csv, markdown, or all")
    .option("--no-html", "Do not generate exploration.html")
    .option("--no-screenshots", "Do not save state screenshots")
    .option("--semi-auto", "Generate a Markdown manual review checklist alongside automated reports")
    .action(async (options: ExploreOptions) => {
      const startedAt = Date.now();
      const config = await loadConfig({
        cwd: options.cwd,
        config: options.config
      }, {
        framework: toFramework(options.framework),
        outputDir: options.out,
        standard: toComplianceStandard(options.standard),
        wcagVersion: toWcagVersion(options.wcagVersion),
        failOn: options.failOn,
        dynamic: {
          enabled: true,
          urls: [options.url]
        }
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

      const exploration = await runExplorePlaywrightAdapter(effectiveConfig, {
        url: options.url,
        outputDir: effectiveConfig.outputDir,
        maxDepth: toPositiveInteger(options.depth),
        maxStates: toPositiveInteger(options.limit),
        maxActionsPerState: toPositiveInteger(options.actionsPerState),
        screenshots: options.screenshots,
        onProgress: (event) => {
          if (event.type === "state") {
            const screenshot = event.state.screenshot ? ` screenshot=${event.state.screenshot}` : "";
            console.log(`[explore] ${event.state.id} depth=${event.state.depth} issues=${event.state.issueCount}${screenshot}`);
          }

          if (event.type === "actions") {
            console.log(`[explore] ${event.stateId} queued safe actions=${event.actionCount}`);
          }
        }
      });

      await writeExplorationGraph(effectiveConfig.outputDir, exploration.graph);

      const normalized = exploration.issues.map(normalizeIssue);
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
        urls: [...new Set(exploration.graph.states.map((state) => state.url))],
        standard: {
          ...standard,
          wcagVersion: effectiveConfig.wcagVersion,
          wcagLevel: effectiveConfig.wcagLevel
        },
        scanDurationMs: Date.now() - startedAt,
        rawCount: exploration.issues.length,
        uniqueCount: uniqueIssues.length,
        duplicateCount: filtered.length - uniqueIssues.length
      }, {
        formats: parseFormats(options.format),
        semiAuto: Boolean(options.semiAuto)
      });
      if (options.html !== false) {
        await writeExplorationHtml(effectiveConfig.outputDir, exploration.graph, report.issues);
      }

      console.log(JSON.stringify({
        ...report.summary,
        exploration: exploration.graph.summary
      }, null, 2));

      if (shouldFail(report.summary, config.failOn)) {
        process.exitCode = 1;
      }
    });
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
