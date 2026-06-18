import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type BrowserContext, type Page } from "playwright";
import { applyColorScheme, detectPageColorSchemes, getPageAppearanceSignature, normalizePageScrollConfig, scrollPageForLazyContent, type PageScrollConfig } from "../core/pageScroll.js";
import { extractContrastEvidence } from "../core/contrast.js";
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
const MAX_AUTO_FULL_PAGE_HEIGHT = 2400;
const ERROR_CROP_PADDING_Y = 120;
const MAX_ERROR_CROP_HEIGHT = 900;
const ERROR_CROP_PADDING_X = 80;
const MAX_ERROR_CROP_WIDTH = 1600;

const COOKIE_CONSENT_CONTEXT_PATTERNS = [
  /\b(cookie|cookies|cookiebot|onetrust|consent|tracking|privacy\s*(choices|preferences|settings))\b/i,
  /(куки|файлы\s*cookie|согласие|конфиденциальност)/i,
  /(preferencias\s*de\s*privacidad|consentimiento|confidentialit[eé]|datenschutz|zustimmung)/i,
  /(隐私|同意|쿠키|동의|プライバシー|同意|ملفات\s*تعريف\s*الارتباط)/i
];

const ADVERTISING_CONTEXT_PATTERNS = [
  /\b(advertisement|advertising|advert|sponsored|promoted|paid\s*content|ad\s*choices?)\b/i,
  /(^|[^a-z0-9])(ad|ads|adslot|adunit|adbanner|adcontainer)(?=$|[^a-z0-9])/i,
  /\b(doubleclick|googlesyndication|googleadservices|adservice|amazon-adsystem|taboola|outbrain|criteo|adnxs|adserver|clickserve)\b/i,
  /(реклама|рекламн|спонсорск|продвигаем)/i,
  /(publicidad|anuncio|patrocinad|promocionad)/i,
  /(publicité|sponsorisé|contenu\s*sponsorisé)/i,
  /(werbung|anzeige|gesponsert)/i,
  /(pubblicità|sponsorizzat)/i,
  /(publicidade|anúncio|patrocinad)/i,
  /(广告|赞助|推广|広告|スポンサー|プロモーション|광고|후원|프로모션)/i,
  /(إعلان|محتوى\s*مدفوع|برعاية|विज्ञापन|प्रायोजित)/i
];

