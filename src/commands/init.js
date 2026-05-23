import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "../config/defaultConfig.js";

export function registerInitCommand(program) {
  program
    .command("init")
    .description("Create a default a11y-shiftleft config.")
    .option("--cwd <dir>", "Target project directory", process.cwd())
    .option("--force", "Overwrite existing config")
    .action(async (options) => {
      const cwd = path.resolve(options.cwd);
      const target = path.join(cwd, ".a11y-shiftleft.json");

      if (!options.force && await exists(target)) {
        console.log(`${target} already exists. Use --force to overwrite.`);
        return;
      }

      await fs.mkdir(cwd, { recursive: true });
      await fs.writeFile(target, JSON.stringify(defaultConfig, null, 2));
      console.log(`Created ${target}`);
    });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
