import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { addReportEntriesToGitignore, createInitialConfig, toFramework } from "./init.js";
import { ciTargetPath, ciWorkflowFiles, resolveCiAuthFlow, toCiProfile, toCiProvider, toPositiveInteger } from "./ci.js";

interface SetupOptions {
  cwd?: string;
  url: string[];
  startCommand: string;
  build?: boolean;
  buildCommand?: string;
  framework?: string;
  ci: string;
  profile: string;
  gate: string;
  failOn: string;
  standard: string;
  crawlDepth?: string;
  crawlLimit?: string;
  fullCrawlDepth?: string;
  fullCrawlLimit?: string;
  fullSchedule?: string;
  authLoginUrl?: string;
  authUsernameSelector?: string;
  authPasswordSelector?: string;
  authSubmitSelector?: string;
  authWaitForUrl?: string;
  authWaitForSelector?: string;
  authUsernameEnv?: string;
  authPasswordEnv?: string;
  gitHooks?: string;
  force?: boolean;
  skipConfig?: boolean;
  skipGitignore?: boolean;
  skipCi?: boolean;
  skipScripts?: boolean;
}

type GitHookTool = "none" | "husky" | "lefthook";

interface SetupResult {
  created: string[];
  skipped: string[];
  updated: string[];
  nextSteps: string[];
}

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Create config, .gitignore entries, and CI workflow for a first accessibility audit.")
    .option("--cwd <dir>", "Target project directory")
    .option("--url <urls...>", "URL(s) to scan", ["http://localhost:3000"])
    .option("--start-command <command>", "Command that starts the app in CI", "npm run dev -- --host localhost --port 3000")
    .option("--build-command <command>", "Command that prepares the app before starting it in CI", "npm run build --if-present")
    .option("--no-build", "Do not add a build step before starting the app in generated CI")
    .option("--framework <name>", "Target framework: auto, react, vue, angular, or unknown")
    .option("--ci <provider>", "CI provider: github, gitlab, circleci, shell, or none", "github")
    .option("--profile <profile>", "CI profile: pr, full, or split", "pr")
    .option("--gate <profile>", "CI quality gate: report-only, critical, warning, or new-critical-only", "report-only")
    .option("--fail-on <severity>", "Fallback severity gate when --gate is not set", "critical")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, section508, or en301549", "wcag22-aa")
    .option("--crawl-depth <depth>", "Fast PR crawl depth", "1")
    .option("--crawl-limit <limit>", "Fast PR crawl URL limit", "10")
    .option("--full-crawl-depth <depth>", "Scheduled full-site crawl depth", "3")
    .option("--full-crawl-limit <limit>", "Scheduled full-site crawl URL limit", "100")
    .option("--full-schedule <cron>", "Scheduled full-site workflow cron expression", "0 7 * * 1")
    .option("--auth-login-url <url>", "Optional login URL for CI-safe scripted auth state")
    .option("--auth-username-selector <selector>", "Username/email field selector for CI-safe scripted auth")
    .option("--auth-password-selector <selector>", "Password field selector for CI-safe scripted auth")
    .option("--auth-submit-selector <selector>", "Submit control selector for CI-safe scripted auth")
    .option("--auth-wait-for-url <pattern>", "Save CI auth state after the URL matches this pattern")
    .option("--auth-wait-for-selector <selector>", "Save CI auth state after this selector appears")
    .option("--auth-username-env <name>", "CI environment or secret name for the username", "A11Y_USERNAME")
    .option("--auth-password-env <name>", "CI environment or secret name for the password", "A11Y_PASSWORD")
    .option("--git-hooks <tool>", "Optional pre-commit hook setup: none, husky, or lefthook", "none")
    .option("--force", "Overwrite existing generated config and workflow files")
    .option("--skip-config", "Do not create .a11y-shiftleft.json")
    .option("--skip-gitignore", "Do not update .gitignore")
    .option("--skip-ci", "Do not generate CI workflow files")
    .option("--skip-scripts", "Do not add a11y npm scripts to package.json")
    .action(async (options: SetupOptions) => {
      const result = await runSetup(options);

      for (const item of result.created) console.log(`Created ${item}`);
      for (const item of result.updated) console.log(`Updated ${item}`);
      for (const item of result.skipped) console.log(`Skipped ${item}`);

      console.log("\nNext steps:");
      for (const [index, step] of result.nextSteps.entries()) {
        console.log(`${index + 1}. ${step}`);
      }
    });
}