const ALWAYS_BLOCKED_ACTION_PATTERNS = [
  /\b(log\s*out|logout|sign\s*out|signoff|disconnect|end\s*session)\b/i,
  /\b(login|log\s*in|sign\s*in|sign\s*up|register|create\s*account|authenticate)\b/i,
  /\b(pay|payment|purchase|buy|checkout|order\s*now|subscribe|donate|billing)\b/i,
  /\b(accept\s*(all)?\s*cookies?|reject\s*(all)?\s*cookies?|cookie\s*(settings|preferences|consent)?|privacy\s*preferences|allow\s*all|agree)\b/i,
  /\b(camera|webcam|photo|picture|take\s*(a\s*)?(photo|picture)|snapshot|scan\s*document|qr\s*scan)\b/i,
  /\b(microphone|mic|voice\s*input|record\s*(audio|voice)?|audio\s*recording)\b/i,
  /\b(location|geolocation|share\s*location|use\s*my\s*location|enable\s*notifications?|push\s*notifications?)\b/i,
  /\b(upload|choose\s*file|select\s*file|attach\s*file|share\s*(screen|camera|microphone|location)?)\b/i,
  /(выйти|выход|завершить\s*сеанс|войти|авторизоваться|зарегистрироваться|создать\s*аккаунт)/i,
  /(оплатить|платеж|платёж|купить|оформить\s*заказ|заказать|подписаться|пожертвовать|биллинг)/i,
  /(cookie|cookies|куки|файлы\s*cookie|принять\s*все|отклонить\s*все|согласен|согласиться|настройки\s*конфиденциальности)/i,
  /(камера|веб-камера|фото|фотография|снимок|сфотографировать|сканировать\s*документ|qr)/i,
  /(микрофон|голосовой\s*ввод|записать\s*(звук|голос)|аудиозапись)/i,
  /(геолокация|местоположение|поделиться\s*местоположением|уведомления)/i,
  /(загрузить|выбрать\s*файл|прикрепить\s*файл|поделиться\s*(экраном|камерой|микрофоном))/i,
  /(cerrar\s*sesión|iniciar\s*sesión|registrarse|pagar|pago|comprar|cámara|foto|micrófono|ubicación|notificaciones|cookies?)/i,
  /(déconnexion|connexion|inscription|payer|paiement|acheter|caméra|photo|micro|emplacement|notifications|cookies?)/i,
  /(abmelden|anmelden|registrieren|bezahlen|zahlung|kaufen|kamera|foto|mikrofon|standort|benachrichtigungen|cookies?)/i,
  /(disconnetti|accedi|registrati|pagare|pagamento|comprare|fotocamera|foto|microfono|posizione|notifiche|cookies?)/i,
  /(sair|entrar|registrar|pagar|pagamento|comprar|câmera|camera|foto|microfone|localização|notificações|cookies?)/i,
  /(wyloguj|zaloguj|zarejestruj|zapłać|płatność|kup|kamera|zdjęcie|mikrofon|lokalizacja|powiadomienia|cookies?)/i,
  /(вийти|увійти|зареєструватися|оплатити|платіж|купити|камера|фото|мікрофон|місцезнаходження|сповіщення|cookies?)/i,
  /(退出|登录|登入|注册|支付|付款|购买|结账|摄像头|相机|照片|麦克风|位置|通知|Cookie|同意)/i,
  /(ログアウト|ログイン|登録|支払い|購入|チェックアウト|カメラ|写真|マイク|位置情報|通知|クッキー|同意)/i,
  /(로그아웃|로그인|가입|결제|구매|체크아웃|카메라|사진|마이크|위치|알림|쿠키|동의)/i,
  /(تسجيل\s*الخروج|تسجيل\s*الدخول|دفع|شراء|كاميرا|صورة|ميكروفون|موقع|إشعارات|ملفات\s*تعريف\s*الارتباط)/i,
  /(लॉग\s*आउट|लॉग\s*इन|भुगतान|खरीद|कैमरा|फोटो|माइक्रोफोन|स्थान|सूचनाएं|कुकी)/i
];

const DANGEROUS_ACTION_PATTERN = /\b(delete|remove|destroy|submit|save|create|update|send|confirm|удалить|отправить|сохранить|создать|обновить|подтвердить)\b/i;

const THEME_ACTION_PATTERN = /\b(theme|dark\s*mode|light\s*mode|night\s*mode|appearance|colou?r\s*scheme)\b|(?:тема|тёмн|темн|светл|оформлен)|(?:tema|modo\s*oscuro|modo\s*claro|apparence|thème|dunkel|hell|aspetto)|(?:主题|深色|浅色|ダーク|ライト|테마|다크|라이트|الوضع\s*المظلم|الوضع\s*الفاتح)/i;

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
  waitForSelector?: string;
  scroll?: Partial<PageScrollConfig>;
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

interface CapturedScreenshot {
  path: string;
  fingerprint: string;
  kind: "full-page" | "viewport" | "error-crop";
  issueIndexes: number[];
  width: number;
  height: number;
}

