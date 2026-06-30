import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createScopePlan,
  DEFAULT_SCOPE_FILE,
  parseExclusion,
  parseJourney,
  parseSamplePage,
  parseThirdPartyContent,
  readScopePlanIfExists,
  writeScopePlan
} from "../../dist/core/scopePlan.js";

test("createScopePlan creates a guided planned audit scope", () => {
  const scope = createScopePlan({
    productName: "Demo Shop",
    productType: "ecommerce",
    standard: "ada-title-ii",
    urls: ["http://localhost:5173", "http://localhost:5173"],
    languages: ["en", "es"],
    representativeSample: [parseSamplePage("Core page:http://localhost:5173|Primary entry point")],
    criticalJourneys: [parseJourney("Checkout:http://localhost/cart,http://localhost/checkout")],
    thirdPartyContent: [parseThirdPartyContent("YouTube:https://youtube.com/embed/demo")],
    exclusions: [parseExclusion("Admin billing:requires production account")]
  });

  assert.equal(scope.version, 1);
  assert.equal(scope.product.name, "Demo Shop");
  assert.equal(scope.product.type, "ecommerce");
  assert.deepEqual(scope.target.urls, ["http://localhost:5173"]);
  assert.equal(scope.target.standard, "ada-title-ii");
  assert.equal(scope.representativeSample[0].type, "Core page");
  assert.equal(scope.representativeSample[0].reason, "Primary entry point");
  assert.equal(scope.criticalJourneys[0].name, "Checkout");
  assert.deepEqual(scope.criticalJourneys[0].urls, ["http://localhost/cart", "http://localhost/checkout"]);
  assert.equal(scope.thirdPartyContent[0].reviewStrategy, "Manual verification recommended");
  assert.equal(scope.exclusions[0].reason, "requires production account");
});

test("readScopePlanIfExists reads and normalizes an optional scope file", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-scope-plan-"));
  const scope = createScopePlan({ productType: "documentation site", urls: ["http://localhost:3000/docs"] });

  assert.equal(await readScopePlanIfExists(cwd), undefined);

  await writeScopePlan(path.join(cwd, DEFAULT_SCOPE_FILE), scope);
  const read = await readScopePlanIfExists(cwd);

  assert.equal(read?.product.type, "documentation site");
  assert.deepEqual(read?.target.urls, ["http://localhost:3000/docs"]);
});
