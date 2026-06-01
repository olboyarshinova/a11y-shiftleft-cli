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
