import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeRows, writeAnalysis } from "../../scripts/analyze-metrics.js";

test("analyzeRows compares baseline and intervention metrics", () => {
  const analysis = analyzeRows([
    {
      framework: "react",
      phase: "baseline",
      violations_raw: 8,
      violations_unique: 8,
      duplicates_removed: 0,
      duplicate_rate: 0,
      time_to_fix_hours: 24,
      false_positive_count: 2,
      dx_score: 2
    },
    {
      framework: "vue",
      phase: "baseline",
      violations_raw: 6,
      violations_unique: 6,
      duplicates_removed: 0,
      duplicate_rate: 0,
      time_to_fix_hours: 18,
      false_positive_count: 1,
      dx_score: 3
    },
    {
      framework: "react",
      phase: "intervention",
      violations_raw: 6,
      violations_unique: 3,
      duplicates_removed: 3,
      duplicate_rate: 0.5,
      time_to_fix_hours: 8,
      false_positive_count: 0,
      dx_score: 4
    },
    {
      framework: "vue",
      phase: "intervention",
      violations_raw: 5,
      violations_unique: 3,
      duplicates_removed: 2,
      duplicate_rate: 0.4,
      time_to_fix_hours: 10,
      false_positive_count: 1,
      dx_score: 5
    }
  ]);

  assert.equal(analysis.rowCount, 4);
  assert.deepEqual(analysis.phases, { baseline: 2, intervention: 2 });
  assert.equal(analysis.comparisons.violations_unique.baseline.mean, 7);
  assert.equal(analysis.comparisons.violations_unique.intervention.mean, 3);
  assert.equal(analysis.comparisons.violations_unique.percentChange, -0.5714);
  assert.equal(analysis.comparisons.dx_score.percentChange, 0.8);
});

test("writeAnalysis writes JSON output", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-analysis-"));
  const outputPath = path.join(outputDir, "summary.json");

  await writeAnalysis(outputPath, {
    rowCount: 1,
    phases: {
      baseline: 1,
      intervention: 0
    }
  });

  const content = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.equal(content.rowCount, 1);
  assert.equal(content.phases.baseline, 1);
});
