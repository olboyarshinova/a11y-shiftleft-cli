import test from "node:test";
import assert from "node:assert/strict";
import {
  adapterInstallCommand,
  adapterInstallPackagesForFramework,
  adapterPackagesForFramework,
  getAdapterRecommendation,
  listAdapterRecommendations
} from "../../dist/core/frameworkAdapters.js";

test("adapterPackagesForFramework returns static adapter packages", () => {
  assert.deepEqual(adapterPackagesForFramework("react"), ["eslint-plugin-jsx-a11y"]);
  assert.deepEqual(adapterPackagesForFramework("vue"), ["eslint-plugin-vue"]);
  assert.deepEqual(adapterPackagesForFramework("angular"), [
    "@angular-eslint/eslint-plugin-template",
    "@angular-eslint/template-parser"
  ]);
  assert.deepEqual(adapterPackagesForFramework("auto"), []);
});

test("adapterInstallPackagesForFramework returns user-facing packages", () => {
  assert.deepEqual(adapterInstallPackagesForFramework("react"), ["@a11y-shiftleft/react"]);
  assert.deepEqual(adapterInstallPackagesForFramework("vue"), ["@a11y-shiftleft/vue"]);
  assert.deepEqual(adapterInstallPackagesForFramework("angular"), ["@a11y-shiftleft/angular"]);
});

test("getAdapterRecommendation returns framework notes", () => {
  const recommendation = getAdapterRecommendation("react");

  assert.equal(recommendation?.framework, "react");
  assert.match(recommendation?.note || "", /jsx-a11y/);
  assert.equal(getAdapterRecommendation("unknown"), undefined);
});

test("adapterInstallCommand supports common package managers", () => {
  const packages = ["eslint-plugin-jsx-a11y"];

  assert.equal(adapterInstallCommand(packages, "npm"), "npm install --save-dev eslint-plugin-jsx-a11y");
  assert.equal(adapterInstallCommand(packages, "pnpm"), "pnpm add -D eslint-plugin-jsx-a11y");
  assert.equal(adapterInstallCommand(packages, "yarn"), "yarn add -D eslint-plugin-jsx-a11y");
});

test("listAdapterRecommendations includes current framework adapters", () => {
  assert.deepEqual(
    listAdapterRecommendations().map((adapter) => adapter.framework).sort(),
    ["angular", "react", "vue"]
  );
});
