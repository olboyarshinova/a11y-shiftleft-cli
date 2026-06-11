import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Page } from "playwright";
import type {
  A11yConfig,
  ExplorationGraph,
  ExplorationState,
  ExploreAction,
  ExploreSafeModeConfig,
  ExploreSkippedAction,
  Issue
} from "../types.js";
import type { ElementBounds } from "../types.js";

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "[role='button']",
  "[role='menuitem']",
  "[role='tab']",
  "[role='switch']",
  "[aria-haspopup]",
  "details > summary",
  "[data-a11y-explore]"
].join(", ");

const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_STATES = 20;
const DEFAULT_MAX_ACTIONS_PER_STATE = 8;
const DEFAULT_WAIT_MS = 250;
const DEFAULT_SCREENSHOT_FORMAT = "jpeg";
const DEFAULT_SCREENSHOT_QUALITY = 70;
const SCREENSHOT_REDACTION_COLOR = "#111827";
const DANGEROUS_ACTION_PATTERN = /\b(delete|remove|destroy|logout|log out|sign out|submit|save|create|update|send|pay|payment|purchase|buy|checkout|confirm|удалить|выйти|отправить|сохранить|создать|обновить|купить|оплатить|оформить|подтвердить)\b/i;

export const SENSITIVE_SCREENSHOT_SELECTOR = [
  "[data-a11y-sensitive]",
  "[data-a11y-redact]",
  "[data-private]",
  "input[type='password']",
  "input[type='email']",
  "input[type='tel']",
  "input[autocomplete*='email' i]",
  "input[autocomplete*='password' i]",
  "input[autocomplete*='one-time-code' i]",
  "input[autocomplete*='cc-' i]",
  "input[autocomplete*='card' i]",
  "input[autocomplete*='tel' i]",
  "input[autocomplete*='address' i]",
  "input[autocomplete*='postal' i]",
  "input[name*='email' i]",
  "input[name*='password' i]",
  "input[name*='token' i]",
  "input[name*='secret' i]",
  "input[name*='card' i]",
  "input[name*='cvv' i]",
  "input[name*='cvc' i]",
  "input[name*='phone' i]",
  "input[name*='tel' i]",
  "input[name*='ssn' i]",
  "input[id*='email' i]",
  "input[id*='password' i]",
  "input[id*='token' i]",
  "input[id*='secret' i]",
  "input[id*='card' i]",
  "input[id*='cvv' i]",
  "input[id*='cvc' i]",
  "input[id*='phone' i]",
  "input[id*='tel' i]",
  "input[id*='ssn' i]",
  "textarea[name*='address' i]",
  "textarea[id*='address' i]"
].join(", ");

export type ScreenshotFormat = "jpeg" | "png";

interface ExplorePlaywrightOptions {
  url: string;
  outputDir: string;
  maxDepth?: number;
  maxStates?: number;
  maxActionsPerState?: number;
  screenshots?: boolean;
  screenshotFormat?: ScreenshotFormat;
  screenshotQuality?: number;
  screenshotFullPage?: boolean;
  screenshotRedaction?: boolean;
  safeMode?: ExploreSafeModeConfig;
  waitMs?: number;
  onProgress?: (event: ExploreProgressEvent) => void;
}

interface ExploreResult {
  issues: Issue[];
  graph: ExplorationGraph;
}

type ExploreProgressEvent =
  | { type: "state"; state: ExplorationState }
  | { type: "actions"; stateId: string; actionCount: number; skippedActionCount: number };

interface QueuedState {
  path: ExploreAction[];
  depth: number;
  parentId?: string;
  via?: ExploreAction;
}

interface PageFingerprint {
  fingerprint: string;
  url: string;
  title: string;
}

type RawExploreAction = Omit<ExploreAction, "id">;
type RawSkippedAction = Omit<ExploreSkippedAction, "stateId">;

interface ActionDiscoveryResult {
  actions: ExploreAction[];
  skipped: RawSkippedAction[];
}

interface ActionSafetyResult {
  safe: boolean;
  reason?: string;
}