export interface DocumentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageCaptureMetrics {
  documentWidth: number;
  documentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface EvidenceClip {
  x: number;
  y: number;
  width: number;
  height: number;
  issueIndexes: number[];
}

interface PreparedStateVisualEvidence {
  issues: Issue[];
  captures: CapturedScreenshot[];
  fullPage: boolean;
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
  const screenshotFingerprintToEvidence = new Map<string, {
    stateId: string;
    path: string;
  }>();
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
  const waitMs = nonNegativeOrDefault(options.waitMs, DEFAULT_WAIT_MS);
  const waitForSelector = options.waitForSelector;
  const scroll = normalizePageScrollConfig(options.scroll || config.explore.scroll);
  let actionsTried = 0;
  let screenshotsSaved = 0;
  let uniqueUiStates = 0;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    context.on("page", async (openedPage) => {
      if (openedPage !== page) {
        await openedPage.close().catch(() => undefined);
      }
    });
    if (safeMode.enabled && safeMode.dismissDialogs) {
      page.on("dialog", async (dialog) => {
        await dialog.dismiss().catch(() => undefined);
      });
    }
    const queue: QueuedState[] = [{ path: [], depth: 0 }];
    const queuedPaths = new Set(["start"]);

    while (queue.length > 0 && uniqueUiStates < maxStates) {
      const current = queue.shift();
      if (!current) continue;

      try {
        await applyColorScheme(page, "light");
        if (safeMode.isolateCookies) {
          await clearContextCookies(context);
        }
        await replayPath(page, options.url, current.path, {
          waitMs,
          waitForSelector
        });
        await scrollPageForLazyContent(page, scroll);
      } catch (error) {
        issues.push(createExploreErrorIssue(config, options.url, error, current.via));
        continue;
      }

      const initialPageState = await fingerprintPage(page);
      const discovery = current.depth >= maxDepth
        ? { actions: [], skipped: [] }
        : await discoverSafeActions(page, initialPageState.url, maxActionsPerState, safeMode);
      const actions = discovery.actions;
      const colorSchemes = await detectPageColorSchemes(page);
      const actionLabel = current.via?.label || "Initial page";
      let primaryStateId: string | undefined;
      let createdState = false;

      for (const colorScheme of colorSchemes) {
        await applyColorScheme(page, colorScheme);
        await scrollPageForLazyContent(page, scroll);
        const pageState = await fingerprintPage(page);
        const reportedColorScheme = colorSchemes.length > 1 ? colorScheme : undefined;
        const existingId = fingerprintToStateId.get(pageState.fingerprint);

        if (existingId) {
          primaryStateId ||= existingId;
          continue;
        }

        const stateId = `state-${states.length + 1}`;
        primaryStateId ||= stateId;
        const scannedIssues = await scanState(config, page, {
          stateId,
          stateLabel: actionLabel,
          colorScheme: reportedColorScheme
        });
        const visualEvidence = screenshots
          ? await captureStateVisualEvidence(page, scannedIssues, {
            outputDir: options.outputDir,
            stateId,
            format: screenshotFormat,
            quality: screenshotQuality,
            forceFullPage: Boolean(options.screenshotFullPage),
            redactSensitiveFields: screenshotRedaction
          })
          : {
            issues: scannedIssues,
            captures: [],
            fullPage: false
          };
        const screenshotPathReplacements = new Map<string, string>();
        const screenshotEvidence: NonNullable<ExplorationState["screenshotEvidence"]> = [];
        let visualDuplicateOf: string | undefined;

        for (const capturedScreenshot of visualEvidence.captures) {
          const existingEvidence = screenshotFingerprintToEvidence.get(
            capturedScreenshot.fingerprint
          );
          let finalPath = capturedScreenshot.path;

          if (existingEvidence) {
            await removeDuplicateScreenshot(options.outputDir, capturedScreenshot.path);
            finalPath = existingEvidence.path;
            if (visualEvidence.captures.length === 1) {
              visualDuplicateOf = existingEvidence.stateId;
            }
          } else {
            screenshotFingerprintToEvidence.set(capturedScreenshot.fingerprint, {
              stateId,
              path: capturedScreenshot.path
            });
            screenshotsSaved += 1;
          }

          screenshotPathReplacements.set(capturedScreenshot.path, finalPath);
          const existingScreenshot = screenshotEvidence.find((item) => (
            item.path === finalPath && item.kind === capturedScreenshot.kind
          ));
          if (existingScreenshot) {
            existingScreenshot.issueCount += capturedScreenshot.issueIndexes.length;
          } else {
            screenshotEvidence.push({
              path: finalPath,
              kind: capturedScreenshot.kind,
              issueCount: capturedScreenshot.issueIndexes.length,
              width: capturedScreenshot.width,
              height: capturedScreenshot.height
            });
          }
        }

        const stateIssues = visualEvidence.issues.map((issue) => ({
          ...issue,
          screenshot: issue.screenshot
            ? screenshotPathReplacements.get(issue.screenshot) || issue.screenshot
            : undefined
        }));
        const screenshot = screenshotEvidence[0]?.path;
        issues.push(...stateIssues);

        const state: ExplorationState = {
          id: stateId,
          url: pageState.url,
          title: pageState.title || undefined,
          depth: current.depth,
          fingerprint: pageState.fingerprint,
          actionLabel,
          colorScheme: reportedColorScheme,
          screenshot,
          screenshotEvidence: screenshotEvidence.length > 0 ? screenshotEvidence : undefined,
          screenshotFullPage: screenshot ? visualEvidence.fullPage : undefined,
          visualDuplicateOf,
          issueCount: stateIssues.length,
          actionCount: actions.length
        };

        states.push(state);
        fingerprintToStateId.set(pageState.fingerprint, stateId);
        createdState = true;
        options.onProgress?.({ type: "state", state });
      }

      await applyColorScheme(page, "light");

      if (!primaryStateId) continue;

      if (current.parentId && current.via) {
        edges.push({
          from: current.parentId,
          to: primaryStateId,
          action: current.via
        });
        actionsTried += 1;
      }

      if (!createdState) continue;
      uniqueUiStates += 1;
      skippedActions.push(...discovery.skipped.map((action) => ({
        ...action,
        stateId: primaryStateId
      })));
      options.onProgress?.({
        type: "actions",
        stateId: primaryStateId,
        actionCount: actions.length,
        skippedActionCount: discovery.skipped.length
      });

      for (const action of actions) {
        const nextPath = [...current.path, action];
        const pathKey = nextPath.map((item) => item.id).join(">");
        if (queuedPaths.has(pathKey)) continue;
        if (current.depth + 1 > maxDepth) continue;
        if (uniqueUiStates + queue.length >= maxStates) continue;

        queuedPaths.add(pathKey);
        queue.push({
          path: nextPath,
          depth: current.depth + 1,
          parentId: primaryStateId,
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
        uiStatesVisited: uniqueUiStates,
        actionsTried,
        skippedActions: skippedActions.length,
        screenshots: screenshotsSaved,
        duplicateScreenshots: states.filter((state) => state.visualDuplicateOf).length,
        maxDepth,
        maxStates
      }
    }
  };
}

async function clearContextCookies(context: BrowserContext): Promise<void> {
  await context.clearCookies().catch(() => undefined);
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

export function isCookieConsentContext(value: string): boolean {
  return COOKIE_CONSENT_CONTEXT_PATTERNS.some((pattern) => pattern.test(value));
}

export function isAdvertisingActionContext(value: string): boolean {
  return ADVERTISING_CONTEXT_PATTERNS.some((pattern) => pattern.test(value));
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
    action.url,
    action.selector
  ].filter(Boolean).join(" ");

  if (isAdvertisingActionContext(searchable)) {
    return {
      safe: false,
      reason: "Advertising and sponsored content are never opened during automatic exploration."
    };
  }

  if (matchesAlwaysBlockedAction(searchable)) {
    return {
      safe: false,
      reason: "Matched built-in high-risk action pattern for account, payment, cookies, media, permissions, upload, or sharing controls."
    };
  }

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

function matchesAlwaysBlockedAction(value: string): boolean {
  return ALWAYS_BLOCKED_ACTION_PATTERNS.some((pattern) => pattern.test(value));
}

async function replayPath(
  page: Page,
  startUrl: string,
  actions: ExploreAction[],
  wait: ExploreWaitOptions
): Promise<void> {
  await gotoAndSettle(page, startUrl, wait);

  for (const action of actions) {
    if (action.type === "navigate" && action.url) {
      await gotoAndSettle(page, action.url, wait);
      continue;
    }

    if (!action.selector) continue;

    await page.locator(action.selector).first().click({
      timeout: 1500
    });
    await settle(page, wait);
  }
}

interface ExploreWaitOptions {
  waitMs: number;
  waitForSelector?: string;
}

async function gotoAndSettle(page: Page, url: string, wait: ExploreWaitOptions): Promise<void> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 15000
  });
  await settle(page, wait);
}

