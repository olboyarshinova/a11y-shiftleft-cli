import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";

test("audit is the unified visual report command with optional extra formats", () => {
  const audit = createProgram().commands.find((command) => command.name() === "audit");

  assert.ok(audit);
  assert.match(audit.description(), /one visual accessibility report/);
  assert.deepEqual(audit.aliases(), ["quick"]);
  const flags = audit.options.map((option) => option.long);
  assert.equal(flags.includes("--url"), true);
  assert.equal(flags.includes("--with-lighthouse"), true);
  assert.equal(flags.includes("--excel"), true);
  assert.equal(flags.includes("--pdf"), true);
  assert.equal(flags.includes("--raw"), true);
  assert.equal(flags.includes("--open"), true);
  assert.equal(flags.includes("--no-keyboard"), true);
  assert.equal(flags.includes("--no-manual-review"), true);
  assert.equal(flags.includes("--wait-ms"), true);
  assert.equal(flags.includes("--wait-for-selector"), true);
  assert.equal(flags.includes("--no-scroll"), true);
  assert.equal(flags.includes("--screenshot-full-page"), true);
  assert.equal(flags.includes("--wcag-only"), true);
});