export async function runSetup(options: SetupOptions): Promise<SetupResult> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const urls = parseUrls(options.url);
  const scanUrls = urls.length > 0 ? urls : ["http://localhost:3000"];
  const created: string[] = [];
  const skipped: string[] = [];
  const updated: string[] = [];
  const ciAuthFlow = !options.skipCi && options.ci !== "none"
    ? resolveCiAuthFlow(options)
    : undefined;

  if (!options.skipConfig) {
    const configPath = path.join(cwd, ".a11y-shiftleft.json");
    if (!options.force && await exists(configPath)) {
      skipped.push(`${displayPath(cwd, configPath)} already exists`);
    } else {
      await fs.mkdir(cwd, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(createInitialConfig(toFramework(options.framework)), null, 2));
      created.push(displayPath(cwd, configPath));
    }
  }

  if (!options.skipGitignore) {
    const gitignore = await addReportEntriesToGitignore(cwd);
    const gitignorePath = displayPath(cwd, gitignore.path);
    if (gitignore.added.length > 0) {
      updated.push(`${gitignorePath} (${gitignore.added.join(", ")})`);
    } else {
      skipped.push(`${gitignorePath} already ignores generated a11y artifacts`);
    }
  }

  if (!options.skipScripts) {
    const scripts = await addPackageScripts(cwd, scanUrls, options.gate, options.force);
    const scriptsPath = displayPath(cwd, scripts.path);
    if (scripts.status === "updated") {
      updated.push(`${scriptsPath} (${scripts.added.join(", ")})`);
    } else if (scripts.status === "missing") {
      skipped.push(`${scriptsPath} not found`);
    } else {
      skipped.push(`${scriptsPath} already has a11y npm scripts`);
    }
  }

  if (!options.skipCi && options.ci !== "none") {
    const provider = toCiProvider(options.ci);
    const workflowOptions = {
      profile: toCiProfile(options.profile),
      urls: scanUrls,
      startCommand: options.startCommand,
      buildCommand: options.build === false ? null : options.buildCommand,
      failOn: options.failOn,
      gate: options.gate,
      fullFailOn: "none",
      standard: options.standard,
      crawlDepth: toPositiveInteger(options.crawlDepth, 1),
      crawlLimit: toPositiveInteger(options.crawlLimit, 10),
      fullCrawlDepth: toPositiveInteger(options.fullCrawlDepth, 3),
      fullCrawlLimit: toPositiveInteger(options.fullCrawlLimit, 100),
      fullSchedule: options.fullSchedule || "0 7 * * 1",
      auth: ciAuthFlow
    };
    const workflows = ciWorkflowFiles(provider, workflowOptions);

    for (const workflow of workflows) {
      const target = ciTargetPath(cwd, provider, workflow.fileName);
      if (!options.force && await exists(target)) {
        skipped.push(`${displayPath(cwd, target)} already exists`);
        continue;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, workflow.contents);
      if (workflow.executable) await fs.chmod(target, 0o755);
      created.push(displayPath(cwd, target));
    }
  }

  const gitHookTool = toGitHookTool(options.gitHooks);
  if (gitHookTool !== "none") {
    const hookFiles = gitHookFiles(gitHookTool, options.gate);
    for (const hookFile of hookFiles) {
      const target = path.join(cwd, hookFile.fileName);
      if (!options.force && await exists(target)) {
        skipped.push(`${displayPath(cwd, target)} already exists`);
        continue;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, hookFile.contents);
      if (hookFile.executable) await fs.chmod(target, 0o755);
      created.push(displayPath(cwd, target));
    }
  }

  return {
    created,
    skipped,
    updated,
    nextSteps: buildSetupNextSteps(options, scanUrls, changedSetupFiles(created, updated), ciAuthFlow)
  };
}

function buildSetupNextSteps(options: SetupOptions, urls: string[], changedFiles: string[], ciAuthFlow?: { usernameEnv: string; passwordEnv: string }): string[] {
  const firstUrl = urls[0] || "http://localhost:3000";
  const urlArgs = urls.join(" ") || firstUrl;
  const steps = [
    `Start your app locally: ${options.startCommand}`,
    options.skipScripts
      ? `Run a visual audit: npx a11y-shiftleft-cli audit --url ${firstUrl} --out reports --open`
      : "Run a visual audit: npm run a11y:audit",
    options.skipScripts
      ? `Run a fast check: npx a11y-shiftleft-cli check --dynamic --url ${urlArgs} --out reports --gate ${options.gate} --verbose`
      : "Run a fast check: npm run a11y:check",
    `If setup or browser reachability fails, run: npx a11y-shiftleft-cli doctor --url ${firstUrl}`
  ];

  if (!options.skipCi && options.ci !== "none") {
    steps.push(formatCiRolloutStep(options));
  }

  if (ciAuthFlow) {
    steps.push(`Add CI secrets or protected variables named ${ciAuthFlow.usernameEnv} and ${ciAuthFlow.passwordEnv} for a least-privilege test account; CI will create a temporary .a11y-auth/state.json, so do not commit credentials or generated auth-state files.`);
  }

  const gitHookTool = toGitHookTool(options.gitHooks);
  if (gitHookTool !== "none") {
    steps.push(formatGitHookNextStep(gitHookTool));
  }

  if (changedFiles.length > 0) {
    steps.push(`Review generated or updated files: ${changedFiles.join(", ")}`);
  }

  steps.push("Commit the generated config, scripts, and workflow files after reviewing them.");
  return steps;
}