export async function runExplorePlaywrightAdapter(
  config: A11yConfig,
  options: ExplorePlaywrightOptions
): Promise<ExploreResult> {
  const browser = await chromium.launch();
  const issues: Issue[] = [];
  const states: ExplorationState[] = [];
  const edges: ExplorationGraph["edges"] = [];
  const skippedActions: ExploreSkippedAction[] = [];
  const fingerprintToStateId = new Map<string, string>();
  const maxDepth = positiveOrDefault(options.maxDepth, DEFAULT_MAX_DEPTH);
  const maxStates = positiveOrDefault(options.maxStates, DEFAULT_MAX_STATES);
  const maxActionsPerState = positiveOrDefault(
    options.maxActionsPerState,
    DEFAULT_MAX_ACTIONS_PER_STATE
  );
  const screenshots = options.screenshots ?? true;
  const screenshotFormat = options.screenshotFormat || DEFAULT_SCREENSHOT_FORMAT;
  const screenshotQuality = normalizeScreenshotQuality(options.screenshotQuality);
  const screenshotRedaction = options.screenshotRedaction ?? true;
  const safeMode = normalizeSafeMode(options.safeMode || config.explore.safeMode);
  const waitMs = positiveOrDefault(options.waitMs, DEFAULT_WAIT_MS);
  let actionsTried = 0;
  let screenshotsSaved = 0;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    if (safeMode.enabled && safeMode.dismissDialogs) {
      page.on("dialog", async (dialog) => {
        await dialog.dismiss().catch(() => undefined);
      });
    }
    const queue: QueuedState[] = [{ path: [], depth: 0 }];
    const queuedPaths = new Set(["start"]);

    while (queue.length > 0 && states.length < maxStates) {
      const current = queue.shift();
      if (!current) continue;

      try {
        await replayPath(page, options.url, current.path, waitMs);
      } catch (error) {
        issues.push(createExploreErrorIssue(config, options.url, error, current.via));
        continue;
      }

      const pageState = await fingerprintPage(page);
      const existingId = fingerprintToStateId.get(pageState.fingerprint);

      if (existingId) {
        if (current.parentId && current.via) {
          edges.push({
            from: current.parentId,
            to: existingId,
            action: current.via
          });
          actionsTried += 1;
        }
        continue;
      }

      const stateId = `state-${states.length + 1}`;
      const actionLabel = current.via?.label || "Initial page";
      const screenshot = screenshots
        ? await captureStateScreenshot(page, {
          outputDir: options.outputDir,
          stateId,
          format: screenshotFormat,
          quality: screenshotQuality,
          fullPage: Boolean(options.screenshotFullPage),
          redactSensitiveFields: screenshotRedaction
        })
        : undefined;
      if (screenshot) screenshotsSaved += 1;

      const stateIssues = await scanState(config, page, {
        stateId,
        stateLabel: actionLabel,
        screenshot,
        screenshotFullPage: Boolean(options.screenshotFullPage)
      });
      issues.push(...stateIssues);

      const discovery = current.depth >= maxDepth
        ? { actions: [], skipped: [] }
        : await discoverSafeActions(page, pageState.url, maxActionsPerState, safeMode);
      const actions = discovery.actions;
      skippedActions.push(...discovery.skipped.map((action) => ({
        ...action,
        stateId
      })));
      const state: ExplorationState = {
        id: stateId,
        url: pageState.url,
        title: pageState.title || undefined,
        depth: current.depth,
        fingerprint: pageState.fingerprint,
        actionLabel,
        screenshot,
        issueCount: stateIssues.length,
        actionCount: actions.length
      };

      states.push(state);
      fingerprintToStateId.set(pageState.fingerprint, stateId);

      if (current.parentId && current.via) {
        edges.push({
          from: current.parentId,
          to: stateId,
          action: current.via
        });
        actionsTried += 1;
      }

      options.onProgress?.({ type: "state", state });
      options.onProgress?.({
        type: "actions",
        stateId,
        actionCount: actions.length,
        skippedActionCount: discovery.skipped.length
      });

      for (const action of actions) {
        const nextPath = [...current.path, action];
        const pathKey = nextPath.map((item) => item.id).join(">");
        if (queuedPaths.has(pathKey)) continue;
        if (current.depth + 1 > maxDepth) continue;
        if (states.length + queue.length >= maxStates) continue;

        queuedPaths.add(pathKey);
        queue.push({
          path: nextPath,
          depth: current.depth + 1,
          parentId: stateId,
          via: action
        });
      }
    }
  } finally {
    await browser.close();
  }

  return {
    issues,
    graph: {
      generatedAt: new Date().toISOString(),
      startUrl: options.url,
      states,
      edges,
      skippedActions,
      summary: {
        statesVisited: states.length,
        actionsTried,
        skippedActions: skippedActions.length,
        screenshots: screenshotsSaved,
        maxDepth,
        maxStates
      }
    }
  };
}

