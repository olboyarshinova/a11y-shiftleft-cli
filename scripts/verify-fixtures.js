import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const fixtures = [
  {
    name: "react",
    framework: "react",
    include: "src/**/*.{js,jsx,ts,tsx}",
    expectedRules: ["jsx-a11y/alt-text"]
  },
  {
    name: "vue",
    framework: "vue",
    include: "src/**/*.vue",
    expectedRules: ["vue/html-button-has-type", "vue/no-v-html"]
  },
  {
    name: "angular",
    framework: "angular",
    include: "src/**/*.html",
    expectedRules: [
      "@angular-eslint/template/alt-text",
      "@angular-eslint/template/button-has-type"
    ]
  }
];

for (const fixture of fixtures) {
  const fixtureDir = path.join(repoRoot, "examples", "fixtures", fixture.name);
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), `a11y-${fixture.name}-`));

  await run("node", [
    path.join(repoRoot, "bin", "cli.js"),
    "check",
    "--cwd",
    fixtureDir,
    "--static",
    "--framework",
    fixture.framework,
    "--include",
    fixture.include,
    "--out",
    outputDir,
    "--fail-on",
    "none"
  ]);

  const reportPath = path.join(outputDir, "a11y-report.json");
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const actualRules = new Set(report.issues.map((issue) => issue.ruleId));

  for (const expectedRule of fixture.expectedRules) {
    assert.equal(
      actualRules.has(expectedRule),
      true,
      `${fixture.name} fixture should report ${expectedRule}`
    );
  }

  console.log(`${fixture.name}: ${report.summary.total} findings`);
}
