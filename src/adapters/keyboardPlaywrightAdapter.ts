import { chromium, type Page } from "playwright";
import type { ElementBounds, Framework, Issue, KeyboardAuditResult, KeyboardFocusStep } from "../types.js";

export interface KeyboardAuditOptions {
  url: string;
  framework: Framework;
  maxTabs?: number;
  waitMs?: number;
  onProgress?: (step: KeyboardFocusStep) => void;
}

interface PageKeyboardSnapshot extends Omit<KeyboardFocusStep, "index"> {}

export async function runKeyboardPlaywrightAdapter(options: KeyboardAuditOptions): Promise<KeyboardAuditResult> {
  const startedAt = Date.now();
  const maxTabs = normalizeMaxTabs(options.maxTabs);
  const browser = await chromium.launch();
  const issues: Issue[] = [];
  const steps: KeyboardFocusStep[] = [];
  let focusableCount = 0;
  let completedCycle = false;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(options.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    if (options.waitMs) await page.waitForTimeout(options.waitMs);

    const pageInventory = await collectKeyboardInventory(page);
    focusableCount = pageInventory.focusableCount;
    issues.push(...pageInventory.positiveTabIndexes.map((item) => createKeyboardIssue({
      framework: options.framework,
      url: options.url,
      ruleId: "keyboard-positive-tabindex",
      selector: item.selector,
      severity: "warning",
      message: `Positive tabindex ${item.tabIndex} can create an unexpected keyboard focus order.`,
      wcag: ["2.4.3"]
    })));

    const visited = new Map<string, number>();
    let previousSelector = "";

    for (let index = 1; index <= maxTabs; index += 1) {
      await page.keyboard.press("Tab");
      const snapshot = await collectFocusedElement(page);
      if (!snapshot || snapshot.tagName === "body") continue;

      const step = { ...snapshot, index };
      steps.push(step);
      options.onProgress?.(step);

      if (snapshot.selector === previousSelector && snapshot.tagName === "iframe") break;

      if (snapshot.selector === previousSelector && focusableCount > 1) {
        issues.push(createKeyboardIssue({
          framework: options.framework,
          url: options.url,
          ruleId: "keyboard-focus-stuck",
          selector: snapshot.selector,
          severity: "critical",
          message: "Keyboard focus did not advance after Tab; review this control for a keyboard trap.",
          wcag: ["2.1.2"]
        }));
        break;
      }

      if (visited.has(snapshot.selector)) {
        completedCycle = true;
        if (visited.size < focusableCount) {
          issues.push(createKeyboardIssue({
            framework: options.framework,
            url: options.url,
            ruleId: "keyboard-focus-cycle",
            selector: snapshot.selector,
            severity: "warning",
            message: `Focus repeated after ${visited.size} unique controls while ${focusableCount} focusable controls were detected; review reachability and trap behavior.`,
            wcag: ["2.1.2", "2.4.3"]
          }));
        }
        break;
      }

      visited.set(snapshot.selector, index);
      previousSelector = snapshot.selector;
      issues.push(...issuesForFocusStep(step, options.framework, options.url));
    }

    if (focusableCount > 0 && steps.length === 0) {
      issues.push(createKeyboardIssue({
        framework: options.framework,
        url: options.url,
        ruleId: "keyboard-focus-not-reached",
        selector: "html",
        severity: "critical",
        message: `${focusableCount} focusable controls were detected, but Tab did not move focus into the page.`,
        wcag: ["2.1.1"]
      }));
    }
  } finally {
    await browser.close();
  }

  return {
    url: options.url,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    maxTabs,
    focusableCount,
    completedCycle,
    steps,
    issues
  };
}

export function issuesForFocusStep(step: KeyboardFocusStep, framework: Framework, url: string): Issue[] {
  const issues: Issue[] = [];

  if (!step.visible) {
    issues.push(createKeyboardIssue({
      framework,
      url,
      ruleId: "keyboard-focus-not-visible",
      selector: step.selector,
      severity: "critical",
      message: "Keyboard focus moved to an element that is not visibly rendered in the viewport.",
      wcag: ["2.4.7", "2.4.11"]
    }));
  } else if (step.obscured) {
    issues.push(createKeyboardIssue({
      framework,
      url,
      ruleId: "keyboard-focus-obscured",
      selector: step.selector,
      severity: "warning",
      message: "The focused element appears to be obscured by another rendered element.",
      wcag: ["2.4.11"]
    }));
  }

  if (step.focusVisible && !step.indicatorVisible) {
    issues.push(createKeyboardIssue({
      framework,
      url,
      ruleId: "keyboard-focus-indicator-missing",
      selector: step.selector,
      severity: "warning",
      message: "No outline or box-shadow focus indicator was detected; verify any custom visual focus treatment.",
      wcag: ["2.4.7"]
    }));
  }

  return issues;
}