export async function writeExplorationGraph(
  outputDir: string,
  graph: ExplorationGraph
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "exploration-graph.json"),
    `${JSON.stringify(graph, null, 2)}\n`
  );
}

export function normalizeExploreUrl(candidate: string | undefined, baseUrl: string): string | null {
  if (!candidate) return null;

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

export function isSafeExploreAction(action: ExploreAction, baseUrl: string): boolean {
  return isSafeExploreActionWithConfig(action, baseUrl, defaultSafeMode());
}

export function isSafeExploreActionWithConfig(
  action: ExploreAction,
  baseUrl: string,
  safeMode: ExploreSafeModeConfig
): boolean {
  return getExploreActionSafety(action, baseUrl, safeMode).safe;
}

export function getExploreActionSafety(
  action: ExploreAction,
  baseUrl: string,
  safeMode: ExploreSafeModeConfig
): ActionSafetyResult {
  const searchable = [
    action.label,
    action.text,
    action.role,
    action.url
  ].filter(Boolean).join(" ");

  if (safeMode.enabled) {
    if (DANGEROUS_ACTION_PATTERN.test(searchable)) {
      return {
        safe: false,
        reason: "Matched built-in destructive or transactional action pattern."
      };
    }
    if (matchesAnyPattern(safeMode.blockedText, searchable)) {
      return {
        safe: false,
        reason: "Matched configured safe-mode blocked text pattern."
      };
    }
    if (action.role && matchesAnyPattern(safeMode.blockedRoles, action.role)) {
      return {
        safe: false,
        reason: "Matched configured safe-mode blocked role pattern."
      };
    }
    if (action.url && matchesAnyPattern(safeMode.blockedUrls, action.url)) {
      return {
        safe: false,
        reason: "Matched configured safe-mode blocked URL pattern."
      };
    }
    if (action.selector && matchesAnyPattern(safeMode.blockedSelectors, action.selector)) {
      return {
        safe: false,
        reason: "Matched configured safe-mode blocked selector pattern."
      };
    }
  }

  if (action.type === "navigate") {
    return normalizeExploreUrl(action.url, baseUrl)
      ? { safe: true }
      : {
        safe: false,
        reason: "Navigation target is external, unsupported, or invalid."
      };
  }

  return action.selector
    ? { safe: true }
    : {
      safe: false,
      reason: "Click action has no stable selector."
    };
}

async function replayPath(
  page: Page,
  startUrl: string,
  actions: ExploreAction[],
  waitMs: number
): Promise<void> {
  await gotoAndSettle(page, startUrl, waitMs);

  for (const action of actions) {
    if (action.type === "navigate" && action.url) {
      await gotoAndSettle(page, action.url, waitMs);
      continue;
    }

    if (!action.selector) continue;

    await page.locator(action.selector).first().click({
      timeout: 1500
    });
    await settle(page, waitMs);
  }
}

async function gotoAndSettle(page: Page, url: string, waitMs: number): Promise<void> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 15000
  });
  await settle(page, waitMs);
}

async function settle(page: Page, waitMs: number): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);
  await page.waitForTimeout(waitMs);
}

async function fingerprintPage(page: Page): Promise<PageFingerprint> {
  const snapshot = await page.evaluate(() => {
    const visibleText = document.body?.innerText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000) || "";
    const statefulElements = Array.from(document.querySelectorAll([
      "dialog[open]",
      "[role='dialog']",
      "[role='menu']",
      "[role='listbox']",
      "[aria-expanded='true']",
      "details[open]"
    ].join(", "))).map((element) => {
      const text = (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
      return `${element.tagName.toLowerCase()}:${text}`;
    });

    return {
      url: window.location.href,
      title: document.title,
      visibleText,
      statefulElements
    };
  });
  const input = JSON.stringify(snapshot);

  return {
    fingerprint: hash(input),
    url: normalizeExploreUrl(snapshot.url, snapshot.url) || snapshot.url,
    title: snapshot.title
  };
}

