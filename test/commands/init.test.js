import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  addReportEntriesToGitignore,
  createInitialConfig,
  GITIGNORE_REPORT_ENTRIES,
  toFramework
} from "../../dist/commands/init.js";

test("createInitialConfig writes selected framework", () => {
  const config = createInitialConfig("angular");

  assert.equal(config.framework, "angular");
  assert.equal(config.standard, "wcag22-aa");
  assert.equal(config.dynamic.urls[0], "http://localhost:3000");
});

test("toFramework accepts supported frameworks and defaults to auto", () => {
  assert.equal(toFramework("react"), "react");
  assert.equal(toFramework("vue"), "vue");
  assert.equal(toFramework("angular"), "angular");
  assert.equal(toFramework("unknown-framework"), "auto");
  assert.equal(toFramework(undefined), "auto");
});

test("addReportEntriesToGitignore creates an idempotent report ignore block", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-init-gitignore-"));
  const gitignorePath = path.join(cwd, ".gitignore");

  const first = await addReportEntriesToGitignore(cwd);
  const firstContent = await fs.readFile(gitignorePath, "utf8");
  const second = await addReportEntriesToGitignore(cwd);
  const secondContent = await fs.readFile(gitignorePath, "utf8");

  assert.deepEqual(first.added, GITIGNORE_REPORT_ENTRIES);
  assert.deepEqual(second.added, []);
  assert.deepEqual(second.alreadyPresent, GITIGNORE_REPORT_ENTRIES);
  assert.equal(firstContent, secondContent);
  assert.match(firstContent, /# a11y-shiftleft generated reports/);
  assert.match(firstContent, /^reports\/$/m);
  assert.match(firstContent, /^\.a11y-reports\/$/m);
});

test("addReportEntriesToGitignore preserves existing project ignores", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-init-gitignore-"));
  const gitignorePath = path.join(cwd, ".gitignore");

  await fs.writeFile(gitignorePath, "node_modules/\nreports*/\n");

  const result = await addReportEntriesToGitignore(cwd);
  const content = await fs.readFile(gitignorePath, "utf8");

  assert.deepEqual(result.added, [".a11y-reports/"]);
  assert.deepEqual(result.alreadyPresent, ["reports/"]);
  assert.match(content, /^node_modules\/$/m);
  assert.match(content, /^reports\*\/$/m);
  assert.match(content, /^\.a11y-reports\/$/m);
});