async function settle(page: Page, wait: ExploreWaitOptions): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);
  if (wait.waitForSelector) {
    await page.waitForSelector(wait.waitForSelector, {
      state: "visible",
      timeout: Math.max(wait.waitMs, 1000)
    }).catch(() => undefined);
  }
  if (wait.waitMs > 0) {
    await page.waitForTimeout(wait.waitMs);
  }
}

async function fingerprintPage(page: Page): Promise<PageFingerprint> {
  const appearance = await getPageAppearanceSignature(page);
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
  const input = JSON.stringify({ ...snapshot, appearance });

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
    colorScheme: Issue["colorScheme"];
  }
): Promise<Issue[]> {
  try {
    const results = await new AxeBuilder({ page }).analyze();
    const issues: Issue[] = [];

    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        const selector = node.target.join(" ");

        issues.push({
          source: "axe",
          framework: config.framework,
          ruleId: violation.id,
          impact: violation.impact || undefined,
          wcag: violation.tags.filter((tag: string) => tag.startsWith("wcag")),
          tags: violation.tags,
          selector,
          contrast: extractContrastEvidence(violation.id, node),
          helpUrl: violation.helpUrl,
          colorScheme: state.colorScheme,
          message: violation.help,
          url: page.url(),
          stateId: state.stateId,
          stateLabel: state.stateLabel
        });
      }
    }

    return issues;
  } catch (error) {
    return [createExploreErrorIssue(config, page.url(), error)];
  }
}