async function scanState(
  config: A11yConfig,
  page: Page,
  state: {
    stateId: string;
    stateLabel: string;
    screenshot?: string;
    screenshotFullPage: boolean;
  }
): Promise<Issue[]> {
  try {
    const results = await new AxeBuilder({ page }).analyze();
    const issues: Issue[] = [];

    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        const selector = node.target.join(" ");
        const elementBounds = state.screenshot
          ? await getElementBounds(page, selector, {
            fullPage: state.screenshotFullPage
          })
          : undefined;

        issues.push({
          source: "axe",
          framework: config.framework,
          ruleId: violation.id,
          impact: violation.impact || undefined,
          wcag: violation.tags.filter((tag: string) => tag.startsWith("wcag")),
          tags: violation.tags,
          selector,
          message: violation.help,
          url: page.url(),
          stateId: state.stateId,
          stateLabel: state.stateLabel,
          screenshot: state.screenshot,
          elementBounds
        });
      }
    }

    return issues;
  } catch (error) {
    return [createExploreErrorIssue(config, page.url(), error)];
  }
}

async function getElementBounds(
  page: Page,
  selector: string,
  options: {
    fullPage: boolean;
  }
): Promise<ElementBounds | undefined> {
  if (!selector) return undefined;

  try {
    if (options.fullPage) {
      const bounds = await page.evaluate((selectorText) => {
        const element = document.querySelector(selectorText);
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const doc = document.documentElement;
        const body = document.body;
        const documentWidth = Math.max(
          doc.scrollWidth,
          body?.scrollWidth || 0,
          window.innerWidth
        );
        const documentHeight = Math.max(
          doc.scrollHeight,
          body?.scrollHeight || 0,
          window.innerHeight
        );

        return {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
          containerWidth: documentWidth,
          containerHeight: documentHeight
        };
      }, selector);

      return toPercentBounds(bounds, "document");
    }

    const rect = await page.locator(selector).first().boundingBox({
      timeout: 500
    }).catch(() => null);
    const viewport = await page.evaluate(() => ({
      containerWidth: window.innerWidth,
      containerHeight: window.innerHeight
    }));

    return toPercentBounds(rect ? {
      ...rect,
      containerWidth: viewport.containerWidth,
      containerHeight: viewport.containerHeight
    } : null, "viewport");
  } catch {
    return undefined;
  }
}

