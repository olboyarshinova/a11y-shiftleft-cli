import type { Page } from "playwright";

export function normalizeHideElementSelectors(values: Array<string | undefined> | undefined): string[] {
  if (!values || values.length === 0) return [];

  const seen = new Set<string>();
  const selectors: string[] = [];

  for (const value of values) {
    if (!value) continue;
    for (const selector of value.split(",")) {
      const trimmed = selector.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      selectors.push(trimmed);
    }
  }

  return selectors;
}

export async function hidePageElements(page: Page, selectors: string[] | undefined): Promise<void> {
  const normalized = normalizeHideElementSelectors(selectors);
  if (normalized.length === 0) return;

  await page.addStyleTag({
    content: normalized.map((selector) => `${selector} { visibility: hidden !important; }`).join("\n")
  });
}
