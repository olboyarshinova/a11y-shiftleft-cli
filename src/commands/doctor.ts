import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type { Command } from "commander";
import { discoverConfig, type DiscoveredConfig } from "../config/loadConfig.js";
import { adapterPackagesForFramework } from "../core/frameworkAdapters.js";
import type { Framework } from "../types.js";

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
}

interface DoctorOptions {
  cwd?: string;
  config?: string;
  framework?: string;
  url?: string;
  json?: boolean;
  fail?: boolean;
}

interface DoctorRuntime {
  nodeVersion: string;
  env: NodeJS.ProcessEnv;
  fetch: typeof fetch;
  checkChromium: () => Promise<DoctorCheck>;
}

const MIN_NODE_MAJOR = 18;

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check local setup before running accessibility scans.")
    .option("--cwd <dir>", "Target project directory")
    .option("--config <file>", "Config path relative to cwd")
    .option("--framework <name>", "Target framework: auto, react, vue, angular, or unknown")
    .option("--url <url>", "Target URL to verify before dynamic scans")
    .option("--json", "Print machine-readable doctor output")
    .option("--no-fail", "Do not exit with a non-zero status when checks fail")
    .action(async (options: DoctorOptions) => {
      const checks = await runDoctorChecks(options);

      if (options.json) {
        console.log(JSON.stringify({ checks, summary: summarizeDoctorChecks(checks) }, null, 2));
      } else {
        console.log(formatDoctorChecks(checks));
      }

      if (options.fail !== false && checks.some((check) => check.status === "fail")) {
        process.exitCode = 1;
      }
    });
}

export async function runDoctorChecks(
  options: Pick<DoctorOptions, "cwd" | "config" | "framework" | "url">,
  runtime: DoctorRuntime = {
    nodeVersion: process.versions.node,
    env: process.env,
    fetch,
    checkChromium: checkChromiumBrowser
  }
): Promise<DoctorCheck[]> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const discoveredConfig = await discoverConfig(cwd, options.config);
  const framework = toFramework(options.framework) ||
    toFramework(discoveredConfig.config.framework) ||
    "auto";
  const checks: DoctorCheck[] = [];

  checks.push(checkNodeVersion(runtime.nodeVersion));
  checks.push(await checkProjectDirectory(cwd));
  checks.push(checkConfigFile(discoveredConfig));
  checks.push(checkPackageResolution(cwd, "playwright"));
  checks.push(...checkFrameworkAdapterPackages(cwd, framework));
  checks.push(await runtime.checkChromium());
  checks.push(checkCiEnvironment(runtime.env));

  if (options.url) {
    checks.push(await checkTargetUrl(options.url, runtime.fetch));
  } else {
    checks.push({
      name: "Target URL",
      status: "warn",
      message: "No --url provided, so doctor skipped the dynamic scan reachability check."
    });
  }

  return checks;
}

export function checkFrameworkAdapterPackages(cwd: string, framework: Framework): DoctorCheck[] {
  const requiredPackages = adapterPackagesForFramework(framework);

  if (requiredPackages.length === 0) {
    return [{
      name: "Framework adapters",
      status: "warn",
      message: "Framework is auto/unknown. Configure --framework or an a11y config file for more specific adapter checks."
    }];
  }

  return requiredPackages.map((packageName) => checkPackageResolution(cwd, packageName));
}

export function summarizeDoctorChecks(checks: DoctorCheck[]): Record<DoctorStatus, number> {
  return checks.reduce<Record<DoctorStatus, number>>((summary, check) => {
    summary[check.status] += 1;
    return summary;
  }, { pass: 0, warn: 0, fail: 0 });
}

export function formatDoctorChecks(checks: DoctorCheck[]): string {
  const summary = summarizeDoctorChecks(checks);
  const lines = [
    "a11y-shiftleft doctor",
    "",
    ...checks.map((check) => `${statusIcon(check.status)} ${check.name}: ${check.message}`),
    "",
    `Summary: ${summary.pass} pass, ${summary.warn} warn, ${summary.fail} fail`
  ];

  return lines.join("\n");
}

