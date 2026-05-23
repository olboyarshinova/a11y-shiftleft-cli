#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "../src/commands/init.js";
import { registerCheckCommand } from "../src/commands/check.js";
import { registerCiCommand } from "../src/commands/ci.js";

const program = new Command();

program
  .name("a11y-shiftleft")
  .description("Shift-left accessibility validation CLI.")
  .version("0.1.0");

registerInitCommand(program);
registerCheckCommand(program);
registerCiCommand(program);

program.parse();
