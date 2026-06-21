import { createHash } from "node:crypto";
import { chromium, type Browser, type Page } from "playwright";
import { getDefaultExploreActionSafety, getExploreActionSafety } from "./explorePlaywrightAdapter.js";
import type { ElementBounds, ExploreAction, ExploreSafeModeConfig, Framework, Issue, KeyboardActivationAttempt, KeyboardActivationKey, KeyboardAuditResult, KeyboardFocusStep, KeyboardPageStateSnapshot } from "../types.js";

export interface KeyboardAuditOptions {
  url: string;
  framework: Framework;
  maxTabs?: number;
  activation?: boolean;
  maxActivations?: number;
  safeMode?: ExploreSafeModeConfig;
  waitMs?: number;
  onProgress?: (step: KeyboardFocusStep) => void;
}

type PageKeyboardSnapshot = Omit<KeyboardFocusStep, "index" | "direction">;
type RawKeyboardSnapshot = Omit<PageKeyboardSnapshot, "pageState"> & {
  pageState: Omit<KeyboardPageStateSnapshot, "id">;
  semanticState: string[];
};

export async function runKeyboardPlaywrightAdapter(options: KeyboardAuditOptions): Promise<KeyboardAuditResult> {
  const startedAt = Date.now();
  const maxTabs = normalizeMaxTabs(options.maxTabs);
  const browser = await chromium.launch();
  const issues: Issue[] = [];
  const steps: KeyboardFocusStep[] = [];
  const backwardSteps: KeyboardFocusStep[] = [];
  let focusableCount = 0;
  let completedCycle = false;
  let reverseOrderMatches: boolean | null = null;
  let focusableSelectors: string[] = [];
  let activationAttempts: KeyboardActivationAttempt[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(options.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    if (options.waitMs) await page.waitForTimeout(options.waitMs);

    const pageInventory = await collectKeyboardInventory(page);
    focusableCount = pageInventory.focusableCount;
    focusableSelectors = pageInventory.focusableSelectors;
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
    let consecutiveBodySteps = 0;
    let reportedFocusLoss = false;

    for (let index = 1; index <= maxTabs; index += 1) {
      await page.keyboard.press("Tab");
      const snapshot = await collectFocusedElement(page);
      if (!snapshot) continue;
      if (snapshot.tagName === "body") {
        consecutiveBodySteps += 1;
        if (steps.length > 0 && consecutiveBodySteps >= 2 && !reportedFocusLoss) {
          issues.push(createKeyboardIssue({
            framework: options.framework,
            url: options.url,
            ruleId: "keyboard-focus-lost",
            selector: "body",
            severity: "critical",
            message: "Keyboard focus remained on the document body after repeated Tab presses; later controls may be unreachable.",
            wcag: ["2.1.1", "2.4.3"]
          }));
          reportedFocusLoss = true;
        }
        continue;
      }
      consecutiveBodySteps = 0;

      const step = { ...snapshot, index, direction: "forward" as const };
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

    if (completedCycle) {
      const unreachableSelectors = findUnreachableFocusableSelectors(focusableSelectors, [...visited.keys()]);
      issues.push(...unreachableSelectors.slice(0, 10).map((selector) => createKeyboardIssue({
        framework: options.framework,
        url: options.url,
        ruleId: "keyboard-control-unreachable",
        selector,
        severity: "critical",
        message: `The focus cycle completed without reaching ${selector}. Verify its tabindex, disabled state, DOM order, and any enclosing inert or hidden state.`,
        wcag: ["2.1.1"]
      })));
    }

    const forwardOrder = uniqueSelectors(steps);
    if (completedCycle && forwardOrder.length === focusableCount && forwardOrder.length > 0) {
      const firstSelector = forwardOrder[0];

      for (let index = 1; index <= maxTabs; index += 1) {
        await page.keyboard.press("Shift+Tab");
        const snapshot = await collectFocusedElement(page);
        if (!snapshot || snapshot.tagName === "body") continue;

        const step = { ...snapshot, index, direction: "backward" as const };
        backwardSteps.push(step);
        options.onProgress?.(step);
        issues.push(...issuesForFocusStep(step, options.framework, options.url));

        if (snapshot.selector === firstSelector) break;
        if (backwardSteps.slice(0, -1).some((item) => item.selector === snapshot.selector)) break;
      }

      const backwardOrder = uniqueSelectors(backwardSteps);
      reverseOrderMatches = compareFocusPaths(forwardOrder, backwardOrder);

      if (backwardOrder.length === 0) {
        issues.push(createKeyboardIssue({
          framework: options.framework,
          url: options.url,
          ruleId: "keyboard-reverse-focus-not-reached",
          selector: firstSelector,
          severity: "critical",
          message: "Shift+Tab did not move focus backward after a complete forward focus cycle.",
          wcag: ["2.1.1", "2.4.3"]
        }));
      } else if (!reverseOrderMatches) {
        issues.push(createKeyboardIssue({
          framework: options.framework,
          url: options.url,
          ruleId: "keyboard-reverse-order-mismatch",
          selector: backwardOrder[0],
          severity: "warning",
          message: "The Shift+Tab path does not mirror the completed forward Tab order; review focus order and one-way traps.",
          wcag: ["2.4.3"]
        }));
      }
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

    if (options.activation) {
      const activationResult = await runKeyboardActivationAudit(browser, {
        url: options.url,
        framework: options.framework,
        steps,
        maxActivations: normalizeMaxActivations(options.maxActivations),
        safeMode: options.safeMode,
        waitMs: options.waitMs || 0
      });
      activationAttempts = activationResult.attempts;
      issues.push(...activationResult.issues);
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
    backwardSteps,
    reverseOrderMatches,
    activationEnabled: Boolean(options.activation),
    maxActivations: normalizeMaxActivations(options.maxActivations),
    activationAttempts,
    issues
  };
}

export function compareFocusPaths(forwardOrder: string[], backwardOrder: string[]): boolean {
  if (forwardOrder.length === 0 || backwardOrder.length !== forwardOrder.length) return false;
  const expected = [...forwardOrder].reverse();
  return expected.every((selector, index) => selector === backwardOrder[index]);
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
  focusableSelectors: string[];
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
      focusableSelectors: focusable.map(cssSelector),
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

export function findUnreachableFocusableSelectors(inventory: string[], visited: string[]): string[] {
  const visitedSet = new Set(visited);
  return [...new Set(inventory)].filter((selector) => !visitedSet.has(selector));
}

async function collectFocusedElement(page: Page): Promise<PageKeyboardSnapshot | null> {
  const snapshot = await page.evaluate((): RawKeyboardSnapshot | null => {
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
      } : undefined,
      pageState: {
        url: location.href,
        title: document.title,
        heading: document.querySelector("h1")?.textContent?.trim() || "",
        scrollX: Math.round(scrollX),
        scrollY: Math.round(scrollY),
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        openDialogs: new Set([
          ...document.querySelectorAll("dialog[open]"),
          ...document.querySelectorAll('[role="dialog"]:not([aria-hidden="true"])')
        ]).size,
        expandedControls: document.querySelectorAll('[aria-expanded="true"]').length
      },
      semanticState: Array.from(document.querySelectorAll<HTMLElement>(
        'dialog[open], [role="dialog"]:not([aria-hidden="true"]), [aria-expanded="true"], [aria-selected="true"], [aria-pressed="true"]'
      )).map((target) => [
        cssSelector(target),
        target.getAttribute("role") || target.tagName.toLowerCase(),
        target.getAttribute("aria-expanded") || "",
        target.getAttribute("aria-selected") || "",
        target.getAttribute("aria-pressed") || "",
        accessibleName(target)
      ].join("|"))
    };

    function accessibleName(target: HTMLElement): string {
      const labelledBy = target.getAttribute("aria-labelledby");
      if (labelledBy) {
        const label = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
        if (label) return label;
      }
      const associatedLabels = "labels" in target
        ? Array.from((target as HTMLInputElement).labels || []).map((label) => label.textContent || "").join(" ").trim()
        : "";
      const inputType = target instanceof HTMLInputElement ? target.type : "";
      const buttonValue = target instanceof HTMLInputElement && ["button", "submit", "reset"].includes(inputType)
        ? target.value
        : "";
      return target.getAttribute("aria-label")
        || associatedLabels
        || target.getAttribute("alt")
        || buttonValue
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
      if (tag === "input") {
        const type = (target as HTMLInputElement).type;
        if (type === "checkbox") return "checkbox";
        if (type === "radio") return "radio";
        if (["button", "submit", "reset", "image"].includes(type)) return "button";
        if (type === "range") return "slider";
        if (type === "number") return "spinbutton";
        return "textbox";
      }
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

  if (!snapshot) return null;
  const { semanticState, ...focusSnapshot } = snapshot;
  return {
    ...focusSnapshot,
    pageState: {
      ...focusSnapshot.pageState,
      id: createKeyboardStateId(focusSnapshot.pageState, semanticState)
    }
  };
}

export function createKeyboardStateId(
  state: Omit<KeyboardPageStateSnapshot, "id">,
  semanticState: string[] = []
): string {
  const signature = JSON.stringify({
    url: state.url,
    title: state.title,
    heading: state.heading,
    scrollX: state.scrollX,
    scrollY: state.scrollY,
    viewportWidth: state.viewportWidth,
    viewportHeight: state.viewportHeight,
    openDialogs: state.openDialogs,
    expandedControls: state.expandedControls,
    semanticState: [...semanticState].sort()
  });
  return `state-${createHash("sha256").update(signature).digest("hex").slice(0, 10)}`;
}

interface KeyboardActivationAuditOptions {
  url: string;
  framework: Framework;
  steps: KeyboardFocusStep[];
  maxActivations: number;
  waitMs: number;
  safeMode?: ExploreSafeModeConfig;
}

export interface ActivationTargetMetadata {
  tagName: string;
  inputType: string;
  buttonType: string;
  inForm: boolean;
  disabled: boolean;
  href: string;
  ariaExpanded: string;
  ariaSelected: string;
  ariaPressed: string;
}

interface ActivationControlState {
  checked: boolean | null;
  ariaExpanded: string;
  ariaSelected: string;
  ariaPressed: string;
  openDialogs: number;
}

async function runKeyboardActivationAudit(
  browser: Browser,
  options: KeyboardActivationAuditOptions
): Promise<{ attempts: KeyboardActivationAttempt[]; issues: Issue[] }> {
  const candidates = uniqueActivationCandidates(options.steps).slice(0, options.maxActivations);
  const attempts: KeyboardActivationAttempt[] = [];
  const issues: Issue[] = [];

  for (const candidate of candidates) {
    const activationContext = await browser.newContext();
    const page = await activationContext.newPage();
    let initialLoadComplete = false;

    try {
      page.on("dialog", (dialog) => dialog.dismiss().catch(() => undefined));
      await page.route("**/*", async (route) => {
        if (!initialLoadComplete) return route.continue();
        const request = route.request();
        if (request.isNavigationRequest() || ["xhr", "fetch", "websocket", "eventsource"].includes(request.resourceType())) {
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
      if (options.waitMs > 0) await page.waitForTimeout(options.waitMs);
      initialLoadComplete = true;

      const locator = page.locator(candidate.step.selector).first();
      if (await locator.count() === 0) {
        attempts.push(toActivationAttempt(candidate, "target-missing", "The target was not present in the isolated initial page state."));
        continue;
      }

      const metadata = await locator.evaluate((element): ActivationTargetMetadata => {
        const htmlElement = element as HTMLElement;
        return {
          tagName: htmlElement.tagName.toLowerCase(),
          inputType: element instanceof HTMLInputElement ? element.type : "",
          buttonType: element instanceof HTMLButtonElement ? element.type : "",
          inForm: Boolean(htmlElement.closest("form")),
          disabled: "disabled" in htmlElement && Boolean((htmlElement as HTMLButtonElement).disabled),
          href: element instanceof HTMLAnchorElement ? element.href : "",
          ariaExpanded: htmlElement.getAttribute("aria-expanded") || "",
          ariaSelected: htmlElement.getAttribute("aria-selected") || "",
          ariaPressed: htmlElement.getAttribute("aria-pressed") || ""
        };
      });
      const safety = getKeyboardActivationSafety(candidate.step, metadata, options.url, options.safeMode);
      if (!safety.safe) {
        attempts.push(toActivationAttempt(candidate, "skipped", safety.reason || "Blocked by keyboard safe mode."));
        continue;
      }

      await locator.focus();
      const beforeFocus = await collectFocusedElement(page);
      const beforeControl = await collectActivationControlState(locator);
      await page.keyboard.press(candidate.key);
      await page.waitForTimeout(150);
      const afterFocus = await collectFocusedElement(page);
      const afterControl = await collectActivationControlState(locator).catch(() => null);
      const changed = Boolean(
        beforeFocus?.pageState.id !== afterFocus?.pageState.id ||
        beforeFocus?.selector !== afterFocus?.selector ||
        JSON.stringify(beforeControl) !== JSON.stringify(afterControl)
      );

      attempts.push({
        selector: candidate.step.selector,
        role: candidate.step.role || candidate.step.tagName,
        key: candidate.key,
        outcome: changed ? "changed" : "no-observable-change",
        beforeStateId: beforeFocus?.pageState.id,
        afterStateId: afterFocus?.pageState.id,
        focusAfter: afterFocus?.selector
      });

      if (!changed && expectsObservableActivation(candidate.step, metadata, candidate.key)) {
        issues.push(createKeyboardIssue({
          framework: options.framework,
          url: options.url,
          ruleId: "keyboard-activation-no-effect",
          selector: candidate.step.selector,
          severity: "warning",
          message: `${candidate.key} produced no observable state or focus change for this ${candidate.step.role || candidate.step.tagName}; verify its documented keyboard interaction.`,
          wcag: ["2.1.1"]
        }));
      }
    } catch (error) {
      attempts.push(toActivationAttempt(candidate, "error", error instanceof Error ? error.message : String(error)));
    } finally {
      await activationContext.close();
    }
  }

  return { attempts, issues };
}

export function activationKeysForStep(step: Pick<KeyboardFocusStep, "tagName" | "role" | "pageState">): KeyboardActivationKey[] {
  const role = step.role.toLowerCase();
  if (step.pageState.openDialogs > 0) return ["Escape"];
  if (role === "checkbox" || role === "switch") return ["Space"];
  if (role === "radio") return ["Space", "ArrowRight"];
  if (role === "tab") return ["ArrowRight", "ArrowLeft"];
  if (role === "combobox" || role === "listbox") return ["ArrowDown", "Escape"];
  if (role === "button" || step.tagName === "button" || step.tagName === "summary") return ["Enter", "Space"];
  if (role === "menuitem") return ["Enter"];
  return [];
}

function uniqueActivationCandidates(steps: KeyboardFocusStep[]): Array<{ step: KeyboardFocusStep; key: KeyboardActivationKey }> {
  const candidates = steps.flatMap((step) => activationKeysForStep(step).map((key) => ({ step, key })));
  return [...new Map(candidates.map((candidate) => [`${candidate.step.selector}::${candidate.key}`, candidate])).values()];
}

export function getKeyboardActivationSafety(
  step: KeyboardFocusStep,
  metadata: ActivationTargetMetadata,
  baseUrl: string,
  safeMode?: ExploreSafeModeConfig
): { safe: boolean; reason?: string } {
  if (metadata.disabled) return { safe: false, reason: "Disabled controls are not activated." };
  if (metadata.href || step.tagName === "a" || step.role === "link") {
    return { safe: false, reason: "Links and navigation controls are not activated in keyboard safe mode." };
  }
  if (
    metadata.inputType === "file" ||
    (metadata.inForm && ["submit", "reset"].includes(metadata.buttonType)) ||
    (metadata.inForm && ["submit", "reset", "image"].includes(metadata.inputType))
  ) {
    return { safe: false, reason: "File, submit, and reset controls are blocked in keyboard safe mode." };
  }

  const action: ExploreAction = {
    id: `keyboard-${step.selector}`,
    type: "click",
    selector: step.selector,
    label: step.accessibleName,
    text: step.accessibleName,
    role: step.role || step.tagName
  };
  return safeMode
    ? getExploreActionSafety(action, baseUrl, safeMode)
    : getDefaultExploreActionSafety(action, baseUrl);
}

function expectsObservableActivation(
  step: KeyboardFocusStep,
  metadata: ActivationTargetMetadata,
  key: KeyboardActivationKey
): boolean {
  const role = step.role.toLowerCase();
  if (["checkbox", "switch", "radio", "tab", "combobox", "listbox"].includes(role)) return true;
  if (key === "Escape" && step.pageState.openDialogs > 0) return true;
  return Boolean(metadata.ariaExpanded || metadata.ariaSelected || metadata.ariaPressed);
}

async function collectActivationControlState(locator: ReturnType<Page["locator"]>): Promise<ActivationControlState> {
  return locator.evaluate((element): ActivationControlState => {
    const htmlElement = element as HTMLElement;
    return {
      checked: element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
        ? element.checked
        : null,
      ariaExpanded: htmlElement.getAttribute("aria-expanded") || "",
      ariaSelected: htmlElement.getAttribute("aria-selected") || "",
      ariaPressed: htmlElement.getAttribute("aria-pressed") || "",
      openDialogs: new Set([
        ...document.querySelectorAll("dialog[open]"),
        ...document.querySelectorAll('[role="dialog"]:not([aria-hidden="true"])')
      ]).size
    };
  });
}

function toActivationAttempt(
  candidate: { step: KeyboardFocusStep; key: KeyboardActivationKey },
  outcome: KeyboardActivationAttempt["outcome"],
  reason: string
): KeyboardActivationAttempt {
  return {
    selector: candidate.step.selector,
    role: candidate.step.role || candidate.step.tagName,
    key: candidate.key,
    outcome,
    reason
  };
}

function normalizeMaxTabs(value = 40): number {
  return Math.max(1, Math.min(200, Math.trunc(value)));
}

function normalizeMaxActivations(value = 6): number {
  return Math.max(1, Math.min(20, Math.trunc(value)));
}

function uniqueSelectors(steps: KeyboardFocusStep[]): string[] {
  return [...new Set(steps.map((step) => step.selector))];
}
