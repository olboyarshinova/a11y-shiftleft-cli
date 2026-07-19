import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProgram } from "../../dist/cli.js";
import {
  checkGateArgument,
  circleCiWorkflowFiles,
  circleCiWorkflowTemplate,
  formatCiGenerationNextSteps,
  gitLabWorkflowFiles,
  gitLabWorkflowTemplate,
  fullWorkflowTemplate,
  resolveCiAuthFlow,
  shellWorkflowFiles,
  shellWorkflowTemplate,
  toCiProvider,
  toCiProfile,
  workflowFiles,
  workflowTemplate
} from "../../dist/commands/ci.js";

test("generate-ci is the documented command and ci remains a short alias", () => {
  const command = createProgram().commands.find((item) => item.name() === "generate-ci");

  assert.ok(command);
  assert.deepEqual(command.aliases(), ["ci"]);
  assert.match(command.description(), /Generate CI workflow files/);
  const flags = command.options.map((option) => option.long);
  assert.equal(flags.includes("--provider"), true);
  assert.equal(flags.includes("--start-command"), true);
  assert.equal(flags.includes("--auth-login-url"), true);
  assert.equal(flags.includes("--auth-username-selector"), true);
  assert.equal(flags.includes("--auth-password-selector"), true);
  assert.equal(flags.includes("--auth-submit-selector"), true);
});

test("generate-ci CLI prints created files and next steps", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-ci-cli-"));

  const output = await captureConsoleOutput(async () => {
    await createProgram().parseAsync([
      "node",
      "test",
      "generate-ci",
      "--cwd",
      cwd,
      "--url",
      "http://localhost:5173",
      "--start-command",
      "npm run dev -- --host localhost --port 5173",
      "--gate",
      "report-only"
    ]);
  });

  assert.match(output, /Created .*\.github\/workflows\/a11y\.yml/);
  assert.match(output, /Next steps:/);
  assert.match(output, /Review generated workflow file\(s\): \.github\/workflows\/a11y\.yml/);
  assert.match(output, /Open a pull request/);
  assert.match(output, /--gate report-only/);
  assert.match(output, /--gate new-critical-only/);
});

test("workflowTemplate includes compliance standard and multiple URLs", () => {
  const workflow = workflowTemplate({
    urls: [
      "http://localhost:4200",
      "http://localhost:4200/favorites"
    ],
    startCommand: "npm run dev -- --host localhost --port 4200",
    failOn: "warning",
    standard: "section508"
  });

  assert.match(workflow, /curl -fsS http:\/\/localhost:4200/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /Build app if needed/);
  assert.match(workflow, /npm run build --if-present/);
  assert.match(
    workflow,
    /npx a11y-shiftleft-cli check --static --dynamic --changed-since origin\/\$\{\{ github\.base_ref \}\} --url http:\/\/localhost:4200 http:\/\/localhost:4200\/favorites --crawl --crawl-depth 1 --crawl-limit 10 --out reports --fail-on warning --standard section508 --verbose/
  );
});

