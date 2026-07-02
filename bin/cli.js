#!/usr/bin/env node
import { main } from "../dist/cli.js";
import { formatCliError } from "../dist/core/friendlyErrors.js";

main().catch((error) => {
  console.error(formatCliError(error, process.argv));
  process.exitCode = 1;
});
