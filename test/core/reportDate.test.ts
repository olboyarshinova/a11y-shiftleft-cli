import test from "node:test";
import assert from "node:assert/strict";
import { formatReportDateUtc } from "../../dist/core/reportDate.js";

test("formatReportDateUtc renders a readable deterministic timestamp", () => {
  assert.equal(
    formatReportDateUtc("2026-06-15T15:01:16.934Z"),
    "15 June 2026, 15:01 UTC"
  );
});

test("formatReportDateUtc preserves invalid input", () => {
  assert.equal(formatReportDateUtc("unknown"), "unknown");
});