test("workflowTemplate supports bounded fast PR crawls", () => {
  const workflow = workflowTemplate({
    urls: ["http://localhost:3000"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    failOn: "critical",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 5
  });

  assert.match(workflow, /name: Accessibility PR/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /Build app if needed/);
  assert.match(workflow, /npm run build --if-present/);
  assert.match(workflow, /--crawl --crawl-depth 1 --crawl-limit 5/);
  assert.match(workflow, /--changed-since origin\/\$\{\{ github\.base_ref \}\}/);
  assert.match(workflow, /--standard wcag22-aa --verbose/);
  assert.match(workflow, /id: upload-a11y-report/);
  assert.match(workflow, /REPORT_ARTIFACT_URL: \$\{\{ steps\.upload-a11y-report\.outputs\.artifact-url \}\}/);
  assert.match(workflow, /Comment on PR/);
  assert.match(workflow, /npx a11y-shiftleft-cli pr-comment --report reports --include-labels/);
  assert.doesNotMatch(workflow, /scripts\/post-a11y-comment\.js/);
});

test("workflowTemplate supports quality gate profiles for PR workflows", () => {
  const workflow = workflowTemplate({
    urls: ["http://localhost:3000"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    failOn: "critical",
    gate: "new-critical-only",
    standard: "wcag22-aa"
  });

  assert.match(workflow, /--gate new-critical-only --standard wcag22-aa/);
  assert.doesNotMatch(workflow, /--fail-on critical --standard/);
});

test("workflowTemplate can create CI-safe auth state before browser checks", () => {
  const workflow = workflowTemplate({
    urls: ["http://localhost:3000/dashboard"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    auth: {
      loginUrl: "http://localhost:3000/login",
      usernameSelector: "input[name='email']",
      passwordSelector: "input[name='password']",
      submitSelector: "button[type='submit']",
      waitForUrl: "**/dashboard",
      usernameEnv: "A11Y_USERNAME",
      passwordEnv: "A11Y_PASSWORD"
    }
  });

  assert.match(workflow, /Create authenticated browser state/);
  assert.match(workflow, /auth scripted-login --url 'http:\/\/localhost:3000\/login'/);
  assert.match(workflow, /--username-selector 'input\[name='\\''email'\\''\]'/);
  assert.match(workflow, /--wait-for-url '\*\*\/dashboard'/);
  assert.match(workflow, /A11Y_USERNAME: \$\{\{ secrets\.A11Y_USERNAME \}\}/);
  assert.match(workflow, /A11Y_PASSWORD: \$\{\{ secrets\.A11Y_PASSWORD \}\}/);
  assert.match(workflow, /--auth-state \.a11y-auth\/state\.json/);
  assert.doesNotMatch(workflow, /test-user@example\.com|password123/);
});

test("checkGateArgument maps supported gates and rejects unknown profiles", () => {
  assert.equal(checkGateArgument(undefined, "warning"), "--fail-on warning");
  assert.equal(checkGateArgument("report-only", "critical"), "--gate report-only");
  assert.throws(() => checkGateArgument("everything", "critical"), /Unsupported CI quality gate/);
});

test("resolveCiAuthFlow validates complete CI auth configuration", () => {
  assert.deepEqual(resolveCiAuthFlow({}), undefined);
  assert.deepEqual(resolveCiAuthFlow({
    authLoginUrl: "https://example.com/login",
    authUsernameSelector: "#email",
    authPasswordSelector: "#password",
    authSubmitSelector: "button[type='submit']",
    authWaitForSelector: "[data-ready]",
    authUsernameEnv: "TEST_USER",
    authPasswordEnv: "TEST_PASSWORD"
  }), {
    loginUrl: "https://example.com/login",
    usernameSelector: "#email",
    passwordSelector: "#password",
    submitSelector: "button[type='submit']",
    waitForSelector: "[data-ready]",
    usernameEnv: "TEST_USER",
    passwordEnv: "TEST_PASSWORD"
  });

  assert.throws(
    () => resolveCiAuthFlow({ authLoginUrl: "https://example.com/login" }),
    /--auth-username-selector/
  );
  assert.throws(
    () => resolveCiAuthFlow({
      authLoginUrl: "https://example.com/login",
      authUsernameSelector: "#email",
      authPasswordSelector: "#password",
      authSubmitSelector: "button",
      authWaitForUrl: "**/dashboard",
      authUsernameEnv: "BAD-NAME"
    }),
    /valid environment variable/
  );
});

test("formatCiGenerationNextSteps gives concrete review and rollout guidance", () => {
  const steps = formatCiGenerationNextSteps({
    provider: "github",
    profile: "pr",
    createdFiles: [".github/workflows/a11y.yml"],
    gate: "report-only",
    failOn: "critical"
  }).join("\n");

  assert.match(steps, /Review generated workflow file\(s\): \.github\/workflows\/a11y\.yml/);
  assert.match(steps, /Open a pull request/);
  assert.match(steps, /--gate report-only/);
  assert.match(steps, /--gate new-critical-only/);
});

test("formatCiGenerationNextSteps explains split CI profiles", () => {
  const steps = formatCiGenerationNextSteps({
    provider: "github",
    profile: "split",
    createdFiles: [".github/workflows/a11y-pr.yml", ".github/workflows/a11y-full.yml"],
    gate: "report-only",
    failOn: "critical"
  }).join("\n");

  assert.match(steps, /a11y-pr\.yml/);
  assert.match(steps, /a11y-full\.yml/);
  assert.match(steps, /fast PR workflow/);
  assert.match(steps, /full-site workflow/);
});

test("formatCiGenerationNextSteps explains shell runner usage", () => {
  const steps = formatCiGenerationNextSteps({
    provider: "shell",
    profile: "pr",
    createdFiles: ["scripts/a11y-ci.sh"],
    failOn: "warning"
  }).join("\n");

  assert.match(steps, /scripts\/a11y-ci\.sh/);
  assert.match(steps, /Call the generated shell script from your CI job/);
});

test("formatCiGenerationNextSteps explains auth secrets when auth flow is configured", () => {
  const steps = formatCiGenerationNextSteps({
    provider: "github",
    profile: "pr",
    createdFiles: [".github/workflows/a11y.yml"],
    gate: "report-only",
    failOn: "critical",
    auth: {
      loginUrl: "https://example.com/login",
      usernameSelector: "#email",
      passwordSelector: "#password",
      submitSelector: "button",
      waitForUrl: "**/dashboard",
      usernameEnv: "A11Y_USERNAME",
      passwordEnv: "A11Y_PASSWORD"
    }
  }).join("\n");

  assert.match(steps, /A11Y_USERNAME and A11Y_PASSWORD/);
  assert.match(steps, /least-privilege test account/);
  assert.match(steps, /temporary \.a11y-auth\/state\.json/);
  assert.match(steps, /do not commit credentials/);
});

test("fullWorkflowTemplate creates scheduled full-site crawl workflow", () => {
  const workflow = fullWorkflowTemplate({
    urls: ["http://localhost:3000"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 3,
    crawlLimit: 100,
    schedule: "0 7 * * 1"
  });

  assert.match(workflow, /name: Accessibility Full Site/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /Build app if needed/);
  assert.match(workflow, /npm run build --if-present/);
  assert.match(workflow, /cron: "0 7 \* \* 1"/);
  assert.match(workflow, /--crawl --crawl-depth 3 --crawl-limit 100 --semi-auto/);
  assert.match(workflow, /--fail-on none/);
  assert.doesNotMatch(workflow, /Comment on PR/);
});

test("workflowFiles splits PR and full-site workflows", () => {
  const workflows = workflowFiles({
    profile: "split",
    urls: ["http://localhost:3000"],
    startCommand: "npm run dev -- --host localhost --port 3000",
    failOn: "critical",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    fullCrawlDepth: 3,
    fullCrawlLimit: 100,
    fullSchedule: "0 7 * * 1"
  });

  assert.deepEqual(workflows.map((workflow) => workflow.fileName), [
    "a11y-pr.yml",
    "a11y-full.yml"
  ]);
});

test("gitLabWorkflowTemplate creates a report-only merge request job", () => {
  const workflow = gitLabWorkflowTemplate({
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10
  });

  assert.match(workflow, /image: mcr\.microsoft\.com\/playwright:v1\.49\.1-jammy/);
  assert.match(workflow, /APP_URL: "http:\/\/localhost:5173"/);
  assert.match(workflow, /GIT_DEPTH: "0"/);
  assert.match(workflow, /npm run build --if-present/);
  assert.match(workflow, /git fetch origin "\$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"/);
  assert.match(workflow, /npx a11y-shiftleft-cli check --static --dynamic --changed-since "origin\/\$CI_MERGE_REQUEST_TARGET_BRANCH_NAME" --url http:\/\/localhost:5173 --crawl --crawl-depth 1 --crawl-limit 10 --out reports --gate report-only --standard wcag22-aa --verbose/);
  assert.match(workflow, /npx a11y-shiftleft-cli check --static --dynamic --url http:\/\/localhost:5173 --crawl --crawl-depth 1 --crawl-limit 10 --out reports --gate report-only --standard wcag22-aa --verbose/);
  assert.match(workflow, /paths:\n      - reports\//);
});

test("gitLabWorkflowTemplate can create auth state before checks", () => {
  const workflow = gitLabWorkflowTemplate({
    urls: ["https://preview.example.com/dashboard"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    auth: {
      loginUrl: "https://preview.example.com/login",
      usernameSelector: "#email",
      passwordSelector: "#password",
      submitSelector: "button[type='submit']",
      waitForSelector: "[data-app-ready]",
      usernameEnv: "A11Y_USERNAME",
      passwordEnv: "A11Y_PASSWORD"
    }
  });

  assert.match(workflow, /auth scripted-login --url 'https:\/\/preview\.example\.com\/login'/);
  assert.match(workflow, /--wait-for-selector '\[data-app-ready\]'/);
  assert.match(workflow, /--auth-state \.a11y-auth\/state\.json/);
  assert.doesNotMatch(workflow, /\$\{\{ secrets\./);
});

test("gitLabWorkflowFiles supports the fast PR profile", () => {
  const workflows = gitLabWorkflowFiles({
    profile: "pr",
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    fullCrawlDepth: 3,
    fullCrawlLimit: 100,
    fullSchedule: "0 7 * * 1"
  });

  assert.deepEqual(workflows.map((workflow) => workflow.fileName), [".gitlab-ci.yml"]);
});

test("circleCiWorkflowTemplate creates a report-only job with artifacts", () => {
  const workflow = circleCiWorkflowTemplate({
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10
  });

  assert.match(workflow, /version: 2\.1/);
  assert.match(workflow, /image: mcr\.microsoft\.com\/playwright:v1\.49\.1-jammy/);
  assert.match(workflow, /APP_URL: "http:\/\/localhost:5173"/);
  assert.match(workflow, /background: true/);
  assert.match(workflow, /npx a11y-shiftleft-cli check --dynamic --url http:\/\/localhost:5173 --crawl --crawl-depth 1 --crawl-limit 10 --out reports --gate report-only --standard wcag22-aa --verbose/);
  assert.match(workflow, /store_artifacts:/);
});

test("circleCiWorkflowTemplate can create auth state before checks", () => {
  const workflow = circleCiWorkflowTemplate({
    urls: ["https://preview.example.com/dashboard"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    auth: {
      loginUrl: "https://preview.example.com/login",
      usernameSelector: "#email",
      passwordSelector: "#password",
      submitSelector: "button[type='submit']",
      waitForUrl: "**/dashboard",
      usernameEnv: "A11Y_USERNAME",
      passwordEnv: "A11Y_PASSWORD"
    }
  });

  assert.match(workflow, /name: Create authenticated browser state/);
  assert.match(workflow, /auth scripted-login --url 'https:\/\/preview\.example\.com\/login'/);
  assert.match(workflow, /--wait-for-url '\*\*\/dashboard'/);
  assert.match(workflow, /--auth-state \.a11y-auth\/state\.json/);
});

test("circleCiWorkflowFiles supports the fast PR profile", () => {
  const workflows = circleCiWorkflowFiles({
    profile: "pr",
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    fullCrawlDepth: 3,
    fullCrawlLimit: 100,
    fullSchedule: "0 7 * * 1"
  });

  assert.deepEqual(workflows.map((workflow) => workflow.fileName), ["config.yml"]);
});

test("shellWorkflowTemplate creates a portable CI script", () => {
  const script = shellWorkflowTemplate({
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10
  });

  assert.match(script, /^#!\/usr\/bin\/env bash/);
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /APP_URL="\$\{APP_URL:-http:\/\/localhost:5173\}"/);
  assert.match(script, /REPORT_DIR="\$\{A11Y_REPORT_DIR:-reports\}"/);
  assert.match(script, /npm run build --if-present/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /npx a11y-shiftleft-cli check --dynamic --url http:\/\/localhost:5173 --crawl --crawl-depth 1 --crawl-limit 10 --out "\$REPORT_DIR" --gate report-only --standard wcag22-aa --verbose/);
});

test("shellWorkflowTemplate can create auth state before checks", () => {
  const script = shellWorkflowTemplate({
    urls: ["https://preview.example.com/dashboard"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    auth: {
      loginUrl: "https://preview.example.com/login",
      usernameSelector: "#email",
      passwordSelector: "#password",
      submitSelector: "button[type='submit']",
      waitForUrl: "**/dashboard",
      usernameEnv: "A11Y_USERNAME",
      passwordEnv: "A11Y_PASSWORD"
    }
  });

  assert.match(script, /auth scripted-login --url 'https:\/\/preview\.example\.com\/login'/);
  assert.match(script, /--out \.a11y-auth\/state\.json --quiet\nnpx a11y-shiftleft-cli check/);
  assert.match(script, /--auth-state \.a11y-auth\/state\.json/);
});

test("shellWorkflowFiles supports the fast PR profile", () => {
  const workflows = shellWorkflowFiles({
    profile: "pr",
    urls: ["http://localhost:5173"],
    startCommand: "npm run dev -- --host 0.0.0.0 --port 5173",
    failOn: "critical",
    gate: "report-only",
    fullFailOn: "none",
    standard: "wcag22-aa",
    crawlDepth: 1,
    crawlLimit: 10,
    fullCrawlDepth: 3,
    fullCrawlLimit: 100,
    fullSchedule: "0 7 * * 1"
  });

  assert.deepEqual(workflows.map((workflow) => workflow.fileName), ["a11y-ci.sh"]);
  assert.equal(workflows[0]?.executable, true);
});

test("toCiProfile supports quick alias and rejects unknown profiles", () => {
  assert.equal(toCiProfile("quick"), "pr");
  assert.equal(toCiProfile("split"), "split");
  assert.throws(() => toCiProfile("slow"), /Unsupported CI profile/);
});

test("toCiProvider supports GitHub, GitLab, CircleCI, and shell aliases", () => {
  assert.equal(toCiProvider("github"), "github");
  assert.equal(toCiProvider("GitLab"), "gitlab");
  assert.equal(toCiProvider("circle"), "circleci");
  assert.equal(toCiProvider("CircleCI"), "circleci");
  assert.equal(toCiProvider("generic"), "shell");
  assert.equal(toCiProvider("Jenkins"), "shell");
  assert.throws(() => toCiProvider("teamcity"), /Unsupported CI provider/);
});

async function captureConsoleOutput(action: () => Promise<void>): Promise<string> {
  const originalLog = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    await action();
  } finally {
    console.log = originalLog;
  }

  return lines.join("\n");
}
