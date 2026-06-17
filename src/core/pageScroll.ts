export const DEFAULT_PAGE_SCROLL_CONFIG: PageScrollConfig = {
  enabled: true,
  stepPx: 800,
  maxSteps: 25,
  waitMs: 100
};

export interface PageScrollConfig {
  enabled: boolean;
  stepPx: number;
  maxSteps: number;
  waitMs: number;
}

export interface PageScrollResult {
  enabled: boolean;
  steps: number;
  reachedBottom: boolean;
  initialScrollHeight: number;
  finalScrollHeight: number;
}

interface ScrollMetrics {
  scrollY: number;
  viewportHeight: number;
  scrollHeight: number;
}

export interface ScrollablePage {
  evaluate<T>(pageFunction: () => T | Promise<T>): Promise<T>;
  evaluate<T, Arg>(pageFunction: (arg: Arg) => T | Promise<T>, arg: Arg): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
}

export function normalizePageScrollConfig(config?: Partial<PageScrollConfig>): PageScrollConfig {
  return {
    enabled: config?.enabled ?? DEFAULT_PAGE_SCROLL_CONFIG.enabled,
    stepPx: positiveOrDefault(config?.stepPx, DEFAULT_PAGE_SCROLL_CONFIG.stepPx),
    maxSteps: positiveOrDefault(config?.maxSteps, DEFAULT_PAGE_SCROLL_CONFIG.maxSteps),
    waitMs: nonNegativeOrDefault(config?.waitMs, DEFAULT_PAGE_SCROLL_CONFIG.waitMs)
  };
}

export async function scrollPageForLazyContent(
  page: ScrollablePage,
  config?: Partial<PageScrollConfig>
): Promise<PageScrollResult> {
  const scroll = normalizePageScrollConfig(config);
  const initial = await readScrollMetrics(page);

  if (!scroll.enabled) {
    return {
      enabled: false,
      steps: 0,
      reachedBottom: isAtBottom(initial),
      initialScrollHeight: initial.scrollHeight,
      finalScrollHeight: initial.scrollHeight
    };
  }

  let current = initial;
  let steps = 0;

  while (steps < scroll.maxSteps && !isAtBottom(current)) {
    const maxY = Math.max(0, current.scrollHeight - current.viewportHeight);
    const nextY = Math.min(maxY, current.scrollY + scroll.stepPx);

    if (nextY <= current.scrollY && isAtBottom(current)) break;
    if (nextY === current.scrollY && current.scrollHeight <= current.viewportHeight) break;

    await page.evaluate((targetY) => {
      window.scrollTo(0, targetY);
    }, nextY);
    steps += 1;

    if (scroll.waitMs > 0) {
      await page.waitForTimeout(scroll.waitMs);
    }

    current = await readScrollMetrics(page);
  }

  const final = current;
  await page.evaluate((targetY) => {
    window.scrollTo(0, targetY);
  }, 0);

  if (scroll.waitMs > 0) {
    await page.waitForTimeout(scroll.waitMs);
  }

  return {
    enabled: true,
    steps,
    reachedBottom: isAtBottom(final),
    initialScrollHeight: initial.scrollHeight,
    finalScrollHeight: final.scrollHeight
  };
}

async function readScrollMetrics(page: ScrollablePage): Promise<ScrollMetrics> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;

    return {
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      scrollHeight: Math.max(
        doc?.scrollHeight || 0,
        body?.scrollHeight || 0,
        window.innerHeight
      )
    };
  });
}

function isAtBottom(metrics: ScrollMetrics): boolean {
  return metrics.scrollY + metrics.viewportHeight >= metrics.scrollHeight - 2;
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function nonNegativeOrDefault(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
}
