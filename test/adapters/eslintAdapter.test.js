import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runEslintAdapter } from "../../src/adapters/eslintAdapter.js";

test("runEslintAdapter reports React jsx-a11y findings with relative file paths", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-react-static-"));
  await fs.mkdir(path.join(cwd, "src"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, "src", "App.jsx"),
    "export function App() { return <img src=\"chart.svg\" />; }\n"
  );

  const issues = await runEslintAdapter({
    cwd,
    framework: "react",
    static: {
      include: ["src/**/*.{js,jsx,ts,tsx}"]
    }
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "jsx-a11y/alt-text");
  assert.equal(issues[0].file, path.join("src", "App.jsx"));
});

test("runEslintAdapter reports Vue fallback template findings", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-vue-static-"));
  await fs.mkdir(path.join(cwd, "src"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, "src", "App.vue"),
    `<template>
  <button @click="save">Save</button>
  <div v-html="html" />
</template>
<script setup>
const html = "<strong>Status</strong>";
function save() {}
</script>
`
  );

  const issues = await runEslintAdapter({
    cwd,
    framework: "vue",
    static: {
      include: ["src/**/*.vue"]
    }
  });

  assert.deepEqual(
    issues.map((issue) => issue.ruleId).sort(),
    ["vue/html-button-has-type", "vue/no-v-html"]
  );
  assert.equal(issues[0].file, path.join("src", "App.vue"));
});

test("runEslintAdapter reports Angular fallback template findings", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-angular-static-"));
  await fs.mkdir(path.join(cwd, "src", "app"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, "src", "app", "app.component.html"),
    `<main>
  <button (click)="save()">Save</button>
  <img src="/avatar.png">
</main>
`
  );

  const issues = await runEslintAdapter({
    cwd,
    framework: "angular",
    static: {
      include: ["src/**/*.html"]
    }
  });

  assert.deepEqual(
    issues.map((issue) => issue.ruleId).sort(),
    [
      "@angular-eslint/template/alt-text",
      "@angular-eslint/template/button-has-type"
    ]
  );
  assert.equal(issues[0].file, path.join("src", "app", "app.component.html"));
});
