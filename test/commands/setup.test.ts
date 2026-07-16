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
  assert.equal(flags.includes("--git-hooks"), true);
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
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /npx a11y-shiftleft-cli check --dynamic --changed-since origin\/\$\{\{ github\.base_ref \}\} --url http:\/\/localhost:5173/);
  assert.match(workflow, /--gate report-only/);
  assert.match(workflow, /npm run dev -- --host localhost --port 5173/);
  assert.ok(result.created.includes(".a11y-shiftleft.json"));
  assert.ok(result.created.includes(".github/workflows/a11y.yml"));
  assert.ok(result.updated.some((item) => item.startsWith(".gitignore")));
  assert.ok(result.updated.some((item) => item.startsWith("package.json")));
  assert.equal(result.created.some((item) => item.includes(os.homedir())), false);
  assert.equal(result.updated.some((item) => item.includes(os.homedir())), false);
  assert.match(result.nextSteps.join("\n"), /npm run a11y:audit/);
  assert.match(result.nextSteps.join("\n"), /doctor --url http:\/\/localhost:5173/);
  assert.match(result.nextSteps.join("\n"), /CI starts in report-only mode/);
  assert.match(result.nextSteps.join("\n"), /--gate new-critical-only/);
});

test("runSetup omits CI rollout guidance when CI generation is skipped", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-setup-no-ci-"));

  const result = await runSetup({
    cwd,
    url: ["http://localhost:5173"],
    startCommand: "npm run dev",
    ci: "github",
    profile: "pr",
    gate: "report-only",
    failOn: "critical",
    standard: "wcag22-aa",
    skipCi: true,
    skipScripts: true
  });

  const steps = result.nextSteps.join("\n");
  assert.match(steps, /Run a visual audit: npx a11y-shiftleft-cli audit --url http:\/\/localhost:5173 --out reports --open/);
  assert.doesNotMatch(steps, /CI starts in report-only mode/);
});

test("runSetup keeps generated npm check script aligned with the requested gate", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-setup-gate-"));
  await fs.writeFile(path.join(cwd, "package.json"), JSON.stringify({
    scripts: {
      dev: "vite"
    }
  }, null, 2));

  const result = await runSetup({
    cwd,
    url: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host localhost --port 5173",
    ci: "none",
    profile: "pr",
    gate: "new-critical-only",
    failOn: "critical",
    standard: "wcag22-aa",
    skipCi: true
  });

  const manifest = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.equal(manifest.scripts["a11y:check"], "a11y-shiftleft check --dynamic --url http://localhost:5173 --out reports --gate new-critical-only");
  assert.match(result.nextSteps.join("\n"), /npm run a11y:audit/);
});

test("runSetup can create a GitLab CI workflow", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-setup-gitlab-"));
  await fs.writeFile(path.join(cwd, "package.json"), JSON.stringify({
    scripts: {
      dev: "vite"
    }
  }, null, 2));

  const result = await runSetup({
    cwd,
    url: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    ci: "gitlab",
    profile: "pr",
    gate: "report-only",
    failOn: "critical",
    standard: "wcag22-aa"
  });

  const workflow = await fs.readFile(path.join(cwd, ".gitlab-ci.yml"), "utf8");

  assert.match(workflow, /image: mcr\.microsoft\.com\/playwright:v1\.49\.1-jammy/);
  assert.match(workflow, /npx a11y-shiftleft-cli check --dynamic --url http:\/\/localhost:5173/);
  assert.match(workflow, /--gate report-only/);
  assert.ok(result.created.includes(".gitlab-ci.yml"));
  assert.equal(result.created.some((item) => item.includes(os.homedir())), false);
});

test("runSetup can create a CircleCI workflow", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-setup-circleci-"));
  await fs.writeFile(path.join(cwd, "package.json"), JSON.stringify({
    scripts: {
      dev: "vite"
    }
  }, null, 2));

  const result = await runSetup({
    cwd,
    url: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    ci: "circleci",
    profile: "pr",
    gate: "report-only",
    failOn: "critical",
    standard: "wcag22-aa"
  });

  const workflow = await fs.readFile(path.join(cwd, ".circleci/config.yml"), "utf8");

  assert.match(workflow, /version: 2\.1/);
  assert.match(workflow, /store_artifacts:/);
  assert.match(workflow, /npx a11y-shiftleft-cli check --dynamic --url http:\/\/localhost:5173/);
  assert.ok(result.created.includes(".circleci/config.yml"));
  assert.equal(result.created.some((item) => item.includes(os.homedir())), false);
});

test("runSetup can create a portable shell CI script", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-setup-shell-"));
  await fs.writeFile(path.join(cwd, "package.json"), JSON.stringify({
    scripts: {
      dev: "vite"
    }
  }, null, 2));

  const result = await runSetup({
    cwd,
    url: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    ci: "shell",
    profile: "pr",
    gate: "report-only",
    failOn: "critical",
    standard: "wcag22-aa"
  });

  const scriptPath = path.join(cwd, "scripts/a11y-ci.sh");
  const script = await fs.readFile(scriptPath, "utf8");
  const stat = await fs.stat(scriptPath);

  assert.match(script, /^#!\/usr\/bin\/env bash/);
  assert.match(script, /npx a11y-shiftleft-cli check --dynamic --url http:\/\/localhost:5173/);
  assert.equal((stat.mode & 0o111) !== 0, true);
  assert.ok(result.created.includes("scripts/a11y-ci.sh"));
  assert.equal(result.created.some((item) => item.includes(os.homedir())), false);
});

test("runSetup can create an optional Husky pre-commit hook", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-setup-husky-"));

  const result = await runSetup({
    cwd,
    url: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host localhost --port 5173",
    ci: "none",
    profile: "pr",
    gate: "report-only",
    failOn: "critical",
    standard: "wcag22-aa",
    gitHooks: "husky",
    skipCi: true,
    skipScripts: true
  });

  const hookPath = path.join(cwd, ".husky/pre-commit");
  const hook = await fs.readFile(hookPath, "utf8");
  const stat = await fs.stat(hookPath);

  assert.match(hook, /^#!\/usr\/bin\/env sh/);
  assert.match(hook, /npx a11y-shiftleft-cli check --static --staged --out reports --gate report-only/);
  assert.equal((stat.mode & 0o111) !== 0, true);
  assert.ok(result.created.includes(".husky/pre-commit"));
  assert.match(result.nextSteps.join("\n"), /npm install --save-dev husky/);
  assert.match(result.nextSteps.join("\n"), /npm run prepare/);
});

test("runSetup can create an optional Lefthook pre-commit hook", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-setup-lefthook-"));

  const result = await runSetup({
    cwd,
    url: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host localhost --port 5173",
    ci: "none",
    profile: "pr",
    gate: "new-critical-only",
    failOn: "critical",
    standard: "wcag22-aa",
    gitHooks: "lefthook",
    skipCi: true,
    skipScripts: true
  });

  const config = await fs.readFile(path.join(cwd, "lefthook.yml"), "utf8");

  assert.match(config, /pre-commit:/);
  assert.match(config, /a11y-static:/);
  assert.match(config, /npx a11y-shiftleft-cli check --static --staged --out reports --gate new-critical-only/);
  assert.ok(result.created.includes("lefthook.yml"));
  assert.match(result.nextSteps.join("\n"), /npm install --save-dev lefthook/);
  assert.match(result.nextSteps.join("\n"), /npx lefthook install/);
});
