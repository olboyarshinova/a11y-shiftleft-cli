import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import { normalizeAuditUrl, resolveAuditDepthOption } from "../../dist/commands/audit.js";

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
  assert.equal(flags.includes("--max-depth"), true);
  assert.equal(flags.includes("--no-keyboard"), true);
  assert.equal(flags.includes("--no-manual-review"), true);
  assert.equal(flags.includes("--wait-ms"), true);
  assert.equal(flags.includes("--wait-for-selector"), true);
  assert.equal(flags.includes("--no-scroll"), true);
  assert.equal(flags.includes("--screenshot-full-page"), true);
  assert.equal(flags.includes("--wcag-only"), true);
});

test("resolveAuditDepthOption prefers explicit max depth over legacy depth", () => {
  assert.equal(resolveAuditDepthOption({ depth: "1" }), "1");
  assert.equal(resolveAuditDepthOption({ maxDepth: "3" }), "3");
  assert.equal(resolveAuditDepthOption({ depth: "1", maxDepth: "3" }), "3");
});

test("normalizeAuditUrl trims whitespace and smart quotes", () => {
  assert.equal(normalizeAuditUrl(" https://binaryville.com/ "), "https://binaryville.com/");
  assert.equal(normalizeAuditUrl("“https://binaryville.com/”"), "https://binaryville.com/");
});

test("normalizeAuditUrl rejects non-http URLs", () => {
  assert.throws(
    () => normalizeAuditUrl("file:///tmp/example.html"),
    /Use http:\/\/ or https:\/\//
  );
});
