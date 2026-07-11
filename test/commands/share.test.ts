import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import { formatSharePrepareSummary } from "../../dist/commands/share.js";

test("share prepare command is registered with privacy-first options", () => {
  const share = createProgram().commands.find((command) => command.name() === "share");
  const prepare = share?.commands.find((command) => command.name() === "prepare");

  assert.ok(share);
  assert.ok(prepare);
  assert.match(share.description(), /sanitized local report/);
  assert.match(prepare.description(), /privacy summary/);
  const flags = prepare.options.map((option) => option.long);
  assert.equal(flags.includes("--report"), true);
  assert.equal(flags.includes("--out"), true);
  assert.equal(flags.includes("--include-html"), true);
});

test("formatSharePrepareSummary renders local output", () => {
  assert.equal(
    formatSharePrepareSummary(3, "a11y-share"),
    "Created sanitized local share package with 3 files: a11y-share"
  );
});