function toPercentBounds(
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    containerWidth: number;
    containerHeight: number;
  } | null,
  coordinateSpace: ElementBounds["coordinateSpace"]
): ElementBounds | undefined {
  if (!rect) return undefined;
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  if (rect.containerWidth <= 0 || rect.containerHeight <= 0) return undefined;

  const x = clampPercent((rect.x / rect.containerWidth) * 100);
  const y = clampPercent((rect.y / rect.containerHeight) * 100);
  const right = clampPercent(((rect.x + rect.width) / rect.containerWidth) * 100);
  const bottom = clampPercent(((rect.y + rect.height) / rect.containerHeight) * 100);
  const width = roundPercent(Math.max(0, right - x));
  const height = roundPercent(Math.max(0, bottom - y));

  if (width <= 0 || height <= 0) return undefined;

  return {
    x: roundPercent(x),
    y: roundPercent(y),
    width,
    height,
    coordinateSpace
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function roundPercent(value: number): number {
  return Math.round(value * 1000) / 1000;
}

async function discoverSafeActions(
  page: Page,
  baseUrl: string,
  maxActions: number,
  safeMode: ExploreSafeModeConfig
): Promise<ActionDiscoveryResult> {
  const discovery = await page.$$eval(INTERACTIVE_SELECTOR, (elements, safeMode): {
    actions: RawExploreAction[];
    skipped: RawSkippedAction[];
  } => {
    function textOf(element: Element): string {
      return [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.textContent
      ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    }

    function isVisible(element: Element): boolean {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);

      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none";
    }

    function attrSelector(name: string, value: string): string {
      return `[${name}="${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"]`;
    }

    function selectorFor(element: Element): string {
      const testId = element.getAttribute("data-testid");
      if (testId) return attrSelector("data-testid", testId);

      const test = element.getAttribute("data-test");
      if (test) return attrSelector("data-test", test);

      const id = element.getAttribute("id");
      if (id) return attrSelector("id", id);

      const parts: string[] = [];
      let current: Element | null = element;

      while (current && current !== document.body && parts.length < 5) {
        const tag = current.tagName.toLowerCase();
        const parent: Element | null = current.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }

        const currentTag = current.tagName;
        const siblings = (Array.from(parent.children) as Element[])
          .filter((sibling) => sibling.tagName === currentTag);
        const index = siblings.indexOf(current) + 1;
        parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
        current = parent;
      }

      return parts.join(" > ");
    }

    function matchesSelectorList(element: Element, selectors: string[]): boolean {
      return selectors.some((selector) => {
        try {
          return element.matches(selector) || Boolean(element.closest(selector));
        } catch {
          return false;
        }
      });
    }

    function skippedAction(
      element: Element,
      reason: string,
      type: RawSkippedAction["type"] = "unknown"
    ): RawSkippedAction {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role") || tag;
      const text = textOf(element);
      const selector = selectorFor(element);
      const url = tag === "a" ? (element as HTMLAnchorElement).href : undefined;

      return {
        type,
        selector,
        url,
        label: text || role,
        text,
        role,
        reason
      };
    }

    const actions: RawExploreAction[] = [];
    const skipped: RawSkippedAction[] = [];

    for (const element of elements) {
      if (!isVisible(element)) {
        skipped.push(skippedAction(element, "Element is not visible."));
        continue;
      }
      if (element.closest("[data-a11y-skip], [aria-hidden='true']")) {
        skipped.push(skippedAction(element, "Element is marked with data-a11y-skip or hidden from assistive technology."));
        continue;
      }
      if (element.getAttribute("aria-disabled") === "true") {
        skipped.push(skippedAction(element, "Element is aria-disabled."));
        continue;
      }
      if ("disabled" in element && Boolean((element as HTMLButtonElement).disabled)) {
        skipped.push(skippedAction(element, "Element is disabled."));
        continue;
      }
      if (safeMode.enabled && matchesSelectorList(element, safeMode.blockedSelectors)) {
        skipped.push(skippedAction(element, "Matched configured safe-mode blocked selector."));
        continue;
      }

      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role") || tag;
      const text = textOf(element);
      const selector = selectorFor(element);
      const forcedExplore = matchesSelectorList(element, safeMode.allowedSelectors);

      if (tag === "a") {
        const anchor = element as HTMLAnchorElement;
        if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
          skipped.push(skippedAction(element, "Link opens a new tab/window or downloads a file.", "navigate"));
          continue;
        }

        actions.push({
          type: "navigate",
          selector,
          url: anchor.href,
          label: text ? `Navigate: ${text}` : `Navigate: ${anchor.href}`,
          text,
          role
        });
        continue;
      }

      const buttonType = element.getAttribute("type")?.toLowerCase();
      if (safeMode.enabled) {
        if ((buttonType === "submit" || buttonType === "reset") && !forcedExplore) {
          skipped.push(skippedAction(element, "Submit/reset controls are blocked by safe mode unless explicitly allowed.", "click"));
          continue;
        }
        if (tag === "button" && element.closest("form") && !forcedExplore) {
          skipped.push(skippedAction(element, "Form buttons are blocked by safe mode unless marked with data-a11y-explore.", "click"));
          continue;
        }
      }

      actions.push({
        type: "click",
        selector,
        label: text ? `Click: ${text}` : `Click: ${role}`,
        text,
        role
      });
    }

    return {
      actions,
      skipped
    };
  }, safeMode);

  const rawActions = discovery.actions;
  const skippedActions = [...discovery.skipped];
  const seenSkipped = new Set(skippedActions.map((action) => [
    action.type,
    action.selector,
    action.url,
    action.reason
  ].filter(Boolean).join("|")));

  const seen = new Set<string>();
  const actions: ExploreAction[] = [];

  for (const rawAction of rawActions) {
    const action: ExploreAction = {
      ...rawAction,
      url: rawAction.type === "navigate"
        ? normalizeExploreUrl(rawAction.url, baseUrl) || undefined
        : rawAction.url,
      id: hash([
        rawAction.type,
        rawAction.selector,
        rawAction.url,
        rawAction.label
      ].filter(Boolean).join("|"))
    };
    const key = `${action.type}:${action.selector || action.url}`;

    if (seen.has(key)) continue;

    const safety = getExploreActionSafety(action, baseUrl, safeMode);
    if (!safety.safe) {
      const skipped = toSkippedAction(action, safety.reason || "Action blocked by safe mode.");
      const skippedKey = [
        skipped.type,
        skipped.selector,
        skipped.url,
        skipped.reason
      ].filter(Boolean).join("|");
      if (!seenSkipped.has(skippedKey)) {
        seenSkipped.add(skippedKey);
        skippedActions.push(skipped);
      }
      continue;
    }

    seen.add(key);
    actions.push(action);
    if (actions.length >= maxActions) break;
  }

  return {
    actions,
    skipped: skippedActions
  };
}

