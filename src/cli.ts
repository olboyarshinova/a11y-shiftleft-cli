import { createRequire } from "node:module";
import { Command } from "commander";
import { registerAdapterCommand } from "./commands/adapter.js";
import { registerCheckCommand } from "./commands/check.js";
import { registerCiCommand } from "./commands/ci.js";
import { registerDashboardCommand } from "./commands/dashboard.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerExploreCommand } from "./commands/explore.js";
import { registerInitCommand } from "./commands/init.js";
import { registerWatchCommand } from "./commands/watch.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export function createProgram(): Command {
  const program = new Command();

  program
    .name("a11y-shiftleft")
    .description("Shift-left accessibility validation CLI.")
    .version(version);

  registerInitCommand(program);
  registerCheckCommand(program);
  registerCiCommand(program);
  registerDoctorCommand(program);
  registerAdapterCommand(program);
  registerExploreCommand(program);
  registerDashboardCommand(program);
  registerWatchCommand(program);

  return program;
}

export function main(argv = process.argv): void {
  createProgram().parse(argv);
}
