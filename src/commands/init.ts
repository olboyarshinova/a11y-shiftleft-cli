import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "../config/defaultConfig.js";
import type { A11yConfig, Framework } from "../types.js";

interface InitOptions {
  cwd?: string;
  force?: boolean;
  framework?: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a default a11y-shiftleft config.")
    .option("--cwd <dir>", "Target project directory")
    .option("--framework <name>", "Target framework: auto, react, vue, angular, or unknown")
    .option("--force", "Overwrite existing config")
    .action(async (options: InitOptions) => {
      const cwd = path.resolve(options.cwd || process.cwd());
      const target = path.join(cwd, ".a11y-shiftleft.json");
      const framework = toFramework(options.framework);

      if (!options.force && await exists(target)) {
        console.log(`${target} already exists. Use --force to overwrite.`);
        return;
      }

      await fs.mkdir(cwd, { recursive: true });
      await fs.writeFile(target, JSON.stringify(createInitialConfig(framework), null, 2));
      console.log(`Created ${target}`);
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

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
