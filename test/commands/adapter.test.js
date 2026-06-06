import test from "node:test";
import assert from "node:assert/strict";
import { formatAdapterInstall, formatAdapterList } from "../../dist/commands/adapter.js";

test("formatAdapterList renders supported adapters", () => {
  const output = formatAdapterList();

  assert.match(output, /react: @a11y-shiftleft\/react/);
  assert.match(output, /vue: eslint-plugin-vue/);
  assert.match(output, /angular:/);
});

test("formatAdapterInstall renders copy-paste commands", () => {
  const output = formatAdapterInstall({
    framework: "react",
    packages: ["eslint-plugin-jsx-a11y"],
    installPackages: ["@a11y-shiftleft/react"],
    packageManager: "npm",
    install: "npm install --save-dev @a11y-shiftleft/react",
    init: "npx a11y-shiftleft init --framework react",
    note: "React static checks use eslint-plugin-jsx-a11y."
  });

  assert.match(output, /Adapter: react/);
  assert.match(output, /npm install --save-dev @a11y-shiftleft\/react/);
  assert.match(output, /npx a11y-shiftleft init --framework react/);
});