function changedSetupFiles(created: string[], updated: string[]): string[] {
  return [...new Set([...created, ...updated].map((item) => item.replace(/\s+\(.+\)$/, "")))];
}

function toGitHookTool(value?: string): GitHookTool {
  const normalized = (value || "none").toLowerCase();
  if (normalized === "none" || normalized === "husky" || normalized === "lefthook") {
    return normalized;
  }
  throw new Error(`Unsupported git hook setup "${value}". Use none, husky, or lefthook.`);
}

function gitHookFiles(tool: GitHookTool, gate: string): Array<{ fileName: string; contents: string; executable?: boolean }> {
  const command = stagedStaticCheckScript(gate);
  if (tool === "husky") {
    return [{
      fileName: ".husky/pre-commit",
      contents: `#!/usr/bin/env sh\n${command}`,
      executable: true
    }];
  }

  if (tool === "lefthook") {
    return [{
      fileName: "lefthook.yml",
      contents: `pre-commit:\n  commands:\n    a11y-static:\n      run: |\n${indentBlock(command, 8)}`,
      executable: false
    }];
  }

  return [];
}

function stagedStaticCheckScript(gate: string): string {
  return `npx a11y-shiftleft-cli check --static --staged --out reports --gate ${gate}\n`;
}

function formatGitHookNextStep(tool: Exclude<GitHookTool, "none">): string {
  if (tool === "husky") {
    return "Enable Husky if your project does not already use it: npm install --save-dev husky && npm pkg set scripts.prepare=\"husky\" && npm run prepare";
  }

  return "Enable Lefthook if your project does not already use it: npm install --save-dev lefthook && npx lefthook install";
}

function indentBlock(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => line ? `${prefix}${line}` : line).join("\n");
}

function formatCiRolloutStep(options: SetupOptions): string {
  const profile = toCiProfile(options.profile);

  if (profile === "split") {
    return "CI uses the split profile: keep the PR workflow fast and use the full-site workflow manually or on schedule while remediation is being tracked.";
  }

  if (profile === "full") {
    return "CI uses the full-site profile; run it manually first and keep scheduled scans report-only until the findings are understood.";
  }

  if (options.gate === "report-only") {
    return "CI starts in report-only mode; review uploaded reports first, then tighten to --gate new-critical-only when the baseline is understood.";
  }

  return `CI quality gate is ${options.gate}; keep reports uploaded as artifacts so findings can be reviewed before changing the gate.`;
}

type PackageScriptsResult =
  | { status: "updated"; path: string; added: string[] }
  | { status: "unchanged"; path: string; added: string[] }
  | { status: "missing"; path: string; added: string[] };

export async function addPackageScripts(
  cwd: string,
  urls: string[],
  gate = "report-only",
  force = false
): Promise<PackageScriptsResult> {
  const packagePath = path.join(cwd, "package.json");
  const existing = await readTextIfExists(packagePath);
  if (!existing) return { status: "missing", path: packagePath, added: [] };

  const manifest = JSON.parse(existing) as {
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };
  const scripts = manifest.scripts && typeof manifest.scripts === "object"
    ? { ...manifest.scripts }
    : {};
  const scanUrls = urls.length > 0 ? urls : ["http://localhost:3000"];
  const firstUrl = scanUrls[0];
  const urlArgs = scanUrls.join(" ");
  const desired = {
    "a11y:audit": `a11y-shiftleft audit --url ${firstUrl} --out reports --open`,
    "a11y:check": `a11y-shiftleft check --dynamic --url ${urlArgs} --out reports --gate ${gate} --verbose`
  };
  const added: string[] = [];

  for (const [name, command] of Object.entries(desired)) {
    if (!force && scripts[name]) continue;
    if (scripts[name] !== command) {
      scripts[name] = command;
      added.push(name);
    }
  }

  if (added.length === 0) {
    return { status: "unchanged", path: packagePath, added };
  }

  manifest.scripts = scripts;
  await fs.writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { status: "updated", path: packagePath, added };
}

function parseUrls(urls?: string[]): string[] {
  if (!urls || urls.length === 0) return [];

  return [...new Set(urls
    .flatMap((url) => url.split(","))
    .map((url) => url.trim())
    .filter(Boolean))];
}

function displayPath(cwd: string, filePath: string): string {
  const relative = path.relative(cwd, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return filePath;
  return relative;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return "";
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
