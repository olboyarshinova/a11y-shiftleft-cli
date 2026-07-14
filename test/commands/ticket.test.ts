import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";

test("ticket export exposes dry-run tracker guardrails", () => {
  const ticket = createProgram().commands.find((item) => item.name() === "ticket");
  const exportCommand = ticket?.commands.find((item) => item.name() === "export");

  assert.ok(exportCommand);
  const flags = exportCommand.options.map((option) => option.long);
  assert.equal(flags.includes("--format"), true);
  assert.equal(flags.includes("--tracker"), true);
  assert.equal(flags.includes("--known-tickets"), true);
  assert.equal(flags.includes("--skip-known"), true);
  assert.equal(flags.includes("--create"), true);

  const createOption = exportCommand.options.find((option) => option.long === "--create");
  assert.match(createOption?.description || "", /future explicit tracker create mode/);
  assert.match(createOption?.description || "", /blocked for safety/);
});
