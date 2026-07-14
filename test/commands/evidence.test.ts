import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProgram } from "../../dist/cli.js";

test("evidence export exposes machine-readable evidence options", () => {
  const evidence = createProgram().commands.find((item) => item.name() === "evidence");
  const exportCommand = evidence?.commands.find((item) => item.name() === "export");

  assert.ok(exportCommand);
  const flags = exportCommand.options.map((option) => option.long);
  assert.equal(flags.includes("--report"), true);
  assert.equal(flags.includes("--out"), true);
  assert.equal(flags.includes("--format"), true);
  assert.match(exportCommand.description(), /machine-readable finding evidence dataset/);
});

test("evidence export writes JSONL records from an accessibility report", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-export-"));
  const reportPath = path.join(root, "a11y-report.json");
  const outputPath = path.join(root, "evidence.jsonl");
  await fs.writeFile(reportPath, JSON.stringify({
    generatedAt: "2026-07-13T00:00:00.000Z",
    summary: {},
    issues: [{
      source: "axe",
      framework: "react",
      ruleId: "button-name",
      wcag: ["4.1.2"],
      wcagCriteria: [],
      tags: [],
      severity: "critical",
      confidence: "high",
      confidenceScore: 95,
      confidenceReason: "Rendered DOM evidence.",
      findingType: "wcag",
      category: "semantics",
      message: "Buttons must have discernible text",
      fingerprint: "button-name::test",
      duplicateCount: 1
    }]
  }));

  await createProgram().parseAsync([
    "node",
    "a11y-shiftleft",
    "evidence",
    "export",
    "--report",
    reportPath,
    "--out",
    outputPath,
    "--format",
    "jsonl"
  ]);

  const lines = (await fs.readFile(outputPath, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).ruleId, "button-name");
});
