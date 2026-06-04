import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import type { A11yConfig, Issue } from "../types.js";

interface CrawlQueueItem {
  url: string;
  depth: number;
}

export async function runAxePlaywrightAdapter(config: A11yConfig): Promise<Issue[]> {
  const browser = await chromium.launch();
  const issues: Issue[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const scanUrls = config.dynamic.crawl
      ? await crawlSameOriginUrls(page, config.dynamic.urls, {
        maxDepth: config.dynamic.crawlDepth,
        maxUrls: config.dynamic.crawlLimit
      })
      : uniqueUrls(config.dynamic.urls);

    config.dynamic.urls = scanUrls;

    for (const url of scanUrls) {
      await page.goto(url, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).analyze();

      for (const violation of results.violations) {
        for (const node of violation.nodes) {
          issues.push({
            source: "axe",
            framework: config.framework,
            ruleId: violation.id,
            impact: violation.impact || undefined,
            wcag: violation.tags.filter((tag: string) => tag.startsWith("wcag")),
            tags: violation.tags,
            selector: node.target.join(" "),
            message: violation.help,
            url
          });
        }
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
  },
  startUrls: string[],
  options: {
    maxDepth: number;
    maxUrls: number;
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

    if (current.depth >= maxDepth) continue;

    let links: string[] = [];

    try {
      await page.goto(current.url, { waitUntil: "networkidle" });
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