export function shouldCaptureFullPageScreenshot(
  forceFullPage: boolean,
  issueCount: number,
  documentHeight = 0
): boolean {
  return forceFullPage || (
    issueCount > 0 && documentHeight <= MAX_AUTO_FULL_PAGE_HEIGHT
  );
}

async function captureStateVisualEvidence(
  page: Page,
  issues: Issue[],
  options: {
    outputDir: string;
    stateId: string;
    format: ScreenshotFormat;
    quality: number;
    forceFullPage: boolean;
    redactSensitiveFields: boolean;
  }
): Promise<PreparedStateVisualEvidence> {
  await stabilizePageForVisualEvidence(page);
  const metrics = await readPageCaptureMetrics(page);
  const issueRects = await Promise.all(issues.map(async (issue, issueIndex) => ({
    issueIndex,
    rect: issue.selector
      ? await getIssueDocumentRect(page, issue.selector)
      : undefined
  })));
  const resolvedRects = issueRects.filter((item): item is {
    issueIndex: number;
    rect: DocumentRect;
  } => Boolean(item.rect));
  const fullPage = shouldCaptureFullPageScreenshot(
    options.forceFullPage,
    issues.length,
    metrics.documentHeight
  );

  if (fullPage) {
    const captured = await captureStateScreenshot(page, {
      ...options,
      fullPage: true,
      kind: "full-page",
      issueIndexes: issues.map((_, index) => index),
      imageWidth: metrics.documentWidth,
      imageHeight: metrics.documentHeight
    });

    return {
      fullPage: true,
      captures: captured ? [captured] : [],
      issues: issues.map((issue, index) => ({
        ...issue,
        screenshot: captured?.path,
        elementBounds: toDocumentPercentBounds(resolvedRects, index, metrics)
      }))
    };
  }

  const clips = createEvidenceClips(resolvedRects, metrics);

  if (clips.length > 0) {
    const captures: CapturedScreenshot[] = [];
    const preparedIssues = issues.map((issue) => ({ ...issue }));

    for (const [clipIndex, clip] of clips.entries()) {
      const captured = await captureStateScreenshot(page, {
        ...options,
        fullPage: false,
        kind: "error-crop",
        issueIndexes: clip.issueIndexes,
        filenameSuffix: `-error-${clipIndex + 1}`,
        clip,
        imageWidth: clip.width,
        imageHeight: clip.height
      });
      if (!captured) continue;
      captures.push(captured);

      for (const issueIndex of clip.issueIndexes) {
        const rect = resolvedRects.find((item) => item.issueIndex === issueIndex)?.rect;
        preparedIssues[issueIndex] = {
          ...preparedIssues[issueIndex],
          screenshot: captured.path,
          elementBounds: rect
            ? toPercentBounds({
              x: rect.x - clip.x,
              y: rect.y - clip.y,
              width: rect.width,
              height: rect.height,
              containerWidth: clip.width,
              containerHeight: clip.height
            }, "viewport")
            : undefined
        };
      }
    }

    const fallbackScreenshot = captures[0]?.path;
    return {
      fullPage: false,
      captures,
      issues: preparedIssues.map((issue) => issue.screenshot || !fallbackScreenshot
        ? issue
        : { ...issue, screenshot: fallbackScreenshot })
    };
  }

  const captured = await captureStateScreenshot(page, {
    ...options,
    fullPage: false,
    kind: "viewport",
    issueIndexes: issues.map((_, index) => index),
    imageWidth: metrics.viewportWidth,
    imageHeight: metrics.viewportHeight
  });

  return {
    fullPage: false,
    captures: captured ? [captured] : [],
    issues: issues.map((issue) => ({
      ...issue,
      screenshot: captured?.path
    }))
  };
}

