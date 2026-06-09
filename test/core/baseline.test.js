import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyBaseline,
  createBaselineFile,
  DEFAULT_BASELINE_FILE
} from "../../dist/core/baseline.js";

test("createBaselineFile stores stable issue fingerprints without local paths", () => {
  const baseline = createBaselineFile([
    issue("b", "warning", { file: "src/form.tsx", line: 12 }),
    issue("a", "critical", { url: "http://localhost:3000", selector: "button" })
  ], new Date("2026-01-01T00:00:00.000Z"));

  assert.equal(baseline.version, 1);
  assert.equal(baseline.generatedAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(baseline.issues.map((entry) => entry.fingerprint), ["a", "b"]);
  assert.equal(baseline.issues[0].target, "url=http://localhost:3000|selector=button");
  assert.equal(baseline.issues[1].target, "file=src/form.tsx|line=12");
});

test("applyBaseline creates a missing baseline and treats current issues as existing", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-baseline-"));
  const result = await applyBaseline([
    issue("known-critical", "critical"),
    issue("known-warning", "warning")
  ], { cwd });
  const saved = JSON.parse(await fs.readFile(path.join(cwd, DEFAULT_BASELINE_FILE), "utf8"));

  assert.equal(result.summary.updated, true);
  assert.equal(result.summary.file, DEFAULT_BASELINE_FILE);
  assert.equal(result.summary.newIssues, 0);
  assert.equal(result.summary.existingIssues, 2);
  assert.equal(saved.issues.length, 2);
  assert.deepEqual(result.issues.map((item) => item.baselineStatus), ["existing", "existing"]);
});

test("applyBaseline reports new and resolved issues against an existing baseline", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-baseline-"));
  const baselinePath = path.join(cwd, DEFAULT_BASELINE_FILE);

  await fs.writeFile(
    baselinePath,
    `${JSON.stringify(createBaselineFile([
      issue("known-critical", "critical"),
      issue("resolved-warning", "warning")
    ]), null, 2)}\n`
  );

  const result = await applyBaseline([
    issue("known-critical", "critical"),
    issue("new-warning", "warning"),
    issue("new-info", "info")
  ], { cwd });

  assert.equal(result.summary.updated, false);
  assert.equal(result.summary.baselineIssues, 2);
  assert.equal(result.summary.currentIssues, 3);
  assert.equal(result.summary.existingIssues, 1);
  assert.equal(result.summary.newIssues, 2);
  assert.equal(result.summary.resolvedIssues, 1);
  assert.equal(result.summary.newCritical, 0);
  assert.equal(result.summary.newWarning, 1);
  assert.equal(result.summary.newInfo, 1);
  assert.deepEqual(result.issues.map((item) => item.baselineStatus), ["existing", "new", "new"]);
});

function issue(fingerprint, severity, overrides = {}) {
  return {
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    message: "Button must have an accessible name",
    wcag: ["4.1.2"],
    wcagCriteria: [],
    tags: [],
    severity,
    fingerprint,
    duplicateCount: 0,
    ...overrides
  };
}
