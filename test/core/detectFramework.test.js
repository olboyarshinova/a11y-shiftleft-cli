import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { detectFramework } from "../../src/core/detectFramework.js";

test("detectFramework detects React projects", async () => {
  const cwd = await createProject({
    dependencies: {
      react: "^19.0.0"
    }
  });

  assert.equal(await detectFramework(cwd), "react");
});

test("detectFramework prefers Angular when Angular dependencies exist", async () => {
  const cwd = await createProject({
    dependencies: {
      react: "^19.0.0",
      "@angular/core": "^19.0.0"
    }
  });

  assert.equal(await detectFramework(cwd), "angular");
});

test("detectFramework returns unknown without package metadata", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-framework-empty-"));

  assert.equal(await detectFramework(cwd), "unknown");
});

async function createProject(packageJson) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-framework-"));
  await fs.writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  return cwd;
}
