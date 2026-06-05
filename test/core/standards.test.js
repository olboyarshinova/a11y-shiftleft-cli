import test from "node:test";
import assert from "node:assert/strict";
import { resolveStandard } from "../../dist/core/standards.js";

test("resolveStandard maps compliance support presets to WCAG versions", () => {
  assert.equal(resolveStandard("section508").wcagVersion, "2.0");
  assert.equal(resolveStandard("ada-title-ii").wcagVersion, "2.1");
  assert.equal(resolveStandard("wcag22-aa").wcagVersion, "2.2");
});

test("resolveStandard marks automated coverage as partial", () => {
  const standard = resolveStandard("ada-title-ii");

  assert.equal(standard.wcagLevel, "AA");
  assert.equal(standard.automatedCoverage, "partial");
  assert.equal(standard.requiresManualReview, true);
  assert.match(standard.disclaimer, /does not certify legal compliance/);
});