function checkNodeVersion(nodeVersion: string): DoctorCheck {
  const major = Number(nodeVersion.split(".")[0]);

  if (Number.isInteger(major) && major >= MIN_NODE_MAJOR) {
    return {
      name: "Node.js",
      status: "pass",
      message: `Using Node ${nodeVersion}.`
    };
  }

  return {
    name: "Node.js",
    status: "fail",
    message: `Node ${nodeVersion} detected. Use Node ${MIN_NODE_MAJOR} or newer.`
  };
}

async function checkProjectDirectory(cwd: string): Promise<DoctorCheck> {
  try {
    const stat = await fs.stat(cwd);

    if (stat.isDirectory()) {
      return {
        name: "Project directory",
        status: "pass",
        message: "Target project directory is accessible."
      };
    }
  } catch {
    return {
      name: "Project directory",
      status: "fail",
      message: `Cannot access ${cwd}.`
    };
  }

  return {
    name: "Project directory",
    status: "fail",
    message: `${cwd} is not a directory.`
  };
}

function checkConfigFile(config: DiscoveredConfig): DoctorCheck {
  if (config.found) {
    return {
      name: "Config file",
      status: "pass",
      message: `Found ${config.source}.`
    };
  }

  return {
    name: "Config file",
    status: "warn",
    message: "No a11y config found. Run npx a11y-shiftleft init to create one."
  };
}

function checkPackageResolution(cwd: string, packageName: string): DoctorCheck {
  try {
    const requireFromProject = createRequire(path.join(cwd, "package.json"));
    requireFromProject.resolve(packageName);
    return {
      name: packageName,
      status: "pass",
      message: `${packageName} is resolvable from the target project.`
    };
  } catch {
    return {
      name: packageName,
      status: "warn",
      message: `${packageName} is not resolvable from the target project. Install the CLI locally or run npm install.`
    };
  }
}

function toFramework(framework: unknown): Framework | undefined {
  if (
    framework === "react" ||
    framework === "vue" ||
    framework === "angular" ||
    framework === "auto" ||
    framework === "unknown"
  ) {
    return framework;
  }

  return undefined;
}

async function checkChromiumBrowser(): Promise<DoctorCheck> {
  try {
    const { chromium } = await import("playwright");
    const executablePath = chromium.executablePath();
    await fs.access(executablePath);

    return {
      name: "Chromium",
      status: "pass",
      message: "Playwright Chromium browser is installed."
    };
  } catch {
    return {
      name: "Chromium",
      status: "fail",
      message: "Playwright Chromium is missing. Run npx playwright install chromium."
    };
  }
}

function checkCiEnvironment(env: NodeJS.ProcessEnv): DoctorCheck {
  if (env.GITHUB_ACTIONS === "true") {
    return {
      name: "CI environment",
      status: "pass",
      message: "GitHub Actions detected."
    };
  }

  if (env.CI === "true") {
    return {
      name: "CI environment",
      status: "pass",
      message: "Generic CI environment detected."
    };
  }

  return {
    name: "CI environment",
    status: "warn",
    message: "No CI environment detected. This is expected for local development."
  };
}

async function checkTargetUrl(url: string, fetchImpl: typeof fetch): Promise<DoctorCheck> {
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      return {
        name: "Target URL",
        status: "pass",
        message: `${url} responded with HTTP ${response.status}.`
      };
    }

    return {
      name: "Target URL",
      status: "fail",
      message: `${url} responded with HTTP ${response.status}.`
    };
  } catch {
    return {
      name: "Target URL",
      status: "fail",
      message: `Cannot reach ${url}. Start the app before running dynamic checks.`
    };
  }
}

function statusIcon(status: DoctorStatus): string {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}
