import {
  chromium,
  devices,
  firefox,
  webkit,
  type Browser,
  type BrowserContextOptions,
  type BrowserType
} from "playwright";
import type { BrowserEngine, BrowserEvidence } from "../types.js";

export interface BrowserRuntimeOptions {
  browser?: BrowserEngine | string;
  device?: string;
  source: BrowserEvidence["source"];
}

export interface BrowserRuntime {
  browser: Browser;
  contextOptions: BrowserContextOptions;
  evidence: BrowserEvidence;
}

export const SUPPORTED_BROWSER_ENGINES: BrowserEngine[] = ["chromium", "firefox", "webkit"];

export async function launchBrowserRuntime(options: BrowserRuntimeOptions): Promise<BrowserRuntime> {
  const engine = normalizeBrowserEngine(options.browser);
  const browserType = browserTypeForEngine(engine);
  const browser = await browserType.launch();
  const device = resolveDeviceDescriptor(options.device);

  return {
    browser,
    contextOptions: device.contextOptions,
    evidence: {
      engine,
      name: browserName(engine, device.name),
      version: browser.version(),
      source: options.source
    }
  };
}

export function normalizeBrowserEngine(value: string | undefined): BrowserEngine {
  if (value === "chromium" || value === "firefox" || value === "webkit") return value;
  return "chromium";
}

export function supportedBrowserEnginesText(): string {
  return SUPPORTED_BROWSER_ENGINES.join(", ");
}

export function browserEvidenceName(engine: BrowserEngine, deviceName: string | undefined): string {
  return browserName(engine, deviceName?.trim() || undefined);
}

function browserTypeForEngine(engine: BrowserEngine): BrowserType {
  if (engine === "firefox") return firefox;
  if (engine === "webkit") return webkit;
  return chromium;
}

function resolveDeviceDescriptor(deviceName: string | undefined): {
  name?: string;
  contextOptions: BrowserContextOptions;
} {
  const name = deviceName?.trim();
  if (!name) return { contextOptions: {} };

  const descriptor = devices[name];
  if (!descriptor) {
    const examples = ["Desktop Chrome", "Desktop Safari", "iPhone 13", "Pixel 5"].join(", ");
    throw new Error(`Unsupported Playwright device "${name}". Try one of: ${examples}.`);
  }

  return {
    name,
    contextOptions: descriptor
  };
}

function browserName(engine: BrowserEngine, deviceName: string | undefined): string {
  const base = engine === "webkit"
    ? "WebKit"
    : engine === "firefox"
      ? "Firefox"
      : "Chromium";

  return deviceName ? `${base} (${deviceName})` : base;
}