function toSkippedAction(action: ExploreAction, reason: string): RawSkippedAction {
  return {
    type: action.type,
    selector: action.selector,
    url: action.url,
    label: action.label,
    text: action.text,
    role: action.role,
    reason
  };
}

async function captureStateScreenshot(
  page: Page,
  options: {
    outputDir: string;
    stateId: string;
    format: ScreenshotFormat;
    quality: number;
    fullPage: boolean;
    redactSensitiveFields: boolean;
  }
): Promise<string | undefined> {
  const screenshotsDir = path.join(options.outputDir, "screenshots");
  const extension = options.format === "jpeg" ? "jpg" : "png";
  const filename = `${options.stateId}.${extension}`;
  const screenshotPath = path.join(screenshotsDir, filename);

  await fs.mkdir(screenshotsDir, { recursive: true });
  const screenshotOptions: Parameters<Page["screenshot"]>[0] = {
    path: screenshotPath,
    fullPage: options.fullPage,
    type: options.format,
    ...(options.format === "jpeg" ? { quality: options.quality } : {})
  };

  if (options.redactSensitiveFields) {
    screenshotOptions.mask = [page.locator(SENSITIVE_SCREENSHOT_SELECTOR)];
    screenshotOptions.maskColor = SCREENSHOT_REDACTION_COLOR;
  }

  await page.screenshot(screenshotOptions);

  return path.posix.join("screenshots", filename);
}

function createExploreErrorIssue(
  config: A11yConfig,
  url: string,
  error: unknown,
  action?: ExploreAction
): Issue {
  const message = error instanceof Error ? error.message : String(error);
  const label = action ? ` after ${action.label}` : "";

  return {
    source: "axe",
    framework: config.framework,
    ruleId: "adapter/explore-scan-error",
    severity: "warning",
    url,
    message: `Exploration failed${label}: ${message}`
  };
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function normalizeScreenshotQuality(value: number | undefined): number {
  if (!Number.isInteger(value)) return DEFAULT_SCREENSHOT_QUALITY;
  return Math.min(100, Math.max(1, Number(value)));
}

function normalizeSafeMode(safeMode: ExploreSafeModeConfig | undefined): ExploreSafeModeConfig {
  const fallback = defaultSafeMode();

  return {
    enabled: safeMode?.enabled ?? fallback.enabled,
    blockedText: normalizePatterns(safeMode?.blockedText),
    blockedRoles: normalizePatterns(safeMode?.blockedRoles),
    blockedUrls: normalizePatterns(safeMode?.blockedUrls),
    blockedSelectors: normalizePatterns(safeMode?.blockedSelectors),
    allowedSelectors: normalizePatterns(safeMode?.allowedSelectors).length > 0
      ? normalizePatterns(safeMode?.allowedSelectors)
      : fallback.allowedSelectors,
    dismissDialogs: safeMode?.dismissDialogs ?? fallback.dismissDialogs
  };
}

function defaultSafeMode(): ExploreSafeModeConfig {
  return {
    enabled: true,
    blockedText: [],
    blockedRoles: [],
    blockedUrls: [],
    blockedSelectors: [],
    allowedSelectors: ["[data-a11y-explore]"],
    dismissDialogs: true
  };
}

function normalizePatterns(patterns: string[] | undefined): string[] {
  return [...new Set((patterns || [])
    .map((pattern) => pattern.trim())
    .filter(Boolean))];
}

function matchesAnyPattern(patterns: string[], value: string): boolean {
  return patterns.some((pattern) => matchesPattern(pattern, value));
}

function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  const escaped = pattern
    .split("*")
    .map(escapeRegExp)
    .join(".*");
  return new RegExp(escaped, "i").test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hash(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}
