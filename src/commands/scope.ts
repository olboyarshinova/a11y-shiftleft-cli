import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  createScopePlan,
  DEFAULT_SCOPE_FILE,
  parseExclusion,
  parseJourney,
  parseSamplePage,
  parseThirdPartyContent,
  toComplianceStandard,
  writeScopePlan
} from "../core/scopePlan.js";

interface ScopeInitOptions {
  cwd?: string;
  out?: string;
  force?: boolean;
  productName?: string;
  productType?: string;
  standard?: string;
  url?: string[];
  language?: string[];
  platform?: string[];
  assistiveTech?: string[];
  samplePage?: string[];
  randomSamplePage?: string[];
  journey?: string[];
  thirdParty?: string[];
  exclude?: string[];
  note?: string[];
}

export function registerScopeCommand(program: Command): void {
  const scope = program
    .command("scope")
    .description("Create and manage planned accessibility audit scope files.");

  scope
    .command("init")
    .description("Create a guided a11y-scope.json file for reproducible audits.")
    .option("--cwd <dir>", "Target project directory")
    .option("--out <file>", "Scope file path", DEFAULT_SCOPE_FILE)
    .option("--force", "Overwrite an existing scope file")
    .option("--product-name <name>", "Product or application name")
    .option("--product-type <type>", "Product type, such as marketing site, web app, ecommerce, or docs")
    .option("--standard <standard>", "wcag22-aa, ada-title-ii, or section508", "wcag22-aa")
    .option("--url <url>", "Representative URL to include in scope", collect, [])
    .option("--language <lang>", "Language or locale to include, such as en or es-US", collect, [])
    .option("--platform <target>", "Supported platform/browser combination", collect, [])
    .option("--assistive-tech <name>", "Assistive technology or input method to review", collect, [])
    .option("--sample-page <type:url>", "Representative page or page type, for example Core page:http://localhost:3000", collect, [])
    .option("--random-sample-page <type:url>", "Random or control sample page for comparison, for example Blog page:http://localhost:3000/blog/post", collect, [])
    .option("--journey <name:urls>", "Critical journey, for example Checkout:http://localhost/cart,http://localhost/checkout", collect, [])
    .option("--third-party <name:url>", "Third-party embed or service to review manually", collect, [])
    .option("--exclude <area:reason>", "Intentionally excluded area with reason", collect, [])
    .option("--note <text>", "Additional scope note", collect, [])
    .action(async (options: ScopeInitOptions) => {
      const cwd = path.resolve(options.cwd || process.cwd());
      const outputPath = path.resolve(cwd, options.out || DEFAULT_SCOPE_FILE);
      if (!options.force && await exists(outputPath)) {
        throw new Error(`Scope file already exists: ${outputPath}. Use --force to overwrite it.`);
      }

      const scopePlan = createScopePlan({
        productName: options.productName,
        productType: options.productType,
        standard: toComplianceStandard(options.standard),
        urls: options.url,
        languages: options.language,
        supportedPlatforms: options.platform,
        assistiveTechnologies: options.assistiveTech,
        representativeSample: (options.samplePage || []).map(parseSamplePage),
        randomSample: (options.randomSamplePage || []).map(parseSamplePage),
        criticalJourneys: (options.journey || []).map(parseJourney),
        thirdPartyContent: (options.thirdParty || []).map(parseThirdPartyContent),
        exclusions: (options.exclude || []).map(parseExclusion),
        notes: options.note
      });

      await writeScopePlan(outputPath, scopePlan);
      console.log(`Created ${outputPath}`);
      console.log(`Scope: ${scopePlan.product.type}, ${scopePlan.target.standard}, ${scopePlan.target.urls.length} URL${scopePlan.target.urls.length === 1 ? "" : "s"}, ${scopePlan.representativeSample.length} sample page${scopePlan.representativeSample.length === 1 ? "" : "s"}, ${scopePlan.randomSample.length} random sample page${scopePlan.randomSample.length === 1 ? "" : "s"}, ${scopePlan.criticalJourneys.length} journey${scopePlan.criticalJourneys.length === 1 ? "" : "s"}.`);
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
