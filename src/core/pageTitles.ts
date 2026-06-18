import type { Framework, Issue } from "../types.js";

export interface PageTitleObservation {
  url: string;
  title?: string;
}

const PLACEHOLDER_TITLE_PATTERN = /^(untitled(?: document)?|new page|react app|vite \+ react|vue app|angular app|next\.js app)$/i;

export function analyzePageTitles(
  observations: PageTitleObservation[],
  framework: Framework | string
): Issue[] {
  const pages = uniquePageTitles(observations);
  const issues: Issue[] = [];
  const titleToPages = new Map<string, PageTitleObservation[]>();

  for (const page of pages) {
    const title = cleanTitle(page.title);
    if (!title) continue;

    if (isPlaceholderPageTitle(title)) {
      issues.push(createTitleIssue({
        framework,
        ruleId: "page-title-placeholder",
        url: page.url,
        title,
        message: `Document title "${title}" looks like a framework or document placeholder. Replace it with a title that identifies this page.`
      }));
      continue;
    }

    const normalizedTitle = title.toLocaleLowerCase();
    const matchingPages = titleToPages.get(normalizedTitle) || [];
    matchingPages.push({ ...page, title });
    titleToPages.set(normalizedTitle, matchingPages);
  }

  for (const matchingPages of titleToPages.values()) {
    const distinctUrls = [...new Set(matchingPages.map((page) => page.url))];
    if (distinctUrls.length < 2) continue;

    const title = cleanTitle(matchingPages[0].title);
    for (const url of distinctUrls) {
      issues.push(createTitleIssue({
        framework,
        ruleId: "page-title-duplicate",
        url,
        title,
        message: `Document title "${title}" is shared by ${distinctUrls.length} distinct pages. Give each page a title that identifies its route or purpose.`
      }));
    }
  }

  return issues;
}

export function isPlaceholderPageTitle(title: string): boolean {
  return PLACEHOLDER_TITLE_PATTERN.test(cleanTitle(title));
}

function uniquePageTitles(observations: PageTitleObservation[]): PageTitleObservation[] {
  const seen = new Set<string>();
  const unique: PageTitleObservation[] = [];

  for (const observation of observations) {
    const url = normalizeObservedUrl(observation.url);
    const title = cleanTitle(observation.title);
    const key = `${url}\u0000${title.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push({ url, title });
  }

  return unique;
}

function normalizeObservedUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

function cleanTitle(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function createTitleIssue(options: {
  framework: Framework | string;
  ruleId: "page-title-duplicate" | "page-title-placeholder";
  url: string;
  title: string;
  message: string;
}): Issue {
  return {
    source: "orchestrator",
    framework: options.framework,
    ruleId: options.ruleId,
    wcag: ["2.4.2"],
    severity: "warning",
    confidence: "medium",
    confidenceScore: 80,
    confidenceReason: "The title comparison is deterministic, but whether titles sufficiently distinguish page purpose still requires human review.",
    category: "structure",
    selector: "title",
    url: options.url,
    message: options.message
  };
}