function createKeyboardIssue(input: {
  framework: Framework;
  url: string;
  ruleId: string;
  selector: string;
  severity: "critical" | "warning";
  message: string;
  wcag: string[];
}): Issue {
  return {
    source: "keyboard",
    framework: input.framework,
    ruleId: input.ruleId,
    severity: input.severity,
    wcag: input.wcag,
    selector: input.selector,
    url: input.url,
    confidence: "medium",
    confidenceScore: 75,
    confidenceReason: "Observed during a bounded Playwright keyboard focus traversal; complex interaction semantics still require manual review.",
    message: input.message
  };
}

async function collectKeyboardInventory(page: Page): Promise<{
  focusableCount: number;
  positiveTabIndexes: Array<{ selector: string; tabIndex: number }>;
}> {
  return page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      "a[href], area[href], button, input, select, textarea, iframe, summary, audio[controls], video[controls], [contenteditable], [tabindex]"
    ));
    const focusable = candidates.filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const disabled = "disabled" in element && Boolean((element as HTMLButtonElement).disabled);
      return !disabled && !element.closest("[inert]") && element.tabIndex >= 0 && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });

    return {
      focusableCount: focusable.length,
      positiveTabIndexes: focusable
        .filter((element) => element.tabIndex > 0)
        .map((element) => ({ selector: cssSelector(element), tabIndex: element.tabIndex }))
    };

    function cssSelector(element: HTMLElement): string {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts: string[] = [];
      let current: HTMLElement | null = element;
      while (current && current !== document.body) {
        const siblings = current.parentElement
          ? Array.from(current.parentElement.children).filter((item) => item.tagName === current?.tagName)
          : [];
        const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : "";
        parts.unshift(`${current.tagName.toLowerCase()}${suffix}`);
        current = current.parentElement;
      }
      return parts.join(" > ") || element.tagName.toLowerCase();
    }
  });
}

async function collectFocusedElement(page: Page): Promise<PageKeyboardSnapshot | null> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const focusVisible = element.matches(":focus-visible");
    const outlineWidth = Number.parseFloat(style.outlineWidth || "0");
    const indicatorVisible = (style.outlineStyle !== "none" && outlineWidth > 0) || style.boxShadow !== "none";
    const centerX = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
    const centerY = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
    const topElement = document.elementFromPoint(centerX, centerY);
    const obscured = Boolean(topElement && topElement !== element && !element.contains(topElement) && !topElement.contains(element));

    return {
      selector: cssSelector(element),
      tagName: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || implicitRole(element),
      accessibleName: accessibleName(element),
      tabIndex: element.tabIndex,
      visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth,
      focusVisible,
      indicatorVisible,
      obscured,
      bounds: rect.width > 0 && rect.height > 0 ? {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        coordinateSpace: "viewport" as const
      } : undefined
    };

    function accessibleName(target: HTMLElement): string {
      const labelledBy = target.getAttribute("aria-labelledby");
      if (labelledBy) {
        const label = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
        if (label) return label;
      }
      return target.getAttribute("aria-label")
        || target.getAttribute("alt")
        || (target as HTMLInputElement).value
        || target.textContent?.trim()
        || target.getAttribute("title")
        || "";
    }

    function implicitRole(target: HTMLElement): string {
      const tag = target.tagName.toLowerCase();
      if (tag === "a" && target.hasAttribute("href")) return "link";
      if (tag === "button") return "button";
      if (tag === "select") return "combobox";
      if (tag === "textarea") return "textbox";
      if (tag === "input") return (target as HTMLInputElement).type === "checkbox" ? "checkbox" : "textbox";
      return "";
    }

    function cssSelector(target: HTMLElement): string {
      if (target.id) return `#${CSS.escape(target.id)}`;
      const parts: string[] = [];
      let current: HTMLElement | null = target;
      while (current && current !== document.body) {
        const siblings = current.parentElement
          ? Array.from(current.parentElement.children).filter((item) => item.tagName === current?.tagName)
          : [];
        const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : "";
        parts.unshift(`${current.tagName.toLowerCase()}${suffix}`);
        current = current.parentElement;
      }
      return parts.join(" > ") || target.tagName.toLowerCase();
    }
  });
}

function normalizeMaxTabs(value = 40): number {
  return Math.max(1, Math.min(200, Math.trunc(value)));
}
