import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import { readRequiredEnvSecret, runAuthScriptedLogin } from "../../dist/commands/auth.js";

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

test("auth scripted-login command is registered with CI-safe secret options", () => {
  const auth = createProgram().commands.find((command) => command.name() === "auth");
  const login = auth?.commands.find((command) => command.name() === "scripted-login");

  assert.ok(login);
  assert.match(login.description(), /environment variables/);
  const flags = login.options.map((option) => option.long);
  assert.equal(flags.includes("--url"), true);
  assert.equal(flags.includes("--username-selector"), true);
  assert.equal(flags.includes("--password-selector"), true);
  assert.equal(flags.includes("--submit-selector"), true);
  assert.equal(flags.includes("--username-env"), true);
  assert.equal(flags.includes("--password-env"), true);
  assert.equal(flags.includes("--wait-for-url"), true);
  assert.equal(flags.includes("--wait-for-selector"), true);
  assert.equal(flags.includes("--headed"), true);
  assert.equal(flags.includes("--no-gitignore"), true);
});

test("readRequiredEnvSecret reads CI secrets without exposing values in errors", () => {
  const previous = process.env.A11Y_TEST_SECRET;
  process.env.A11Y_TEST_SECRET = "private-value";

  try {
    assert.equal(readRequiredEnvSecret("A11Y_TEST_SECRET", "password"), "private-value");
  } finally {
    if (previous === undefined) {
      delete process.env.A11Y_TEST_SECRET;
    } else {
      process.env.A11Y_TEST_SECRET = previous;
    }
  }

  assert.throws(
    () => readRequiredEnvSecret("A11Y_MISSING_SECRET", "username"),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /A11Y_MISSING_SECRET/);
      assert.doesNotMatch(error.message, /private-value/);
      return true;
    }
  );
});

test("runAuthScriptedLogin requires an explicit login completion signal", async () => {
  await assert.rejects(
    () => runAuthScriptedLogin({
      url: "https://example.com/login",
      usernameSelector: "input[name='email']",
      passwordSelector: "input[name='password']",
      submitSelector: "button[type='submit']",
      usernameEnv: "A11Y_USERNAME",
      passwordEnv: "A11Y_PASSWORD"
    }),
    /requires --wait-for-url or --wait-for-selector/
  );
});
