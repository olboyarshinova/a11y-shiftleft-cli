import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import { formatScreenReaderSummary } from "../../dist/commands/screenReader.js";

test("screen-reader command is registered with supported profiles", () => {
  const command = createProgram().commands.find((item) => item.name() === "screen-reader");

  assert.ok(command);
  assert.match(command.description(), /screen-reader smoke-test checklist/);
  const flags = command.options.map((option) => option.long);
  assert.equal(flags.includes("--profile"), true);
  assert.equal(flags.includes("--url"), true);
  assert.equal(flags.includes("--out"), true);
});

test("formatScreenReaderSummary renders generated checklist output", () => {
  assert.equal(
    formatScreenReaderSummary("voiceover", "reports", 4),
    "Created voiceover screen-reader checklist with 4 tasks: reports"
  );
});
