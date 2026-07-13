import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProgram } from "../../dist/cli.js";
import { runSetup } from "../../dist/commands/setup.js";

test("setup command is registered as the guided first-run path", () => {
  const command = createProgram().commands.find((item) => item.name() === "setup");

  assert.ok(command);
  assert.match(command.description(), /Create config, \.gitignore entries, and CI workflow/);
  const flags = command.options.map((option) => option.long);
  assert.equal(flags.includes("--url"), true);
  assert.equal(flags.includes("--start-command"), true);
  assert.equal(flags.includes("--gate"), true);
  assert.equal(flags.includes("--skip-ci"), true);
  assert.equal(flags.includes("--skip-scripts"), true);
});

test("runSetup creates config, report ignores, and GitHub Actions workflow", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-setup-"));
  await fs.writeFile(path.join(cwd, "package.json"), JSON.stringify({
    scripts: {
      dev: "vite"
    }
  }, null, 2));

  const result = await runSetup({
    cwd,
    url: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host localhost --port 5173",
    ci: "github",
    profile: "pr",
    gate: "report-only",
    failOn: "critical",
    standard: "wcag22-aa"
  });

  const config = await fs.readFile(path.join(cwd, ".a11y-shiftleft.json"), "utf8");
  const gitignore = await fs.readFile(path.join(cwd, ".gitignore"), "utf8");
  const manifest = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const workflow = await fs.readFile(path.join(cwd, ".github/workflows/a11y.yml"), "utf8");

  assert.match(config, /"framework": "auto"/);
  assert.match(gitignore, /reports\//);
  assert.match(gitignore, /\.a11y-auth\//);
  assert.equal(manifest.scripts.dev, "vite");
  assert.equal(manifest.scripts["a11y:audit"], "a11y-shiftleft audit --url http://localhost:5173 --out reports --open");
  assert.equal(manifest.scripts["a11y:check"], "a11y-shiftleft check --dynamic --url http://localhost:5173 --out reports --gate report-only");
  assert.match(workflow, /npx a11y-shiftleft check --dynamic --url http:\/\/localhost:5173/);
  assert.match(workflow, /--gate report-only/);
  assert.match(workflow, /npm run dev -- --host localhost --port 5173/);
  assert.ok(result.created.some((item) => item.endsWith(".a11y-shiftleft.json")));
  assert.ok(result.updated.some((item) => item.includes(".gitignore")));
  assert.ok(result.updated.some((item) => item.includes("package.json")));
  assert.match(result.nextSteps.join("\n"), /npm run a11y:audit/);
});
