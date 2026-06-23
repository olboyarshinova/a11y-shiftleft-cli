import net from "node:net";
import { chromium, type Browser } from "playwright";
import type { LighthouseAuditItem, LighthouseAuditResult } from "../types.js";

type LighthouseModule = {
  default?: LighthouseRunner;
} | LighthouseRunner;

type LighthouseRunner = (
  url: string,
  flags?: Record<string, unknown>,
  config?: Record<string, unknown>
) => Promise<{ lhr?: LighthouseResult } | LighthouseResult>;

interface LighthouseResult {
  requestedUrl?: string;
  finalDisplayedUrl?: string;
  finalUrl?: string;
  fetchTime?: string;
  userAgent?: string;
  categories?: {
    accessibility?: {
      score?: number | null;
    };
  };
  audits?: Record<string, {
    id?: string;
    title?: string;
    score?: number | null;
    scoreDisplayMode?: string;
    description?: string;
  }>;
}

export interface RunLighthouseOptions {
  url: string;
  runner?: LighthouseRunner;
}

export async function runLighthouseAdapter(options: RunLighthouseOptions): Promise<LighthouseAuditResult> {
  const startedAt = Date.now();
  const runner = options.runner || await loadLighthouseRunner();
  const port = await getFreePort();
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [`--remote-debugging-port=${port}`]
    });

    const result = await runner(options.url, {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["accessibility"]
    });
    const lhr = "lhr" in result && result.lhr ? result.lhr : result as LighthouseResult;

    return summarizeLighthouseResult(options.url, lhr, Date.now() - startedAt);
  } finally {
    await browser?.close();
  }
}

export function summarizeLighthouseResult(
  url: string,
  lhr: LighthouseResult,
  durationMs: number
): LighthouseAuditResult {
  const audits = Object.values(lhr.audits || {}).map(toAuditItem);
  const failedAudits = audits.filter((audit) =>
    audit.score !== null &&
    audit.score < 1 &&
    audit.scoreDisplayMode !== "informative" &&
    audit.scoreDisplayMode !== "manual" &&
    audit.scoreDisplayMode !== "notApplicable"
  );
  const manualAudits = audits.filter((audit) => audit.scoreDisplayMode === "manual");
  const notApplicableAudits = audits.filter((audit) => audit.scoreDisplayMode === "notApplicable").length;
  const score = lhr.categories?.accessibility?.score;

  return {
    url,
    requestedUrl: lhr.requestedUrl,
    finalUrl: lhr.finalDisplayedUrl || lhr.finalUrl,
    fetchTime: lhr.fetchTime,
    userAgent: lhr.userAgent,
    accessibilityScore: typeof score === "number" ? Math.round(score * 100) : null,
    failedAudits,
    manualAudits,
    notApplicableAudits,
    durationMs
  };
}

async function loadLighthouseRunner(): Promise<LighthouseRunner> {
  try {
    const imported = await dynamicImport("lighthouse") as LighthouseModule;
    const runner = typeof imported === "function" ? imported : imported.default;
    if (typeof runner !== "function") throw new Error("The lighthouse module did not expose a runner function.");
    return runner;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Lighthouse is optional. Install it with npm install -D lighthouse, then rerun with --with-lighthouse. Original error: ${message}`);
  }
}

function dynamicImport(specifier: string): Promise<unknown> {
  return new Function("specifier", "return import(specifier);")(specifier) as Promise<unknown>;
}

function toAuditItem(audit: NonNullable<LighthouseResult["audits"]>[string]): LighthouseAuditItem {
  const id = audit.id || "unknown";
  return {
    id,
    title: audit.title || id,
    score: typeof audit.score === "number" ? audit.score : null,
    scoreDisplayMode: audit.scoreDisplayMode,
    description: stripMarkdownLinks(audit.description),
    documentationUrl: extractFirstUrl(audit.description)
  };
}

function stripMarkdownLinks(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
}

function extractFirstUrl(value: string | undefined): string | undefined {
  return value?.match(/https?:\/\/[^)\s]+/)?.[0];
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address?.port) {
          resolve(address.port);
        } else {
          reject(new Error("Unable to allocate a local Lighthouse debugging port."));
        }
      });
    });
  });
}
