import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { normalizePageScrollConfig, scrollPageForLazyContent, type PageScrollConfig, type ScrollablePage } from "../core/pageScroll.js";
import { extractContrastEvidence } from "../core/contrast.js";
import type { A11yConfig, Issue } from "../types.js";

interface CrawlQueueItem {
  url: string;
  depth: number;
}

export interface AxePlaywrightOptions {
  onProgress?: (event: AxeProgressEvent) => void;
}

export type AxeProgressEvent =
  | {
    type: "crawl";
    url: string;
    depth: number;
    discoveredCount: number;
    queuedCount: number;
    maxUrls: number;
  }
  | {
    type: "scan-start";
    url: string;
    scannedCount: number;
    totalUrls: number;
  }
  | {
    type: "scan-complete";
    url: string;
    scannedCount: number;
    totalUrls: number;
    issueCount: number;
  }
  | {
    type: "scan-error";
    url: string;
    scannedCount: number;
    totalUrls: number;
    message: string;
  };

export async function runAxePlaywrightAdapter(
  config: A11yConfig,
  options: AxePlaywrightOptions = {}
): Promise<Issue[]> {
  const browser = await chromium.launch();
  const issues: Issue[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const scroll = normalizePageScrollConfig(config.dynamic.scroll);
    const scanUrls = config.dynamic.crawl
      ? await crawlSameOriginUrls(page, config.dynamic.urls, {
        maxDepth: config.dynamic.crawlDepth,
        maxUrls: config.dynamic.crawlLimit,
        scroll,
        onProgress: options.onProgress
      })
      : uniqueUrls(config.dynamic.urls);

    config.dynamic.urls = scanUrls;

    for (const [index, url] of scanUrls.entries()) {
      const scannedCount = index + 1;

      try {
        options.onProgress?.({
          type: "scan-start",
          url,
          scannedCount,
          totalUrls: scanUrls.length
        });
        await page.goto(url, { waitUntil: "networkidle" });
        await scrollPageForLazyContent(page, scroll);
        const results = await new AxeBuilder({ page }).analyze();
        let issueCount = 0;

        for (const violation of results.violations) {
          for (const node of violation.nodes) {
            issueCount += 1;
            issues.push({
              source: "axe",
              framework: config.framework,
              ruleId: violation.id,
              impact: violation.impact || undefined,
              wcag: violation.tags.filter((tag: string) => tag.startsWith("wcag")),
              tags: violation.tags,
              selector: node.target.join(" "),
              contrast: extractContrastEvidence(violation.id, node),
              helpUrl: violation.helpUrl,
              message: violation.help,
              url
            });
          }
        }
        options.onProgress?.({
          type: "scan-complete",
          url,
          scannedCount,
          totalUrls: scanUrls.length,
          issueCount
        });
      } catch (error) {
        options.onProgress?.({
          type: "scan-error",
          url,
          scannedCount,
          totalUrls: scanUrls.length,
          message: error instanceof Error ? error.message : String(error)
        });
        issues.push(createScanErrorIssue(config, url, error));
      }
    }
  } finally {
    await browser.close();
  }

  return issues;
}

export async function crawlSameOriginUrls(
  page: {
    goto: (url: string, options: { waitUntil: "networkidle" }) => Promise<unknown>;
    $$eval: <T>(selector: string, pageFunction: (elements: HTMLAnchorElement[]) => T) => Promise<T>;
    evaluate?: unknown;
    waitForTimeout?: unknown;
  },
  startUrls: string[],
  options: {
    maxDepth: number;
    maxUrls: number;
    scroll?: PageScrollConfig;
    onProgress?: (event: AxeProgressEvent) => void;
  }
): Promise<string[]> {
  const normalizedStartUrls = uniqueUrls(startUrls);
  const queue: CrawlQueueItem[] = normalizedStartUrls.map((url) => ({ url, depth: 0 }));
  const visited = new Set<string>();
  const discovered: string[] = [];
  const maxDepth = Math.max(0, options.maxDepth);
  const maxUrls = Math.max(1, options.maxUrls);

  while (queue.length > 0 && discovered.length < maxUrls) {
    const current = queue.shift();
    if (!current || visited.has(current.url)) continue;

    visited.add(current.url);
    discovered.push(current.url);
    options.onProgress?.({
      type: "crawl",
      url: current.url,
      depth: current.depth,
      discoveredCount: discovered.length,
      queuedCount: queue.length,
      maxUrls
    });

    if (current.depth >= maxDepth) continue;

    let links: string[] = [];

    try {
      await page.goto(current.url, { waitUntil: "networkidle" });
      if (options.scroll && isScrollablePage(page)) {
        await scrollPageForLazyContent(page, options.scroll);
      }
      links = await page.$$eval("a[href]", (anchors) => anchors.map((anchor) => anchor.href));
    } catch {
      continue;
    }

    for (const link of links) {
      const normalized = normalizeSameOriginUrl(link, current.url);
      if (!normalized || visited.has(normalized)) continue;
      if (queue.some((item) => item.url === normalized)) continue;
      if (discovered.length + queue.length >= maxUrls) continue;

      queue.push({
        url: normalized,
        depth: current.depth + 1
      });
    }
  }

  return discovered;
}

function isScrollablePage(page: {
  evaluate?: unknown;
  waitForTimeout?: unknown;
}): page is ScrollablePage {
  return typeof page.evaluate === "function" && typeof page.waitForTimeout === "function";
}

export function normalizeSameOriginUrl(candidate: string, baseUrl: string): string | null {
  let url: URL;
  let base: URL;

  try {
    url = new URL(candidate, baseUrl);
    base = new URL(baseUrl);
  } catch {
    return null;
  }

  if (url.origin !== base.origin) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.hash = "";
  return url.href;
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls)];
}

function createScanErrorIssue(config: A11yConfig, url: string, error: unknown): Issue {
  const message = error instanceof Error ? error.message : String(error);

  return {
    source: "axe",
    framework: config.framework,
    ruleId: "adapter/axe-scan-error",
    severity: "warning",
    url,
    message: `Dynamic scan failed for ${url}: ${message}`
  };
}
