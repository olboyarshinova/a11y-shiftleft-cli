import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeReports } from "../../dist/reporters/writeReports.js";

test("writeReports writes JSON, CSV, and Markdown metrics", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-"));

  const report = await writeReports(
    outputDir,
    [
      {
        source: "axe",
        severity: "critical",
        ruleId: "button-name",
        wcag: ["4.1.2"],
        wcagCriteria: [{
          id: "4.1.2",
          title: "Name, Role, Value",
          level: "A",
          principle: "robust",
          introducedIn: "2.0",
          url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
        }],
        selector: ".icon-button",
        message: "Buttons must have discernible text"
      },
      {
        source: "eslint",
        severity: "warning",
        ruleId: "jsx-a11y/alt-text",
        wcag: ["1.1.1"],
        wcagCriteria: [{
          id: "1.1.1",
          title: "Non-text Content",
          level: "A",
          principle: "perceivable",
          introducedIn: "2.0",
          url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html"
        }],
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
      urls: ["http://localhost:3000"]
    }
  );

  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.duplicateRate, 0.5);
  assert.deepEqual(report.summary.bySource, {
    axe: 1,
    eslint: 1
  });
  assert.deepEqual(report.summary.byPour, {
    robust: 1,
    perceivable: 1
  });
  assert.deepEqual(report.summary.byWcagVersion, {
    "2.0": 2
  });

  const json = JSON.parse(
    await fs.readFile(path.join(outputDir, "a11y-report.json"), "utf8")
  );
  const csv = await fs.readFile(path.join(outputDir, "a11y-metrics.csv"), "utf8");
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.equal(json.summary.framework, "react");
  assert.match(csv, /duplicateRate,0\.5/);
  assert.match(csv, /bySource\.axe,1/);
  assert.match(csv, /byPour\.robust,1/);
  assert.match(csv, /byWcagVersion\.2\.0,2/);
  assert.match(markdown, /Scan duration \| 123ms/);
  assert.match(markdown, /WCAG versions \| 2\.0: 2/);
  assert.match(markdown, /WCAG 4\.1\.2 Name, Role, Value, Level A/);
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

test("writeReports can generate a semi-automated manual checklist", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-semi-auto-"));

  await writeReports(
    outputDir,
    [],
    {
      framework: "react",
      urls: ["http://localhost:3000"],
      rawCount: 0,
      uniqueCount: 0,
      duplicateCount: 0
    },
    {
      formats: ["json"],
      semiAuto: true
    }
  );

  const checklist = await fs.readFile(
    path.join(outputDir, "a11y-manual-checklist.md"),
    "utf8"
  );

  assert.match(checklist, /Semi-Automated Accessibility Review Checklist/);
  assert.match(checklist, /Framework: react/);
  assert.match(checklist, /Screen reader smoke test/);
});

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
