import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { addReportEntriesToGitignore, createInitialConfig, toFramework } from "./init.js";
import { toCiProfile, workflowFiles } from "./ci.js";

interface SetupOptions {
  cwd?: string;
  url: string[];
  startCommand: string;
  framework?: string;
  ci: string;
  profile: string;
  gate: string;
  failOn: string;
  standard: string;
  force?: boolean;
  skipConfig?: boolean;
  skipGitignore?: boolean;
  skipCi?: boolean;
  skipScripts?: boolean;
}

interface SetupResult {
  created: string[];
  skipped: string[];
  updated: string[];
  nextSteps: string[];
}

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Create config, .gitignore entries, and CI workflow for a first accessibility audit.")
    .option("--cwd <dir>", "Target project directory")
    .option("--url <urls...>", "URL(s) to scan", ["http://localhost:3000"])
    .option("--start-command <command>", "Command that starts the app in CI", "npm run dev -- --host localhost --port 3000")
    .option("--framework <name>", "Target framework: auto, react, vue, angular, or unknown")
    .option("--ci <provider>", "CI provider: github or none", "github")
    .option("--profile <profile>", "CI profile: pr, full, or split", "pr")
    .option("--gate <profile>", "CI quality gate: report-only, critical, warning, or new-critical-only", "report-only")
    .option("--fail-on <severity>", "Fallback severity gate when --gate is not set", "critical")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, section508, or en301549", "wcag22-aa")
    .option("--force", "Overwrite existing generated config and workflow files")
    .option("--skip-config", "Do not create .a11y-shiftleft.json")
    .option("--skip-gitignore", "Do not update .gitignore")
    .option("--skip-ci", "Do not generate CI workflow files")
    .option("--skip-scripts", "Do not add a11y npm scripts to package.json")
    .action(async (options: SetupOptions) => {
      const result = await runSetup(options);

      for (const item of result.created) console.log(`Created ${item}`);
      for (const item of result.updated) console.log(`Updated ${item}`);
      for (const item of result.skipped) console.log(`Skipped ${item}`);

      console.log("\nNext steps:");
      for (const [index, step] of result.nextSteps.entries()) {
        console.log(`${index + 1}. ${step}`);
      }
    });
}

export async function runSetup(options: SetupOptions): Promise<SetupResult> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const urls = parseUrls(options.url);
  const scanUrls = urls.length > 0 ? urls : ["http://localhost:3000"];
  const created: string[] = [];
  const skipped: string[] = [];
  const updated: string[] = [];

  if (!options.skipConfig) {
    const configPath = path.join(cwd, ".a11y-shiftleft.json");
    if (!options.force && await exists(configPath)) {
      skipped.push(`${configPath} already exists`);
    } else {
      await fs.mkdir(cwd, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(createInitialConfig(toFramework(options.framework)), null, 2));
      created.push(configPath);
    }
  }

  if (!options.skipGitignore) {
    const gitignore = await addReportEntriesToGitignore(cwd);
    if (gitignore.added.length > 0) {
      updated.push(`${gitignore.path} (${gitignore.added.join(", ")})`);
    } else {
      skipped.push(`${gitignore.path} already ignores generated a11y artifacts`);
    }
  }

  if (!options.skipScripts) {
    const scripts = await addPackageScripts(cwd, scanUrls[0], options.force);
    if (scripts.status === "updated") {
      updated.push(`${scripts.path} (${scripts.added.join(", ")})`);
    } else if (scripts.status === "missing") {
      skipped.push(`${scripts.path} not found`);
    } else {
      skipped.push(`${scripts.path} already has a11y npm scripts`);
    }
  }

  if (!options.skipCi && options.ci !== "none") {
    if (options.ci !== "github") {
      throw new Error(`Unsupported setup CI provider: ${options.ci}`);
    }

    const workflowDir = path.join(cwd, ".github/workflows");
    const workflows = workflowFiles({
      profile: toCiProfile(options.profile),
      urls: scanUrls,
      startCommand: options.startCommand,
      failOn: options.failOn,
      gate: options.gate,
      fullFailOn: "none",
      standard: options.standard,
      crawlDepth: 1,
      crawlLimit: 10,
      fullCrawlDepth: 3,
      fullCrawlLimit: 100,
      fullSchedule: "0 7 * * 1"
    });

    await fs.mkdir(workflowDir, { recursive: true });

    for (const workflow of workflows) {
      const target = path.join(workflowDir, workflow.fileName);
      if (!options.force && await exists(target)) {
        skipped.push(`${target} already exists`);
        continue;
      }
      await fs.writeFile(target, workflow.contents);
      created.push(target);
    }
  }

  return {
    created,
    skipped,
    updated,
    nextSteps: [
      `Start your app locally: ${options.startCommand}`,
      options.skipScripts
        ? `Run a visual audit: npx a11y-shiftleft-cli audit --url ${scanUrls[0]} --out reports --open`
        : "Run a visual audit: npm run a11y:audit",
      "Commit the generated config and workflow files after reviewing them."
    ]
  };
}

type PackageScriptsResult =
  | { status: "updated"; path: string; added: string[] }
  | { status: "unchanged"; path: string; added: string[] }
  | { status: "missing"; path: string; added: string[] };

export async function addPackageScripts(
  cwd: string,
  url: string,
  force = false
): Promise<PackageScriptsResult> {
  const packagePath = path.join(cwd, "package.json");
  const existing = await readTextIfExists(packagePath);
  if (!existing) return { status: "missing", path: packagePath, added: [] };

  const manifest = JSON.parse(existing) as {
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };
  const scripts = manifest.scripts && typeof manifest.scripts === "object"
    ? { ...manifest.scripts }
    : {};
  const desired = {
    "a11y:audit": `a11y-shiftleft audit --url ${url} --out reports --open`,
    "a11y:check": `a11y-shiftleft check --dynamic --url ${url} --out reports --gate report-only`
  };
  const added: string[] = [];

  for (const [name, command] of Object.entries(desired)) {
    if (!force && scripts[name]) continue;
    if (scripts[name] !== command) {
      scripts[name] = command;
      added.push(name);
    }
  }

  if (added.length === 0) {
    return { status: "unchanged", path: packagePath, added };
  }

  manifest.scripts = scripts;
  await fs.writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { status: "updated", path: packagePath, added };
}

function parseUrls(urls?: string[]): string[] {
  if (!urls || urls.length === 0) return [];

  return [...new Set(urls
    .flatMap((url) => url.split(","))
    .map((url) => url.trim())
    .filter(Boolean))];
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return "";
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
