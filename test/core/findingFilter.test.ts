import test from "node:test";
import assert from "node:assert/strict";
import { filterReportFindings } from "../../dist/core/findingFilter.js";

const findings = [
  { findingType: "wcag" as const, id: "mapped" },
  { findingType: "best-practice" as const, id: "guidance" },
  { findingType: "unmapped" as const, id: "review" }
];

test("filterReportFindings preserves every finding by default", () => {
  assert.deepEqual(filterReportFindings(findings), findings);
});

test("filterReportFindings keeps only WCAG findings in wcag-only mode", () => {
  assert.deepEqual(filterReportFindings(findings, { wcagOnly: true }), [findings[0]]);
});
