import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";

test("auth login command is registered with safe manual-login options", () => {
  const auth = createProgram().commands.find((command) => command.name() === "auth");
  const login = auth?.commands.find((command) => command.name() === "login");

  assert.ok(login);
  assert.match(login.description(), /manual login/);
  const flags = login.options.map((option) => option.long);
  assert.equal(flags.includes("--url"), true);
  assert.equal(flags.includes("--out"), true);
  assert.equal(flags.includes("--browser"), true);
  assert.equal(flags.includes("--device"), true);
  assert.equal(flags.includes("--wait-for-url"), true);
  assert.equal(flags.includes("--wait-for-selector"), true);
  assert.equal(flags.includes("--timeout-ms"), true);
  assert.equal(flags.includes("--no-gitignore"), true);
});
