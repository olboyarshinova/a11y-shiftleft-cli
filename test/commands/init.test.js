import test from "node:test";
import assert from "node:assert/strict";
import { createInitialConfig, toFramework } from "../../dist/commands/init.js";

test("createInitialConfig writes selected framework", () => {
  const config = createInitialConfig("angular");

  assert.equal(config.framework, "angular");
  assert.equal(config.standard, "wcag22-aa");
  assert.equal(config.dynamic.urls[0], "http://localhost:3000");
});

test("toFramework accepts supported frameworks and defaults to auto", () => {
  assert.equal(toFramework("react"), "react");
  assert.equal(toFramework("vue"), "vue");
  assert.equal(toFramework("angular"), "angular");
  assert.equal(toFramework("unknown-framework"), "auto");
  assert.equal(toFramework(undefined), "auto");
});
