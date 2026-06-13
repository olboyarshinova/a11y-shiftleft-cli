import test from "node:test";
import assert from "node:assert/strict";
import {
  diffWatchSnapshots,
  formatWatchRunSummary,
  summarizeWatchDelta
} from "../../dist/commands/watch.js";

test("diffWatchSnapshots reports added, modified, and deleted files", () => {
  const previous = new Map([
    ["src/a.ts", { mtimeMs: 1, size: 10 }],
    ["src/b.tsx", { mtimeMs: 1, size: 20 }],
    ["src/deleted.vue", { mtimeMs: 1, size: 30 }]
  ]);
  const current = new Map([
    ["src/a.ts", { mtimeMs: 1, size: 10 }],
    ["src/b.tsx", { mtimeMs: 2, size: 20 }],
    ["src/new.html", { mtimeMs: 1, size: 5 }]
  ]);

  assert.deepEqual(diffWatchSnapshots(previous, current), {
    added: ["src/new.html"],
    modified: ["src/b.tsx"],
    deleted: ["src/deleted.vue"]
  });
});

test("summarizeWatchDelta compares run-to-run finding fingerprints", () => {
  const previous = report(["a", "b", "c"], {
    total: 3,
    critical: 1,
    warning: 1,
    info: 1
  });
  const current = report(["b", "c", "d", "e"], {
    total: 4,
    critical: 1,
    warning: 2,
    info: 1
  });

  assert.deepEqual(summarizeWatchDelta(previous, current), {
    firstRun: false,
    newFindings: 2,
    fixedFindings: 1,
    remainingFindings: 4,
    totalDelta: 1,
    criticalDelta: 0,
    warningDelta: 1,
    infoDelta: 0
  });
});

test("formatWatchRunSummary renders concise developer feedback", () => {
  const current = report(["b", "c", "d", "e"], {
    total: 4,
    critical: 1,
    warning: 2,
    info: 1
  });
  const output = formatWatchRunSummary({
    reason: "file changes",
    runCount: 2,
    report: current,
    delta: {
      firstRun: false,
      newFindings: 2,
      fixedFindings: 1,
      remainingFindings: 4,
      totalDelta: 1,
      criticalDelta: 0,
      warningDelta: 1,
      infoDelta: 0
    },
    changes: {
      added: ["src/new.html"],
      modified: ["src/app.tsx"],
      deleted: []
    },
    outputDir: "reports/watch",
    durationMs: 25,
    verbose: true
  });

  assert.match(output, /a11y-shiftleft watch run 2/);
  assert.match(output, /Reason: file changes/);
  assert.match(output, /Changed files: 2/);
  assert.match(output, /Findings: total 4 \| critical 1 \| warning 2 \| info 1/);
  assert.match(output, /Delta: fixed 1, new 2, remaining 4, total delta \+1/);
  assert.match(output, /Reports: reports\/watch\/a11y-comment.md/);
  assert.match(output, /modified src\/app.tsx/);
});

function report(fingerprints, counts) {
  return {
    generatedAt: "2026-06-12T00:00:00.000Z",
    summary: {
      ...counts,
      rawCount: counts.total,
      uniqueCount: counts.total,
      duplicateCount: 0,
      duplicateRate: 0,
      scanDurationMs: 10,
      framework: "react",
      urls: [],
      complianceEvidence: {
        automatedCoverage: "partial",
        requiresManualReview: true,
        totalFindings: counts.total,
        wcagMappedFindings: 0,
        unmappedFindings: counts.total,
        affectedPages: 0,
        topAffectedPages: []
      },
      bySource: {},
      bySeverity: {},
      byConfidence: {},
      byCategory: {},
      byPour: {},
      byWcagLevel: {},
      byWcagVersion: {},
      byUnmappedRule: {},
      byPage: []
    },
    issues: fingerprints.map((fingerprint) => ({
      fingerprint,
      ruleId: "demo",
      severity: "warning",
      source: "test",
      framework: "react",
      message: "demo",
      wcag: [],
      wcagCriteria: [],
      tags: [],
      confidence: "medium",
      confidenceScore: 0.6,
      confidenceReason: "test",
      category: "other",
      duplicateCount: 0
    }))
  };
}
