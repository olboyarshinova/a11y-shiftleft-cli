import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import type { Command } from "commander";
import { DEFAULT_AUTH_STATE_FILE, normalizeAuthUrl, parseAuthTimeoutMs, resolveAuthStatePath } from "../core/authState.js";
import { browserEvidenceName, launchBrowserRuntime, normalizeBrowserEngine, supportedBrowserEnginesText } from "../core/browserRuntime.js";
import { resolveDevicePreset } from "../core/devicePresets.js";
import { addReportEntriesToGitignore } from "./init.js";

interface AuthLoginOptions {
  cwd?: string;
  url: string;
  out?: string;
  browser?: string;
  device?: string;
  mobile?: boolean;
  tablet?: boolean;
  waitForUrl?: string;
  waitForSelector?: string;
  timeoutMs?: string;
  gitignore?: boolean;
  quiet?: boolean;
}

interface AuthLoginResult {
  storageStatePath: string;
  gitignorePath?: string;
  gitignoreAdded: string[];
}

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Create and manage local browser authentication state.");

  auth
    .command("login")
    .description("Open a browser for manual login and save Playwright storage state.")
    .option("--cwd <dir>", "Target project directory")
    .requiredOption("--url <url>", "Login URL")
    .option("--out <file>", "Storage state output file", DEFAULT_AUTH_STATE_FILE)
    .option("--browser <engine>", "Browser engine: chromium, firefox, or webkit")
    .option("--device <name>", "Playwright device preset, for example \"iPhone 13\" or \"Pixel 5\"")
    .option("--mobile", "Use the default mobile browser profile (iPhone 13)")
    .option("--tablet", "Use the default tablet browser profile (iPad gen 7)")
    .option("--wait-for-url <pattern>", "Save after the page URL matches this Playwright URL pattern")
    .option("--wait-for-selector <selector>", "Save after this selector appears")
    .option("--timeout-ms <ms>", "Maximum time to wait for login completion", "120000")
    .option("--no-gitignore", "Do not add auth-state paths to .gitignore")
    .option("--quiet", "Suppress login instructions")
    .action(async (options: AuthLoginOptions) => {
      const result = await runAuthLogin(options);
      if (!options.quiet) {
        console.log(formatAuthLoginSummary(result));
      }
    });
}

export async function runAuthLogin(options: AuthLoginOptions): Promise<AuthLoginResult> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const loginUrl = normalizeAuthUrl(options.url);
  const storageStatePath = resolveAuthStatePath(options.out || DEFAULT_AUTH_STATE_FILE, cwd);
  if (!storageStatePath) throw new Error("Storage state output path is required.");

  const browser = toBrowserEngine(options.browser) || "chromium";
  const device = resolveDevicePreset(options);
  const timeoutMs = parseAuthTimeoutMs(options.timeoutMs);
  const runtime = await launchBrowserRuntime({
    browser,
    device,
    headless: false,
    source: "auth"
  });

  const context = await runtime.browser.newContext(runtime.contextOptions);
  const page = await context.newPage();

  try {
    if (!options.quiet) {
      console.log([
        "a11y-shiftleft auth login",
        `Browser: ${browserEvidenceName(browser, device)}`,
        `Login URL: ${loginUrl}`,
        "Finish login in the opened browser window.",
        options.waitForUrl || options.waitForSelector
          ? "The CLI will save auth state when the wait condition is met."
          : "Return to this terminal and press Enter when the logged-in page is ready."
      ].join("\n"));
    }

    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await waitForLoginCompletion({
      page,
      waitForUrl: options.waitForUrl,
      waitForSelector: options.waitForSelector,
      timeoutMs
    });

    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
    await context.storageState({ path: storageStatePath });

    const gitignore = options.gitignore === false
      ? undefined
      : await addReportEntriesToGitignore(cwd);

    return {
      storageStatePath,
      gitignorePath: gitignore?.path,
      gitignoreAdded: gitignore?.added || []
    };
  } finally {
    await context.close().catch(() => undefined);
    await runtime.browser.close().catch(() => undefined);
  }
}

async function waitForLoginCompletion(options: {
  page: {
    waitForURL: (url: string, options: { timeout: number }) => Promise<unknown>;
    waitForSelector: (selector: string, options: { state: "visible"; timeout: number }) => Promise<unknown>;
  };
  waitForUrl?: string;
  waitForSelector?: string;
  timeoutMs: number;
}): Promise<void> {
  if (options.waitForUrl) {
    await options.page.waitForURL(options.waitForUrl, { timeout: options.timeoutMs });
    return;
  }

  if (options.waitForSelector) {
    await options.page.waitForSelector(options.waitForSelector, {
      state: "visible",
      timeout: options.timeoutMs
    });
    return;
  }

  if (!process.stdin.isTTY) {
    throw new Error("Interactive login requires a TTY. Use --wait-for-url or --wait-for-selector in non-interactive shells.");
  }

  const input = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    await input.question("Press Enter after login is complete...");
  } finally {
    input.close();
  }
}

function formatAuthLoginSummary(result: AuthLoginResult): string {
  return [
    `Saved auth state: ${result.storageStatePath}`,
    result.gitignorePath
      ? result.gitignoreAdded.length > 0
        ? `Updated .gitignore: ${result.gitignoreAdded.join(", ")}`
        : "Auth-state paths are already ignored by .gitignore"
      : "Skipped .gitignore update",
    `Run an authenticated audit with: npx a11y-shiftleft-cli audit --url <app-url> --auth-state ${result.storageStatePath}`
  ].join("\n");
}

function toBrowserEngine(browser: string | undefined) {
  if (!browser) return undefined;
  const normalized = normalizeBrowserEngine(browser);
  if (normalized !== browser) {
    throw new Error(`Unsupported browser engine: ${browser}. Use ${supportedBrowserEnginesText()}.`);
  }
  return normalized;
}