function toDocumentPercentBounds(
  resolvedRects: Array<{ issueIndex: number; rect: DocumentRect }>,
  issueIndex: number,
  metrics: PageCaptureMetrics
): ElementBounds | undefined {
  const rect = resolvedRects.find((item) => item.issueIndex === issueIndex)?.rect;
  return rect
    ? toPercentBounds({
      ...rect,
      containerWidth: metrics.documentWidth,
      containerHeight: metrics.documentHeight
    }, "document")
    : undefined;
}

export function createEvidenceClips(
  resolvedRects: Array<{ issueIndex: number; rect: DocumentRect }>,
  metrics: PageCaptureMetrics
): EvidenceClip[] {
  const sorted = [...resolvedRects].sort((left, right) => left.rect.y - right.rect.y);
  const groups: typeof sorted[] = [];

  for (const item of sorted) {
    const current = groups.at(-1);
    if (!current) {
      groups.push([item]);
      continue;
    }

    const proposedTop = Math.min(...current.map((entry) => entry.rect.y), item.rect.y);
    const proposedBottom = Math.max(
      ...current.map((entry) => entry.rect.y + entry.rect.height),
      item.rect.y + item.rect.height
    );
    const proposedLeft = Math.min(...current.map((entry) => entry.rect.x), item.rect.x);
    const proposedRight = Math.max(
      ...current.map((entry) => entry.rect.x + entry.rect.width),
      item.rect.x + item.rect.width
    );

    if (
      proposedBottom - proposedTop + ERROR_CROP_PADDING_Y * 2 > MAX_ERROR_CROP_HEIGHT ||
      proposedRight - proposedLeft + ERROR_CROP_PADDING_X * 2 > MAX_ERROR_CROP_WIDTH
    ) {
      groups.push([item]);
    } else {
      current.push(item);
    }
  }

  return groups.map((group) => {
    const minX = Math.min(...group.map((item) => item.rect.x));
    const maxX = Math.max(...group.map((item) => item.rect.x + item.rect.width));
    const minY = Math.min(...group.map((item) => item.rect.y));
    const maxY = Math.max(...group.map((item) => item.rect.y + item.rect.height));
    const desiredWidth = Math.max(
      metrics.viewportWidth,
      maxX - minX + ERROR_CROP_PADDING_X * 2
    );
    const width = Math.max(1, Math.min(
      metrics.documentWidth,
      MAX_ERROR_CROP_WIDTH,
      desiredWidth
    ));
    const x = clamp(minX - ERROR_CROP_PADDING_X, 0, metrics.documentWidth - width);
    const desiredHeight = Math.min(
      MAX_ERROR_CROP_HEIGHT,
      maxY - minY + ERROR_CROP_PADDING_Y * 2
    );
    const y = clamp(minY - ERROR_CROP_PADDING_Y, 0, metrics.documentHeight - desiredHeight);
    const height = Math.max(1, Math.min(desiredHeight, metrics.documentHeight - y));

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      issueIndexes: group.map((item) => item.issueIndex)
    };
  });
}

