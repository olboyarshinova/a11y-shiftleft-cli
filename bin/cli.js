#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "commander";
import { registerInitCommand } from "../dist/commands/init.js";
import { registerCheckCommand } from "../dist/commands/check.js";
import { registerCiCommand } from "../dist/commands/ci.js";
import { registerDoctorCommand } from "../dist/commands/doctor.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const program = new Command();

program
  .name("a11y-shiftleft")
  .description("Shift-left accessibility validation CLI.")
  .version(version);

registerInitCommand(program);
registerCheckCommand(program);
registerCiCommand(program);
registerDoctorCommand(program);

program.parse();
