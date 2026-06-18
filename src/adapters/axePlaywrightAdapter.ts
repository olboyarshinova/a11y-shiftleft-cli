import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { applyColorScheme, detectPageColorSchemes, normalizePageScrollConfig, scrollPageForLazyContent, type PageScrollConfig, type ScrollablePage } from "../core/pageScroll.js";
import { extractContrastEvidence } from "../core/contrast.js";
import { analyzePageTitles, type PageTitleObservation } from "../core/pageTitles.js";
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
  const pageTitles: PageTitleObservation[] = [];

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
        pageTitles.push({ url, title: await page.title() });
        const colorSchemes = await detectPageColorSchemes(page);
        const pageIssues: Issue[][] = [];

        for (const colorScheme of colorSchemes) {
          await applyColorScheme(page, colorScheme);
          await scrollPageForLazyContent(page, scroll);
          const results = await new AxeBuilder({ page }).analyze();
          const reportedColorScheme = colorSchemes.length > 1 ? colorScheme : undefined;
          const colorSchemeIssues: Issue[] = [];

          for (const violation of results.violations) {
            for (const node of violation.nodes) {
              colorSchemeIssues.push({
                source: "axe",
                framework: config.framework,
                ruleId: violation.id,
                impact: violation.impact || undefined,
                wcag: violation.tags.filter((tag: string) => tag.startsWith("wcag")),
                tags: violation.tags,
                selector: node.target.join(" "),
                contrast: extractContrastEvidence(violation.id, node),
                helpUrl: violation.helpUrl,
                colorScheme: reportedColorScheme,
                message: violation.help,
                url
              });
            }
          }

          pageIssues.push(colorSchemeIssues);
        }

        const mergedPageIssues = pageIssues.length === 2
          ? mergeEquivalentColorSchemeIssues(pageIssues[0], pageIssues[1])
          : pageIssues.flat();
        issues.push(...mergedPageIssues);
        options.onProgress?.({
          type: "scan-complete",
          url,
          scannedCount,
          totalUrls: scanUrls.length,
          issueCount: mergedPageIssues.length
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

    issues.push(...analyzePageTitles(pageTitles, config.framework));
  } finally {
    await browser.close();
  }

  return issues;
}

export function mergeEquivalentColorSchemeIssues(
  lightIssues: Issue[],
  darkIssues: Issue[]
): Issue[] {
  const darkByEvidence = new Map<string, Issue[]>();

  for (const issue of darkIssues) {
    const key = colorSchemeEvidenceKey(issue);
    const matches = darkByEvidence.get(key) || [];
    matches.push(issue);
    darkByEvidence.set(key, matches);
  }

  const merged: Issue[] = [];

  for (const lightIssue of lightIssues) {
    const key = colorSchemeEvidenceKey(lightIssue);
    const matches = darkByEvidence.get(key);
    const darkMatch = matches?.shift();

    if (darkMatch) {
      merged.push({ ...lightIssue, colorScheme: undefined });
      if (matches?.length === 0) darkByEvidence.delete(key);
    } else {
      merged.push(lightIssue);
    }
  }

  for (const remaining of darkByEvidence.values()) {
    merged.push(...remaining);
  }

  return merged;
}

function colorSchemeEvidenceKey(issue: Issue): string {
  return JSON.stringify([
    issue.source,
    issue.ruleId,
    issue.selector,
    issue.file,
    issue.line,
    issue.message,
    issue.impact,
    issue.contrast || null
  ]);
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
