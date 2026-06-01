import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeReports } from "../../src/reporters/writeReports.js";

test("writeReports writes JSON, CSV, and Markdown metrics", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-"));

  const report = await writeReports(
    outputDir,
    [
      {
        source: "axe",
        severity: "critical",
        ruleId: "button-name",
        selector: ".icon-button",
        message: "Buttons must have discernible text"
      },
      {
        source: "eslint",
        severity: "warning",
        ruleId: "jsx-a11y/alt-text",
        file: "src/App.jsx",
        message: "Image elements must have alternate text"
      }
    ],
    {
      framework: "react",
      rawCount: 4,
      uniqueCount: 2,
      duplicateCount: 2,
      scanDurationMs: 123,
      urls: ["http://127.0.0.1:3000"]
    }
  );

  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.duplicateRate, 0.5);
  assert.deepEqual(report.summary.bySource, {
    axe: 1,
    eslint: 1
  });

  const json = JSON.parse(
    await fs.readFile(path.join(outputDir, "a11y-report.json"), "utf8")
  );
  const csv = await fs.readFile(path.join(outputDir, "a11y-metrics.csv"), "utf8");
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.equal(json.summary.framework, "react");
  assert.match(csv, /duplicateRate,0\.5/);
  assert.match(csv, /bySource\.axe,1/);
  assert.match(markdown, /Scan duration \| 123ms/);
});

test("writeReports can limit output formats", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-format-"));

  await writeReports(
    outputDir,
    [],
    {
      rawCount: 0,
      uniqueCount: 0,
      duplicateCount: 0
    },
    {
      formats: ["json"]
    }
  );

  assert.equal(await exists(path.join(outputDir, "a11y-report.json")), true);
  assert.equal(await exists(path.join(outputDir, "a11y-metrics.csv")), false);
  assert.equal(await exists(path.join(outputDir, "a11y-comment.md")), false);
});

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
