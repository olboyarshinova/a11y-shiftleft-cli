import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";

test("scope init command is registered with guided scope options", () => {
  const scope = createProgram().commands.find((command) => command.name() === "scope");
  const init = scope?.commands.find((command) => command.name() === "init");

  assert.ok(init);
  assert.match(init.description(), /guided a11y-scope\.json/);
  const flags = init.options.map((option) => option.long);
  assert.equal(flags.includes("--product-type"), true);
  assert.equal(flags.includes("--sample-page"), true);
  assert.equal(flags.includes("--random-sample-page"), true);
  assert.equal(flags.includes("--journey"), true);
  assert.equal(flags.includes("--third-party"), true);
  assert.equal(flags.includes("--exclude"), true);
});
