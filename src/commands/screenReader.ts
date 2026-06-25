import type { Command } from "commander";
import { loadConfig } from "../config/loadConfig.js";
import {
  createScreenReaderChecklist,
  toScreenReaderProfile,
  writeScreenReaderChecklist,
  type ScreenReaderProfile
} from "../core/screenReaderChecklist.js";

interface ScreenReaderOptions {
  cwd?: string;
  config?: string;
  profile?: string;
  url?: string[];
  out?: string;
  quiet?: boolean;
}

export function registerScreenReaderCommand(program: Command): void {
  program
    .command("screen-reader")
    .description("Generate a human screen-reader smoke-test checklist.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--profile <name>", "voiceover, nvda, jaws, or talkback", "voiceover")
    .option("--url <url...>", "Target URL or URLs to review")
    .option("--out <dir>", "Output directory")
    .option("--quiet", "Suppress console output")
    .action(async (options: ScreenReaderOptions) => {
      const config = await loadConfig({ cwd: options.cwd, config: options.config }, {
        outputDir: options.out
      });
      const profile = toScreenReaderProfile(options.profile);
      const urls = options.url?.length ? options.url : config.dynamic.urls;
      const checklist = createScreenReaderChecklist({ profile, urls });
      await writeScreenReaderChecklist(config.outputDir, checklist);

      if (!options.quiet) {
        console.log(formatScreenReaderSummary(profile, config.outputDir, checklist.tasks.length));
      }
    });
}

export function formatScreenReaderSummary(profile: ScreenReaderProfile, outputDir: string, taskCount: number): string {
  return `Created ${profile} screen-reader checklist with ${taskCount} tasks: ${outputDir}`;
}
