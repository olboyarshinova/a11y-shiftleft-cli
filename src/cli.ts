import { createRequire } from "node:module";
import { Command } from "commander";
import { registerAdapterCommand } from "./commands/adapter.js";
import { registerAuthCommand } from "./commands/auth.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerCheckCommand } from "./commands/check.js";
import { registerCiCommand } from "./commands/ci.js";
import { registerDashboardCommand } from "./commands/dashboard.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerEvidenceCommand } from "./commands/evidence.js";
import { registerExploreCommand } from "./commands/explore.js";
import { registerInitCommand } from "./commands/init.js";
import { registerKeyboardCommand } from "./commands/keyboard.js";
import { registerRemediationCommand } from "./commands/remediation.js";
import { registerScreenReaderCommand } from "./commands/screenReader.js";
import { registerShareCommand } from "./commands/share.js";
import { registerScopeCommand } from "./commands/scope.js";
import { registerTicketCommand } from "./commands/ticket.js";
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
  registerAuthCommand(program);
  registerAuditCommand(program);
  registerCheckCommand(program);
  registerCiCommand(program);
  registerDoctorCommand(program);
  registerEvidenceCommand(program);
  registerAdapterCommand(program);
  registerExploreCommand(program);
  registerKeyboardCommand(program);
  registerRemediationCommand(program);
  registerScreenReaderCommand(program);
  registerShareCommand(program);
  registerScopeCommand(program);
  registerDashboardCommand(program);
  registerWatchCommand(program);
  registerTicketCommand(program);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}
