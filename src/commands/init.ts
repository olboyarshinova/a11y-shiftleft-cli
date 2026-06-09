import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "../config/defaultConfig.js";
import type { A11yConfig, Framework } from "../types.js";

interface InitOptions {
  cwd?: string;
  force?: boolean;
  framework?: string;
  gitignore?: boolean;
}

export const GITIGNORE_REPORT_ENTRIES = [
  "reports/",
  ".a11y-reports/"
];

interface GitignoreUpdateResult {
  path: string;
  added: string[];
  alreadyPresent: string[];
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a default a11y-shiftleft config.")
    .option("--cwd <dir>", "Target project directory")
    .option("--framework <name>", "Target framework: auto, react, vue, angular, or unknown")
    .option("--force", "Overwrite existing config")
    .option("--gitignore", "Add generated accessibility report directories to .gitignore")
    .action(async (options: InitOptions) => {
      const cwd = path.resolve(options.cwd || process.cwd());
      const target = path.join(cwd, ".a11y-shiftleft.json");
      const framework = toFramework(options.framework);

      if (!options.force && await exists(target)) {
        console.log(`${target} already exists. Use --force to overwrite.`);
      } else {
        await fs.mkdir(cwd, { recursive: true });
        await fs.writeFile(target, JSON.stringify(createInitialConfig(framework), null, 2));
        console.log(`Created ${target}`);
      }

      if (options.gitignore) {
        const result = await addReportEntriesToGitignore(cwd);
        const summary = result.added.length > 0
          ? `Added ${result.added.join(", ")} to ${result.path}`
          : `${result.path} already ignores generated report directories.`;

        console.log(summary);
      }
    });
}

export function createInitialConfig(framework: Framework = "auto"): Omit<A11yConfig, "cwd" | "configPath"> {
  return {
    ...defaultConfig,
    framework
  };
}

export function toFramework(framework: string | undefined): Framework {
  if (
    framework === "react" ||
    framework === "vue" ||
    framework === "angular" ||
    framework === "auto" ||
    framework === "unknown"
  ) {
    return framework;
  }

  return "auto";
}

export async function addReportEntriesToGitignore(
  cwd: string,
  entries = GITIGNORE_REPORT_ENTRIES
): Promise<GitignoreUpdateResult> {
  const gitignorePath = path.join(cwd, ".gitignore");
  const existing = await readTextIfExists(gitignorePath);
  const added: string[] = [];
  const alreadyPresent: string[] = [];

  for (const entry of entries) {
    if (hasGitignoreEntry(existing, entry)) {
      alreadyPresent.push(entry);
    } else {
      added.push(entry);
    }
  }

  if (added.length > 0) {
    await fs.mkdir(cwd, { recursive: true });
    await fs.writeFile(gitignorePath, appendGitignoreBlock(existing, added));
  }

  return {
    path: gitignorePath,
    added,
    alreadyPresent
  };
}

function appendGitignoreBlock(existing: string, entries: string[]): string {
  const normalized = existing.length > 0 && !existing.endsWith("\n")
    ? `${existing}\n`
    : existing;
  const prefix = normalized.trim().length > 0 ? "\n" : "";

  return `${normalized}${prefix}# a11y-shiftleft generated reports\n${entries.join("\n")}\n`;
}

function hasGitignoreEntry(content: string, entry: string): boolean {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.includes(entry)) return true;

  return entry === "reports/" && lines.some((line) => (
    line === "reports*" ||
    line === "reports*/" ||
    line === "/reports" ||
    line === "/reports/"
  ));
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return "";
    throw error;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
