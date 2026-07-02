import test from "node:test";
import assert from "node:assert/strict";
import { formatCliError } from "../../dist/core/friendlyErrors.js";

test("formatCliError gives Playwright install guidance when Chromium is missing", () => {
  const output = formatCliError(new Error("browserType.launch: Executable doesn't exist at /chromium"), [
    "node",
    "bin/cli.js",
    "audit",
    "--url",
    "http://localhost:5173"
  ]);

  assert.match(output, /Chromium is missing/);
  assert.match(output, /npx playwright install chromium/);
  assert.doesNotMatch(output, /browserType\.launch/);
});

test("formatCliError gives local app guidance when the URL cannot be reached", () => {
  const output = formatCliError(new Error("page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173"), [
    "node",
    "bin/cli.js",
    "audit",
    "--url",
    "http://localhost:5173"
  ]);

  assert.match(output, /Could not open http:\/\/localhost:5173/);
  assert.match(output, /npm run dev/);
  assert.match(output, /doctor --url http:\/\/localhost:5173/);
});

test("formatCliError preserves unknown stack traces", () => {
  const error = new Error("Unexpected failure");
  const output = formatCliError(error, ["node", "bin/cli.js"]);

  assert.match(output, /Unexpected failure/);
  assert.match(output, /Error:/);
});

test("formatCliError does not treat browser permission failures as missing Chromium", () => {
  const output = formatCliError(new Error("browserType.launch: Target page closed: Permission denied"), [
    "node",
    "bin/cli.js",
    "audit",
    "--url",
    "http://localhost:5173"
  ]);

  assert.match(output, /Permission denied/);
  assert.doesNotMatch(output, /Chromium is missing/);
});
