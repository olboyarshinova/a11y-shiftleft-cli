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
  Issue
} from "../types.js";

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
const DANGEROUS_ACTION_PATTERN = /\b(delete|remove|destroy|logout|log out|sign out|submit|save|create|update|send|pay|payment|purchase|buy|checkout|confirm|удалить|выйти|отправить|сохранить|создать|обновить|купить|оплатить|оформить|подтвердить)\b/i;

interface ExplorePlaywrightOptions {
  url: string;
  outputDir: string;
  maxDepth?: number;
  maxStates?: number;
  maxActionsPerState?: number;
  screenshots?: boolean;
  waitMs?: number;
  onProgress?: (event: ExploreProgressEvent) => void;
}

interface ExploreResult {
  issues: Issue[];
  graph: ExplorationGraph;
}

type ExploreProgressEvent =
  | { type: "state"; state: ExplorationState }
  | { type: "actions"; stateId: string; actionCount: number };

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

export async function runExplorePlaywrightAdapter(
  config: A11yConfig,
  options: ExplorePlaywrightOptions
): Promise<ExploreResult> {
  const browser = await chromium.launch();
  const issues: Issue[] = [];
  const states: ExplorationState[] = [];
  const edges: ExplorationGraph["edges"] = [];
  const fingerprintToStateId = new Map<string, string>();
  const maxDepth = positiveOrDefault(options.maxDepth, DEFAULT_MAX_DEPTH);
  const maxStates = positiveOrDefault(options.maxStates, DEFAULT_MAX_STATES);
  const maxActionsPerState = positiveOrDefault(
    options.maxActionsPerState,
    DEFAULT_MAX_ACTIONS_PER_STATE
  );
  const screenshots = options.screenshots ?? true;
  const waitMs = positiveOrDefault(options.waitMs, DEFAULT_WAIT_MS);
  let actionsTried = 0;
  let screenshotsSaved = 0;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
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
        ? await captureStateScreenshot(page, options.outputDir, stateId)
        : undefined;
      if (screenshot) screenshotsSaved += 1;

      const stateIssues = await scanState(config, page, {
        stateId,
        stateLabel: actionLabel,
        screenshot
      });
      issues.push(...stateIssues);

      const actions = current.depth >= maxDepth
        ? []
        : await discoverSafeActions(page, pageState.url, maxActionsPerState);
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
        actionCount: actions.length
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
      summary: {
        statesVisited: states.length,
        actionsTried,
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
  const searchable = [
    action.label,
    action.text,
    action.role,
    action.url
  ].filter(Boolean).join(" ");

  if (DANGEROUS_ACTION_PATTERN.test(searchable)) return false;

  if (action.type === "navigate") {
    return Boolean(normalizeExploreUrl(action.url, baseUrl));
  }

  return Boolean(action.selector);
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
  }
): Promise<Issue[]> {
  try {
    const results = await new AxeBuilder({ page }).analyze();
    const issues: Issue[] = [];

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
          url: page.url(),
          stateId: state.stateId,
          stateLabel: state.stateLabel,
          screenshot: state.screenshot
        });
      }
    }

    return issues;
  } catch (error) {
    return [createExploreErrorIssue(config, page.url(), error)];
  }
}

async function discoverSafeActions(
  page: Page,
  baseUrl: string,
  maxActions: number
): Promise<ExploreAction[]> {
  const rawActions = await page.$$eval(INTERACTIVE_SELECTOR, (elements): RawExploreAction[] => {
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

    return elements.flatMap((element): RawExploreAction[] => {
      if (!isVisible(element)) return [];
      if (element.closest("[data-a11y-skip], [aria-hidden='true']")) return [];
      if (element.getAttribute("aria-disabled") === "true") return [];
      if ("disabled" in element && Boolean((element as HTMLButtonElement).disabled)) return [];

      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role") || tag;
      const text = textOf(element);
      const selector = selectorFor(element);
      const forcedExplore = element.hasAttribute("data-a11y-explore");

      if (tag === "a") {
        const anchor = element as HTMLAnchorElement;
        if (anchor.target === "_blank" || anchor.hasAttribute("download")) return [];

        return [{
          type: "navigate",
          selector,
          url: anchor.href,
          label: text ? `Navigate: ${text}` : `Navigate: ${anchor.href}`,
          text,
          role
        }];
      }

      const buttonType = element.getAttribute("type")?.toLowerCase();
      if (buttonType === "submit" || buttonType === "reset") return [];
      if (tag === "button" && element.closest("form") && !forcedExplore) return [];

      return [{
        type: "click",
        selector,
        label: text ? `Click: ${text}` : `Click: ${role}`,
        text,
        role
      }];
    });
  });

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
    if (!isSafeExploreAction(action, baseUrl)) continue;

    seen.add(key);
    actions.push(action);
    if (actions.length >= maxActions) break;
  }

  return actions;
}

async function captureStateScreenshot(
  page: Page,
  outputDir: string,
  stateId: string
): Promise<string | undefined> {
  const screenshotsDir = path.join(outputDir, "screenshots");
  const filename = `${stateId}.png`;
  const screenshotPath = path.join(screenshotsDir, filename);

  await fs.mkdir(screenshotsDir, { recursive: true });
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

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

function hash(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}
