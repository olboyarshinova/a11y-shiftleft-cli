import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("package exposes short and package-name CLI aliases", async () => {
  const manifest = JSON.parse(await fs.readFile("package.json", "utf8"));

  assert.equal(manifest.bin["a11y-shiftleft"], "bin/cli.js");
  assert.equal(manifest.bin["a11y-shiftleft-cli"], "bin/cli.js");
});