async function readPageCaptureMetrics(page: Page): Promise<PageCaptureMetrics> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;

    return {
      documentWidth: Math.max(doc.scrollWidth, body?.scrollWidth || 0, window.innerWidth),
      documentHeight: Math.max(doc.scrollHeight, body?.scrollHeight || 0, window.innerHeight),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });
}

async function getIssueDocumentRect(
  page: Page,
  selector: string
): Promise<DocumentRect | undefined> {
  try {
    const rect = await page.evaluate((selectorText) => {
      const element = document.querySelector(selectorText);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();

      return {
        x: bounds.left + window.scrollX,
        y: bounds.top + window.scrollY,
        width: bounds.width,
        height: bounds.height
      };
    }, selector);

    return rect && rect.width > 0 && rect.height > 0 ? rect : undefined;
  } catch {
    return undefined;
  }
}

async function stabilizePageForVisualEvidence(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
    `
  }).catch(() => undefined);

  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }).catch(() => undefined);
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

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(Math.max(min, max), value));
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
  const discovery = await page.$$eval(INTERACTIVE_SELECTOR, (elements, input): {
    actions: RawExploreAction[];
    skipped: RawSkippedAction[];
  } => {
    const {
      safeMode,
      cookieConsentPatternSources,
      advertisingPatternSources
    } = input;

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

    function isCookieConsentControl(element: Element): boolean {
      const directContainer = element.closest([
        "[id*='cookie' i]",
        "[class*='cookie' i]",
        "[data-testid*='cookie' i]",
        "[data-test*='cookie' i]",
        "[id*='consent' i]",
        "[class*='consent' i]",
        "[data-testid*='consent' i]",
        "[data-test*='consent' i]",
        "[aria-label*='cookie' i]",
        "[aria-label*='consent' i]"
      ].join(", "));
      if (directContainer) return true;

      let current = element.parentElement;
      let depth = 0;

      while (current && current !== document.body && depth < 6) {
        const role = current.getAttribute("role")?.toLowerCase();
        const isConsentSurface = role === "dialog" ||
          role === "alertdialog" ||
          role === "region" ||
          current.tagName.toLowerCase() === "aside";

        if (isConsentSurface) {
          const context = [
            current.getAttribute("aria-label"),
            current.getAttribute("title"),
            current.textContent
          ].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 2000);

          if (cookieConsentPatternSources.some((source) => new RegExp(source, "i").test(context))) {
            return true;
          }
        }

        current = current.parentElement;
        depth += 1;
      }

      return false;
    }

    function isAdvertisingControl(element: Element): boolean {
      const explicitContainer = element.closest([
        "[data-ad]",
        "[data-ad-slot]",
        "[data-ad-unit]",
        "[data-ad-client]",
        "[data-sponsored]",
        "[data-google-query-id]",
        "[rel~='sponsored']",
        ".ad",
        ".ads",
        ".advertisement",
        ".sponsored",
        "[id='ad']",
        "[id^='ad-']",
        "[id$='-ad']"
      ].join(", "));
      if (explicitContainer) return true;

      let current: Element | null = element;
      let depth = 0;

      while (current && current !== document.body && depth < 5) {
        const metadata = [
          current.getAttribute("id"),
          current.getAttribute("class"),
          current.getAttribute("aria-label"),
          current.getAttribute("title"),
          current.getAttribute("data-testid"),
          current.getAttribute("data-test"),
          current.getAttribute("href")
        ].filter(Boolean).join(" ");
        const text = (current.textContent || "").replace(/\s+/g, " ").trim();
        const context = text.length <= 1200 ? `${metadata} ${text}` : metadata;

        if (advertisingPatternSources.some(
          (source) => new RegExp(source, "i").test(context)
        )) {
          return true;
        }

        current = current.parentElement;
        depth += 1;
      }

      return false;
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

      if (isAdvertisingControl(element)) {
        skipped.push(skippedAction(
          element,
          "Advertising and sponsored content are never opened during automatic exploration."
        ));
        continue;
      }

      if (isCookieConsentControl(element)) {
        skipped.push(skippedAction(
          element,
          "Cookie consent controls are never clicked during automatic exploration."
        ));
        continue;
      }

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
  }, {
    safeMode,
    cookieConsentPatternSources: COOKIE_CONSENT_CONTEXT_PATTERNS.map(
      (pattern) => pattern.source
    ),
    advertisingPatternSources: ADVERTISING_CONTEXT_PATTERNS.map(
      (pattern) => pattern.source
    )
  });

  const rawActions = prioritizeThemeActions(discovery.actions);
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

export function prioritizeThemeActions<T extends {
  label?: string;
  text?: string;
  selector?: string;
}>(actions: T[]): T[] {
  return [...actions].sort((left, right) =>
    Number(isThemeAction(right)) - Number(isThemeAction(left))
  );
}

export function isThemeAction(action: {
  label?: string;
  text?: string;
  selector?: string;
}): boolean {
  return THEME_ACTION_PATTERN.test([
    action.label,
    action.text,
    action.selector
  ].filter(Boolean).join(" "));
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
    kind: CapturedScreenshot["kind"];
    issueIndexes: number[];
    imageWidth: number;
    imageHeight: number;
    filenameSuffix?: string;
    clip?: EvidenceClip;
  }
): Promise<CapturedScreenshot | undefined> {
  const screenshotsDir = path.join(options.outputDir, "screenshots");
  const extension = options.format === "jpeg" ? "jpg" : "png";
  const filename = `${options.stateId}${options.filenameSuffix || ""}.${extension}`;
  const screenshotPath = path.join(screenshotsDir, filename);

  await fs.mkdir(screenshotsDir, { recursive: true });
  const screenshotOptions: Parameters<Page["screenshot"]>[0] = {
    animations: "disabled",
    caret: "hide",
    path: screenshotPath,
    fullPage: options.fullPage,
    type: options.format,
    ...(options.clip ? {
      clip: {
        x: options.clip.x,
        y: options.clip.y,
        width: options.clip.width,
        height: options.clip.height
      }
    } : {}),
    ...(options.format === "jpeg" ? { quality: options.quality } : {})
  };

  if (options.redactSensitiveFields) {
    screenshotOptions.mask = [page.locator(SENSITIVE_SCREENSHOT_SELECTOR)];
    screenshotOptions.maskColor = SCREENSHOT_REDACTION_COLOR;
  }

  const screenshotBuffer = await page.screenshot(screenshotOptions);

  return {
    path: path.posix.join("screenshots", filename),
    fingerprint: hashBuffer(screenshotBuffer),
    kind: options.kind,
    issueIndexes: options.issueIndexes,
    width: options.imageWidth,
    height: options.imageHeight
  };
}

async function removeDuplicateScreenshot(outputDir: string, screenshot: string): Promise<void> {
  await fs.unlink(path.resolve(outputDir, screenshot)).catch(() => undefined);
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

function nonNegativeOrDefault(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
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
    dismissDialogs: safeMode?.dismissDialogs ?? fallback.dismissDialogs,
    isolateCookies: safeMode?.isolateCookies ?? fallback.isolateCookies
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
    dismissDialogs: true,
    isolateCookies: true
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

function hashBuffer(value: Uint8Array): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}
