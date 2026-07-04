import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { getAxeRunOptions } from "../core/axeOptions.js";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { applyColorScheme, detectPageColorSchemes, getPageAppearanceSignature, normalizePageScrollConfig, scrollPageForLazyContent, type PageScrollConfig } from "../core/pageScroll.js";
import { extractContrastEvidence } from "../core/contrast.js";
import { createHumanVerificationIssue, detectHumanVerification } from "../core/humanVerification.js";
import { inferIssueOwnership } from "../core/ownership.js";
import { analyzePageTitles } from "../core/pageTitles.js";
import type {
  A11yConfig,
  AccessibilityTreeEvidence,
  DynamicAnnouncementEvidence,
  EmbeddedContentEvidence,
  ExplorationGraph,
  ExplorationState,
  ExploreAction,
  ExploreSafeModeConfig,
  ExploreSkippedAction,
  ForcedColorsConcern,
  ForcedColorsEvidence,
  FormErrorEvidence,
  ImageAlternativeConcern,
  ImageAlternativeEvidence,
  Issue,
  MediaElementEvidence,
  MediaEvidence,
  ModalFocusEvidence,
  ReflowEvidence
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
const MAX_AUTO_FULL_PAGE_HEIGHT = 6000;
const ERROR_CROP_PADDING_Y = 120;
const MAX_ERROR_CROP_HEIGHT = 900;
const ERROR_CROP_PADDING_X = 80;
const MAX_ERROR_CROP_WIDTH = 1600;
const REFLOW_OVERFLOW_TOLERANCE_PX = 16;
const FORCED_COLORS_CONTROL_SAMPLE_LIMIT = 12;
const FORCED_COLORS_SAMPLE_LIMIT = 12;

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
  kind: "full-page" | "viewport" | "evidence-crop";
  issueIndexes: number[];
  width: number;
  height: number;
  clip?: EvidenceClip;
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

interface PopupCloseTarget {
  close(): Promise<void>;
}

interface PopupEventSource {
  on(event: "popup", listener: (popup: PopupCloseTarget) => Promise<void>): unknown;
}

export function attachExplorePopupGuard(page: PopupEventSource): void {
  page.on("popup", async (openedPage) => {
    await openedPage.close().catch(() => undefined);
  });
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
    attachExplorePopupGuard(page);
    if (safeMode.enabled && safeMode.dismissDialogs) {
      page.on("dialog", async (dialog) => {
        await dialog.dismiss().catch(() => undefined);
      });
    }
    const queue: QueuedState[] = [{ path: [], depth: 0 }];
    const queuedPaths = new Set(["start"]);
    const queuedNavigationUrls = new Set([
      normalizeExploreUrl(options.url, options.url) || options.url
    ]);

    while (queue.length > 0 && uniqueUiStates < maxStates) {
      const current = queue.shift();
      if (!current) continue;
      let dynamicAnnouncements: DynamicAnnouncementEvidence | undefined;

      try {
        await applyColorScheme(page, "light");
        if (safeMode.isolateCookies) {
          await clearContextCookies(context);
        }
        dynamicAnnouncements = await replayPath(page, options.url, current.path, {
          waitMs,
          waitForSelector
        });
        await scrollPageForLazyContent(page, scroll);
      } catch (error) {
        issues.push(createExploreErrorIssue(config, options.url, error, current.via));
        continue;
      }

      const verification = await detectHumanVerification(page);
      const initialPageState = await fingerprintPage(page);
      const openModal = await inspectOpenModal(page);
      const modalFocus = openModal
        ? await auditModalFocusInIsolation(browser, options.url, current.path, {
          waitMs,
          waitForSelector
        }, openModal)
        : undefined;
      const discovery = current.depth >= maxDepth
        ? { actions: [], skipped: [] }
        : verification
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
        const accessibilityTree = await captureAccessibilityTree(page);
        const formErrors = await auditFormErrors(page, config, {
          stateId,
          stateLabel: actionLabel,
          colorScheme: reportedColorScheme
        });
        const imageAlternatives = await auditImageAlternatives(page, config, {
          stateId,
          stateLabel: actionLabel,
          colorScheme: reportedColorScheme
        });
        const media = await auditMedia(page, config, {
          stateId,
          stateLabel: actionLabel,
          colorScheme: reportedColorScheme
        }, scannedIssues);
        const embeddedContent = await auditEmbeddedContent(page, config, {
          stateId,
          stateLabel: actionLabel,
          colorScheme: reportedColorScheme
        });
        const renderedIssues = [
          ...scannedIssues,
          ...formErrors.issues,
          ...imageAlternatives.issues,
          ...media.issues,
          ...embeddedContent.issues
        ];
        const visualEvidence = screenshots
          ? await captureStateVisualEvidence(page, renderedIssues, {
            outputDir: options.outputDir,
            stateId,
            format: screenshotFormat,
            quality: screenshotQuality,
            forceFullPage: Boolean(options.screenshotFullPage),
            redactSensitiveFields: screenshotRedaction
          })
          : {
            issues: renderedIssues,
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

        const reflow = await auditReflow(page, config, {
          stateId,
          stateLabel: actionLabel,
          colorScheme: reportedColorScheme
        });
        const forcedColors = await auditForcedColors(page, config, {
          stateId,
          stateLabel: actionLabel,
          colorScheme: reportedColorScheme
        });
        const modalIssues = createModalFocusIssues(config.framework, modalFocus, {
          stateId,
          stateLabel: actionLabel,
          colorScheme: reportedColorScheme,
          url: page.url()
        });
        const stateIssues = [...visualEvidence.issues.map((issue) => ({
          ...issue,
          screenshot: issue.screenshot
            ? screenshotPathReplacements.get(issue.screenshot) || issue.screenshot
            : undefined
        })), ...reflow.issues, ...forcedColors.issues, ...modalIssues];
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
          actionCount: actions.length,
          accessibilityTree,
          reflow: reflow.evidence,
          forcedColors: forcedColors.evidence,
          modalFocus,
          dynamicAnnouncements,
          formErrors: formErrors.evidence,
          imageAlternatives: imageAlternatives.evidence,
          media: media.evidence,
          embeddedContent: embeddedContent.evidence
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
        if (action.type === "navigate" && action.url && queuedNavigationUrls.has(action.url)) continue;
        if (current.depth + 1 > maxDepth) continue;
        if (uniqueUiStates + queue.length >= maxStates) continue;

        queuedPaths.add(pathKey);
        if (action.type === "navigate" && action.url) queuedNavigationUrls.add(action.url);
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

  const titleIssues = analyzePageTitles(states.map((state) => ({
    url: state.url,
    title: state.title
  })), config.framework).map((issue) => {
    const state = states.find((candidate) => candidate.url === issue.url);
    return {
      ...issue,
      stateId: state?.id,
      stateLabel: state?.actionLabel
    };
  });
  issues.push(...titleIssues);

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
        pagesVisited: new Set(states.map((state) => state.url)).size,
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

export function getDefaultExploreActionSafety(action: ExploreAction, baseUrl: string): ActionSafetyResult {
  return getExploreActionSafety(action, baseUrl, defaultSafeMode());
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
    const target = normalizeExploreUrl(action.url, baseUrl);
    const current = normalizeExploreUrl(baseUrl, baseUrl);
    if (!target) {
      return {
        safe: false,
        reason: "Navigation target is external, unsupported, or invalid."
      };
    }
    return target === current
      ? {
        safe: false,
        reason: "Navigation target resolves to the current page."
      }
      : { safe: true };
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
): Promise<DynamicAnnouncementEvidence | undefined> {
  await gotoAndSettle(page, startUrl, wait);
  let dynamicAnnouncements: DynamicAnnouncementEvidence | undefined;

  for (const [index, action] of actions.entries()) {
    if (action.type === "navigate" && action.url) {
      await gotoAndSettle(page, action.url, wait);
      continue;
    }

    if (!action.selector) continue;

    const observeAnnouncements = index === actions.length - 1;
    if (observeAnnouncements) await startDynamicAnnouncementMonitor(page);

    await page.locator(action.selector).first().click({
      timeout: 1500
    });
    await settle(page, wait);
    if (observeAnnouncements) {
      dynamicAnnouncements = await finishDynamicAnnouncementMonitor(page, action.label);
    }
  }

  return dynamicAnnouncements;
}

async function startDynamicAnnouncementMonitor(page: Page): Promise<void> {
  await page.evaluate(() => {
    type MonitorUpdate = {
      selector: string;
      role?: string;
      politeness: "assertive" | "polite" | "off" | "implicit";
      text: string;
    };
    type MonitorState = {
      observer: MutationObserver;
      regionsBefore: number;
      updates: MonitorUpdate[];
    };
    const monitorWindow = window as typeof window & { __a11yAnnouncementMonitor?: MonitorState };
    monitorWindow.__a11yAnnouncementMonitor?.observer.disconnect();
    const regionSelector = "[aria-live], [role='alert'], [role='status'], [role='log'], [role='timer'], [role='marquee']";

    function selectorFor(element: Element): string {
      const id = element.getAttribute("id");
      if (id) return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      const role = element.getAttribute("role");
      if (role) return `[role="${role}"]`;
      const live = element.getAttribute("aria-live");
      if (live) return `[aria-live="${live}"]`;
      return element.tagName.toLowerCase();
    }

    function updateFor(region: Element): MonitorUpdate {
      const role = region.getAttribute("role") || undefined;
      const ariaLive = region.getAttribute("aria-live");
      const politeness = ariaLive === "assertive" || ariaLive === "polite" || ariaLive === "off"
        ? ariaLive
        : role === "alert"
          ? "assertive"
          : role === "status" || role === "log"
            ? "polite"
            : "implicit";
      return {
        selector: selectorFor(region),
        role,
        politeness,
        text: (region.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300)
      };
    }

    const updates: MonitorUpdate[] = [];
    const record = (region: Element | null): void => {
      if (!region || updates.length >= 50) return;
      updates.push(updateFor(region));
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target.nodeType === Node.ELEMENT_NODE
          ? mutation.target as Element
          : mutation.target.parentElement;
        record(target?.closest(regionSelector) || null);
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const element = node as Element;
            record(element.matches(regionSelector) ? element : element.querySelector(regionSelector));
          }
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-live", "role", "aria-atomic", "aria-relevant"]
    });
    monitorWindow.__a11yAnnouncementMonitor = {
      observer,
      regionsBefore: document.querySelectorAll(regionSelector).length,
      updates
    };
  });
}

async function finishDynamicAnnouncementMonitor(
  page: Page,
  actionLabel: string
): Promise<DynamicAnnouncementEvidence | undefined> {
  return page.evaluate((label) => {
    type MonitorUpdate = DynamicAnnouncementEvidence["updates"][number];
    type MonitorState = {
      observer: MutationObserver;
      regionsBefore: number;
      updates: MonitorUpdate[];
    };
    const monitorWindow = window as typeof window & { __a11yAnnouncementMonitor?: MonitorState };
    const state = monitorWindow.__a11yAnnouncementMonitor;
    if (!state) return undefined;
    state.observer.disconnect();
    delete monitorWindow.__a11yAnnouncementMonitor;
    const selector = "[aria-live], [role='alert'], [role='status'], [role='log'], [role='timer'], [role='marquee']";
    const seen = new Set<string>();
    const updates = state.updates.filter((update) => {
      const key = `${update.selector}|${update.role || ""}|${update.politeness}|${update.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);

    return {
      actionLabel: label,
      regionsBefore: state.regionsBefore,
      regionsAfter: document.querySelectorAll(selector).length,
      updatesObserved: updates.length,
      meaningfulUpdates: updates.filter((update) => update.text.length > 0 && update.politeness !== "off").length,
      updates
    };
  }, actionLabel);
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
    const verification = await detectHumanVerification(page);
    if (verification) {
      return [createHumanVerificationIssue({
        source: "axe",
        framework: config.framework,
        url: page.url(),
        signal: verification,
        stateId: state.stateId,
        stateLabel: state.stateLabel
      })];
    }

    const results = await new AxeBuilder({ page })
      .options(getAxeRunOptions())
      .analyze();
    const issues: Issue[] = [];
    const frames = page.frames().map((frame) => ({ url: frame.url() }));

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
          ownership: inferIssueOwnership(selector, page.url(), frames),
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

interface RawAccessibilityValue {
  value?: string | number | boolean;
}

interface RawAccessibilityNode {
  ignored?: boolean;
  role?: RawAccessibilityValue;
  name?: RawAccessibilityValue;
  properties?: Array<{ name?: string; value?: RawAccessibilityValue }>;
}

export function summarizeAccessibilityTreeNodes(
  nodes: RawAccessibilityNode[]
): AccessibilityTreeEvidence {
  const visibleNodes = nodes.filter((node) => !node.ignored && typeof node.role?.value === "string");
  const normalized = visibleNodes.map((node) => {
    const role = String(node.role?.value || "unknown").toLowerCase();
    const name = typeof node.name?.value === "string" ? node.name.value.trim() : "";
    const levelProperty = node.properties?.find((property) => property.name === "level");
    const levelValue = Number(levelProperty?.value?.value);
    return {
      role,
      name: name || undefined,
      level: Number.isFinite(levelValue) && levelValue > 0 ? levelValue : undefined
    };
  });
  const interactiveRoles = new Set([
    "button", "checkbox", "combobox", "link", "listbox", "menuitem",
    "menuitemcheckbox", "menuitemradio", "option", "radio", "searchbox",
    "slider", "spinbutton", "switch", "tab", "textbox", "treeitem"
  ]);
  const landmarkRoles = new Set([
    "banner", "complementary", "contentinfo", "form", "main", "navigation",
    "region", "search"
  ]);
  const interactive = normalized.filter((node) => interactiveRoles.has(node.role));

  return {
    totalNodes: normalized.length,
    namedNodes: normalized.filter((node) => node.name).length,
    interactiveNodes: interactive.length,
    unnamedInteractiveNodes: interactive.filter((node) => !node.name).length,
    landmarks: normalized.filter((node) => landmarkRoles.has(node.role)).slice(0, 20),
    headings: normalized.filter((node) => node.role === "heading").slice(0, 30),
    interactiveSample: interactive.slice(0, 30)
  };
}

async function captureAccessibilityTree(page: Page): Promise<AccessibilityTreeEvidence | undefined> {
  const session = await page.context().newCDPSession(page).catch(() => undefined);
  if (!session) return undefined;

  try {
    await session.send("Accessibility.enable");
    const result = await session.send("Accessibility.getFullAXTree") as unknown as {
      nodes?: RawAccessibilityNode[];
    };
    return summarizeAccessibilityTreeNodes(result.nodes || []);
  } catch {
    return undefined;
  } finally {
    await session.detach().catch(() => undefined);
  }
}

async function auditReflow(
  page: Page,
  config: A11yConfig,
  state: {
    stateId: string;
    stateLabel: string;
    colorScheme: Issue["colorScheme"];
  }
): Promise<{ evidence: ReflowEvidence; issues: Issue[] }> {
  const originalViewport = page.viewportSize() || { width: 1280, height: 720 };
  const viewport = { width: 320, height: 800 };

  try {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const measuredEvidence = await page.evaluate(({ viewportWidth, viewportHeight }) => {
      function selectorFor(element: Element): string {
        const id = element.getAttribute("id");
        if (id) return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
        const testId = element.getAttribute("data-testid");
        if (testId) return `[data-testid="${testId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;

        const parts: string[] = [];
        let current: Element | null = element;
        while (current && current !== document.body && parts.length < 5) {
          const tag = current.tagName.toLowerCase();
          const parent: Element | null = current.parentElement;
          if (!parent) {
            parts.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children).filter((sibling) => sibling.tagName === current?.tagName);
          const index = siblings.indexOf(current) + 1;
          parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
          current = parent;
        }
        return parts.join(" > ") || element.tagName.toLowerCase();
      }

      const root = document.documentElement;
      const documentWidth = Math.max(root.scrollWidth, document.body?.scrollWidth || 0, window.innerWidth);
      const candidates = Array.from(document.body?.querySelectorAll("*") || []).filter((element) => {
        const htmlElement = element as HTMLElement;
        const style = window.getComputedStyle(htmlElement);
        const rect = htmlElement.getBoundingClientRect();
        const hasDirectText = Array.from(element.childNodes).some((node) => (
          node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
        ));
        const clipsOverflow = [style.overflow, style.overflowX, style.overflowY]
          .some((value) => value === "hidden" || value === "clip");
        const deliberateEllipsis = style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap";
        const deliberatelyVisuallyHidden = rect.width <= 2 && rect.height <= 2 && (
          style.position === "absolute" ||
          style.clip !== "auto" ||
          (style.clipPath !== "none" && style.clipPath !== "")
        );
        return hasDirectText && clipsOverflow && !deliberateEllipsis && !deliberatelyVisuallyHidden &&
          rect.width > 0 && rect.height > 0 &&
          style.visibility !== "hidden" && style.display !== "none" &&
          (htmlElement.scrollWidth > htmlElement.clientWidth + 1 || htmlElement.scrollHeight > htmlElement.clientHeight + 1);
      }).slice(0, 10).map((element) => {
        const htmlElement = element as HTMLElement;
        return {
          selector: selectorFor(element),
          text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
          horizontalOverflowPx: Math.max(0, htmlElement.scrollWidth - htmlElement.clientWidth),
          verticalOverflowPx: Math.max(0, htmlElement.scrollHeight - htmlElement.clientHeight)
        };
      });

      return {
        viewportWidth,
        viewportHeight,
        documentWidth,
        horizontalOverflowPx: Math.max(0, documentWidth - root.clientWidth),
        clippedTextCount: candidates.length,
        clippedTextSample: candidates
      };
    }, { viewportWidth: viewport.width, viewportHeight: viewport.height });
    const evidence = {
      ...measuredEvidence,
      horizontalOverflowPx: normalizeReflowOverflow(measuredEvidence.horizontalOverflowPx)
    };
    const common = {
      source: "layout",
      framework: config.framework,
      wcag: ["1.4.10"],
      tags: ["wcag1410", "heuristic"],
      severity: "warning" as const,
      confidence: "medium" as const,
      confidenceScore: 80,
      category: "layout" as const,
      findingType: "wcag" as const,
      url: page.url(),
      stateId: state.stateId,
      stateLabel: state.stateLabel,
      colorScheme: state.colorScheme
    };
    const issues: Issue[] = [];

    if (evidence.horizontalOverflowPx > 1) {
      issues.push({
        ...common,
        ruleId: "layout-horizontal-overflow",
        selector: "html",
        confidenceReason: "The rendered document exceeded a 320 CSS pixel viewport; horizontally scrolling content can indicate a WCAG 1.4.10 reflow failure.",
        message: `Page content is ${evidence.horizontalOverflowPx}px wider than the 320px reflow viewport.`
      });
    }

    for (const clipped of evidence.clippedTextSample) {
      issues.push({
        ...common,
        ruleId: "layout-clipped-text",
        selector: clipped.selector,
        confidenceScore: 70,
        confidenceReason: "Rendered text exceeded an element that clips overflow at 320 CSS pixels; review whether meaningful content becomes unavailable.",
        message: `Text may be clipped at 320px: "${clipped.text || clipped.selector}"`
      });
    }

    return { evidence, issues };
  } finally {
    await page.setViewportSize(originalViewport).catch(() => undefined);
    await page.waitForTimeout(50).catch(() => undefined);
  }
}

export function normalizeReflowOverflow(
  overflowPx: number,
  tolerancePx = REFLOW_OVERFLOW_TOLERANCE_PX
): number {
  if (!Number.isFinite(overflowPx) || overflowPx <= tolerancePx) return 0;
  return Math.max(0, overflowPx);
}

async function auditForcedColors(
  page: Page,
  config: A11yConfig,
  state: { stateId: string; stateLabel: string; colorScheme: Issue["colorScheme"] }
): Promise<{ evidence?: ForcedColorsEvidence; issues: Issue[] }> {
  try {
    await page.emulateMedia({ forcedColors: "active" });
    await page.waitForTimeout(50).catch(() => undefined);
    const evidence = await page.evaluate(({ controlLimit, sampleLimit }) => {
      type BrowserForcedColorsConcern =
        | "focus-indicator"
        | "background-image"
        | "hard-coded-svg-color"
        | "forced-color-adjust-none";
      type BrowserForcedColorsSample = {
        selector: string;
        concern: BrowserForcedColorsConcern;
        label?: string;
        detail: string;
      };

      function isVisible(element: Element): boolean {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" && style.visibility !== "hidden" &&
          style.opacity !== "0";
      }

      function escapeAttribute(value: string): string {
        return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      }

      function selectorFor(element: Element): string {
        const id = element.getAttribute("id");
        if (id) return `[id="${escapeAttribute(id)}"]`;
        const testId = element.getAttribute("data-testid");
        if (testId) return `[data-testid="${escapeAttribute(testId)}"]`;
        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel && ariaLabel.length < 60) {
          return `${element.tagName.toLowerCase()}[aria-label="${escapeAttribute(ariaLabel)}"]`;
        }

        const parts: string[] = [];
        let current: Element | null = element;
        while (current && current !== document.body && parts.length < 5) {
          const tag = current.tagName.toLowerCase();
          const parent: Element | null = current.parentElement;
          if (!parent) {
            parts.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children).filter((sibling) => sibling.tagName === current?.tagName);
          const index = siblings.indexOf(current) + 1;
          parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
          current = parent;
        }
        return parts.join(" > ") || element.tagName.toLowerCase();
      }

      function nameFor(element: Element): string {
        return (
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.getAttribute("alt") ||
          element.textContent ||
          ""
        ).replace(/\s+/g, " ").trim().slice(0, 80);
      }

      function addSample(samples: BrowserForcedColorsSample[], sample: BrowserForcedColorsSample): void {
        if (samples.length < sampleLimit) samples.push(sample);
      }

      function hasHardCodedSvgColor(svg: SVGElement): boolean {
        const colored = [svg, ...Array.from(svg.querySelectorAll("*"))].some((element) => {
          const fill = element.getAttribute("fill");
          const stroke = element.getAttribute("stroke");
          const style = element.getAttribute("style") || "";
          const value = [fill, stroke, style].filter(Boolean).join(" ");
          return /#(?:[0-9a-f]{3}){1,2}\b|rgb\(|hsl\(|\b(black|white|red|green|blue|gray|grey)\b/i.test(value) &&
            !/currentColor|CanvasText|ButtonText|LinkText|none/i.test(value);
        });
        return colored;
      }

      function focusIndicatorVisible(element: HTMLElement): boolean {
        element.focus({ preventScroll: true });
        const style = window.getComputedStyle(element);
        const outlineWidth = Number.parseFloat(style.outlineWidth || "0");
        const borderWidths = [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth
        ].map((value) => Number.parseFloat(value || "0"));
        const hasOutline = style.outlineStyle !== "none" && outlineWidth >= 1 && style.outlineColor !== "transparent";
        const hasBoxShadow = style.boxShadow !== "none" && style.boxShadow !== "";
        const hasVisibleBorder = borderWidths.some((width) => width >= 2) &&
          [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle]
            .some((value) => value !== "none" && value !== "hidden");
        return hasOutline || hasBoxShadow || hasVisibleBorder;
      }

      const samples: BrowserForcedColorsSample[] = [];
      const focusableSelector = [
        "a[href]",
        "button",
        "input:not([type='hidden'])",
        "select",
        "textarea",
        "[role='button']",
        "[role='link']",
        "[role='menuitem']",
        "[role='tab']",
        "[role='switch']",
        "[tabindex]:not([tabindex='-1'])"
      ].join(",");
      const focusable = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute("disabled") && isVisible(element))
        .slice(0, controlLimit);
      let focusRiskCount = 0;
      const activeBefore = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;

      for (const element of focusable) {
        if (!focusIndicatorVisible(element)) {
          focusRiskCount += 1;
          addSample(samples, {
            selector: selectorFor(element),
            concern: "focus-indicator",
            label: nameFor(element),
            detail: "No outline, border, or shadow focus indicator was detected while forced-colors was active."
          });
        }
      }
      activeBefore?.focus({ preventScroll: true });

      let backgroundImageRiskCount = 0;
      let forcedColorAdjustNoneCount = 0;
      let svgColorRiskCount = 0;
      const elements = Array.from(document.body?.querySelectorAll<HTMLElement>("*") || []);

      for (const element of elements) {
        if (!isVisible(element)) continue;
        const style = window.getComputedStyle(element);
        const label = nameFor(element);
        const interactive = element.matches(focusableSelector);
        const hasDirectText = Array.from(element.childNodes).some((node) => (
          node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
        ));
        const meaningful = interactive ||
          element.getAttribute("role") === "img" ||
          element.hasAttribute("aria-label") ||
          element.hasAttribute("title") ||
          hasDirectText;

        if (style.getPropertyValue("forced-color-adjust") === "none" && meaningful) {
          forcedColorAdjustNoneCount += 1;
          addSample(samples, {
            selector: selectorFor(element),
            concern: "forced-color-adjust-none",
            label,
            detail: "`forced-color-adjust: none` can prevent system high-contrast colors from being applied."
          });
        }

        if (style.backgroundImage && style.backgroundImage !== "none" && meaningful) {
          backgroundImageRiskCount += 1;
          addSample(samples, {
            selector: selectorFor(element),
            concern: "background-image",
            label,
            detail: "Meaningful text, role, or accessible name was found on an element that relies on a CSS background image."
          });
        }
      }

      for (const svg of Array.from(document.querySelectorAll<SVGElement>("svg"))) {
        if (!isVisible(svg) || !hasHardCodedSvgColor(svg)) continue;
        svgColorRiskCount += 1;
        addSample(samples, {
          selector: selectorFor(svg),
          concern: "hard-coded-svg-color",
          label: nameFor(svg),
          detail: "SVG uses hard-coded colors; prefer currentColor or system colors for high-contrast compatibility."
        });
      }

      return {
        supported: true,
        controlsChecked: focusable.length,
        focusRiskCount,
        backgroundImageRiskCount,
        svgColorRiskCount,
        forcedColorAdjustNoneCount,
        samples
      };
    }, {
      controlLimit: FORCED_COLORS_CONTROL_SAMPLE_LIMIT,
      sampleLimit: FORCED_COLORS_SAMPLE_LIMIT
    });

    return {
      evidence,
      issues: createForcedColorsIssues(config.framework, page.url(), state, evidence)
    };
  } catch (error) {
    return {
      evidence: {
        supported: false,
        controlsChecked: 0,
        focusRiskCount: 0,
        backgroundImageRiskCount: 0,
        svgColorRiskCount: 0,
        forcedColorAdjustNoneCount: 0,
        samples: [],
        error: error instanceof Error ? error.message : String(error)
      },
      issues: []
    };
  } finally {
    await page.emulateMedia({ forcedColors: "none" }).catch(() => undefined);
    await page.waitForTimeout(20).catch(() => undefined);
  }
}

export function createForcedColorsIssues(
  framework: A11yConfig["framework"],
  url: string,
  state: { stateId: string; stateLabel: string; colorScheme: Issue["colorScheme"] },
  evidence: ForcedColorsEvidence
): Issue[] {
  if (!evidence.supported) return [];

  const ruleForConcern: Record<ForcedColorsConcern, string> = {
    "focus-indicator": "forced-colors-focus-indicator-risk",
    "background-image": "forced-colors-background-image-risk",
    "hard-coded-svg-color": "forced-colors-hard-coded-svg-color",
    "forced-color-adjust-none": "forced-colors-adjust-none"
  };
  const wcagForConcern: Record<ForcedColorsConcern, string[]> = {
    "focus-indicator": ["2.4.7", "2.4.11"],
    "background-image": ["1.4.1", "1.4.11"],
    "hard-coded-svg-color": ["1.4.11"],
    "forced-color-adjust-none": ["1.4.11"]
  };
  const categoryForConcern: Record<ForcedColorsConcern, Issue["category"]> = {
    "focus-indicator": "focus",
    "background-image": "contrast",
    "hard-coded-svg-color": "contrast",
    "forced-color-adjust-none": "contrast"
  };

  return evidence.samples.map<Issue>((sample) => ({
    source: "forced-colors",
    framework,
    ruleId: ruleForConcern[sample.concern],
    wcag: wcagForConcern[sample.concern],
    tags: ["forced-colors", "high-contrast", "heuristic"],
    severity: sample.concern === "focus-indicator" || sample.concern === "forced-color-adjust-none"
      ? "warning"
      : "info",
    confidence: "low",
    confidenceScore: sample.concern === "focus-indicator" ? 65 : 55,
    confidenceReason: "This is a bounded forced-colors heuristic. Confirm the affected UI in Windows High Contrast or another system high-contrast mode.",
    category: categoryForConcern[sample.concern],
    findingType: "best-practice",
    selector: sample.selector,
    url,
    stateId: state.stateId,
    stateLabel: state.stateLabel,
    colorScheme: state.colorScheme,
    message: `${sample.detail}${sample.label ? ` Label: "${sample.label}".` : ""}`
  }));
}

async function inspectOpenModal(page: Page): Promise<ModalFocusEvidence | undefined> {
  return page.evaluate(() => {
    function isVisible(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }

    function selectorFor(element: Element): string {
      const id = element.getAttribute("id");
      if (id) return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      const role = element.getAttribute("role");
      if (role === "dialog" || role === "alertdialog") return `[role="${role}"]`;
      if (element.tagName.toLowerCase() === "dialog") return "dialog[open]";
      return element.tagName.toLowerCase();
    }

    function accessibleName(element: Element): string {
      const ariaLabel = element.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = element.getAttribute("aria-labelledby")?.trim().split(/\s+/).filter(Boolean) || [];
      const label = labelledBy.map((id) => document.getElementById(id)?.textContent?.trim() || "")
        .filter(Boolean).join(" ");
      if (label) return label;
      return element.getAttribute("title")?.trim() || "";
    }

    const dialogs = Array.from(document.querySelectorAll("dialog[open], [role='dialog'], [role='alertdialog']"))
      .filter(isVisible);
    const dialog = dialogs.at(-1);
    if (!dialog) return undefined;
    const active = document.activeElement;
    const name = accessibleName(dialog);

    return {
      dialogCount: dialogs.length,
      dialogSelector: selectorFor(dialog),
      isModal: dialog.getAttribute("aria-modal") === "true" || (
        dialog.tagName.toLowerCase() === "dialog" && dialog.matches(":modal")
      ),
      accessibleName: name || undefined,
      hasAccessibleName: Boolean(name),
      initialFocusSelector: active && active !== document.body && active !== document.documentElement
        ? selectorFor(active)
        : undefined,
      initialFocusInside: Boolean(active && dialog.contains(active)),
      escapeTested: false
    };
  });
}

async function auditModalFocusInIsolation(
  browser: Browser,
  startUrl: string,
  path: ExploreAction[],
  wait: ExploreWaitOptions,
  fallback: ModalFocusEvidence
): Promise<ModalFocusEvidence> {
  const context = await browser.newContext();
  const page = await context.newPage();
  attachExplorePopupGuard(page);

  try {
    const trigger = path.at(-1);
    const prefix = trigger ? path.slice(0, -1) : [];
    await replayPath(page, startUrl, prefix, wait);

    if (trigger?.type === "navigate" && trigger.url) {
      await gotoAndSettle(page, trigger.url, wait);
    } else if (trigger?.selector) {
      const locator = page.locator(trigger.selector).first();
      await locator.focus({ timeout: 1500 }).catch(() => undefined);
      await locator.click({ timeout: 1500 });
      await settle(page, wait);
    }

    const beforeEscape = await inspectOpenModal(page);
    if (!beforeEscape) return fallback;
    const containment = beforeEscape.isModal
      ? await auditModalFocusContainment(page, beforeEscape)
      : { containmentTested: false };
    await page.keyboard.press("Escape");
    await settle(page, { ...wait, waitForSelector: undefined });
    const afterEscape = await inspectOpenModal(page);
    const escapeClosed = !afterEscape;
    const focusReturnedToTrigger = escapeClosed && trigger?.selector
      ? await page.locator(trigger.selector).first().evaluate((element) => document.activeElement === element)
        .catch(() => false)
      : undefined;

    return {
      ...beforeEscape,
      triggerSelector: trigger?.selector,
      ...containment,
      escapeTested: true,
      escapeClosed,
      focusReturnedToTrigger
    };
  } catch {
    return fallback;
  } finally {
    await context.close();
  }
}

async function auditModalFocusContainment(
  page: Page,
  evidence: ModalFocusEvidence
): Promise<Pick<ModalFocusEvidence,
  "containmentTested" | "containmentSteps" | "forwardFocusContained" | "backwardFocusContained" | "escapedFocusSelector">> {
  const dialog = page.locator(evidence.dialogSelector).last();
  const focusableCount = await dialog.locator([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",")).count().catch(() => 0);
  if (focusableCount === 0) {
    return {
      containmentTested: true,
      containmentSteps: 0,
      forwardFocusContained: undefined,
      backwardFocusContained: undefined
    };
  }

  const steps = Math.min(focusableCount + 1, 20);
  const initialSelector = evidence.initialFocusSelector;
  const resetFocus = async (): Promise<void> => {
    if (initialSelector) {
      const restored = await page.locator(initialSelector).first().focus({ timeout: 500 })
        .then(() => true).catch(() => false);
      if (restored) return;
    }
    await dialog.locator([
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",")).first().focus({ timeout: 500 }).catch(() => undefined);
  };
  const focusInside = async (): Promise<{ inside: boolean; selector?: string }> => page.evaluate((selector) => {
    const matches = document.querySelectorAll(selector);
    const modal = matches.item(matches.length - 1);
    const active = document.activeElement;
    if (modal?.contains(active)) return { inside: true };
    if (!active) return { inside: false };
    const id = active.getAttribute("id");
    return {
      inside: false,
      selector: id ? `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]` : active.tagName.toLowerCase()
    };
  }, evidence.dialogSelector).catch(() => ({ inside: false, selector: "unknown" }));

  await resetFocus();
  let forwardFocusContained = true;
  let backwardFocusContained = true;
  let escapedFocusSelector: string | undefined;

  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press("Tab");
    const focused = await focusInside();
    if (!focused.inside) {
      forwardFocusContained = false;
      escapedFocusSelector = focused.selector;
      break;
    }
  }

  await resetFocus();
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press("Shift+Tab");
    const focused = await focusInside();
    if (!focused.inside) {
      backwardFocusContained = false;
      escapedFocusSelector ||= focused.selector;
      break;
    }
  }

  return {
    containmentTested: true,
    containmentSteps: steps,
    forwardFocusContained,
    backwardFocusContained,
    ...(escapedFocusSelector ? { escapedFocusSelector } : {})
  };
}

export function createModalFocusIssues(
  framework: A11yConfig["framework"],
  evidence: ModalFocusEvidence | undefined,
  state: {
    stateId: string;
    stateLabel: string;
    colorScheme: Issue["colorScheme"];
    url: string;
  }
): Issue[] {
  if (!evidence) return [];
  const common = {
    source: "modal",
    framework,
    severity: "warning" as const,
    confidence: "medium" as const,
    category: "focus" as const,
    url: state.url,
    stateId: state.stateId,
    stateLabel: state.stateLabel,
    colorScheme: state.colorScheme,
    selector: evidence.dialogSelector
  };
  const issues: Issue[] = [];

  if (!evidence.hasAccessibleName) {
    issues.push({
      ...common,
      ruleId: "modal-accessible-name-missing",
      wcag: ["4.1.2"],
      tags: ["wcag412", "heuristic"],
      category: "aria",
      confidenceScore: 85,
      confidenceReason: "A visible dialog was exposed without aria-label, aria-labelledby, or a title-based accessible name.",
      message: "Open dialog does not expose an accessible name."
    });
  }

  if (!evidence.initialFocusInside) {
    issues.push({
      ...common,
      ruleId: "modal-initial-focus-outside",
      wcag: ["2.4.3"],
      tags: ["wcag243", "heuristic"],
      confidenceScore: 80,
      confidenceReason: "Focus remained outside the visible modal after its trigger was activated.",
      message: "Initial focus did not move inside the opened dialog."
    });
  }

  if (evidence.escapeTested && evidence.escapeClosed === false) {
    issues.push({
      ...common,
      ruleId: "modal-escape-no-effect",
      wcag: [],
      tags: ["best-practice", "heuristic"],
      severity: "info",
      findingType: "best-practice",
      confidenceScore: 70,
      confidenceReason: "Escape did not close the isolated dialog; verify that another clearly named keyboard-operable close action is available.",
      message: "Escape did not close the dialog in the isolated interaction check."
    });
  }

  if (evidence.escapeTested && evidence.escapeClosed && evidence.triggerSelector && evidence.focusReturnedToTrigger === false) {
    issues.push({
      ...common,
      ruleId: "modal-focus-not-restored",
      wcag: ["2.4.3"],
      tags: ["wcag243", "heuristic"],
      confidenceScore: 80,
      confidenceReason: "The dialog closed with Escape but focus did not return to the control that opened it.",
      message: "Focus was not restored to the dialog trigger after closing."
    });
  }

  if (evidence.containmentTested && (
    evidence.forwardFocusContained === false || evidence.backwardFocusContained === false
  )) {
    issues.push({
      ...common,
      ruleId: "modal-focus-escapes",
      wcag: ["2.4.3"],
      tags: ["wcag243", "heuristic"],
      confidenceScore: 75,
      confidenceReason: "Bounded Tab or Shift+Tab traversal moved focus outside an open modal dialog.",
      message: `Keyboard focus escaped the modal dialog${evidence.escapedFocusSelector ? ` to ${evidence.escapedFocusSelector}` : ""}.`
    });
  }

  return issues;
}

async function auditFormErrors(
  page: Page,
  config: A11yConfig,
  state: {
    stateId: string;
    stateLabel: string;
    colorScheme: Issue["colorScheme"];
  }
): Promise<{ evidence?: FormErrorEvidence; issues: Issue[] }> {
  const evidence = await page.evaluate(() => {
    function selectorFor(element: Element): string {
      const id = element.getAttribute("id");
      if (id) return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      const name = element.getAttribute("name");
      if (name) return `${element.tagName.toLowerCase()}[name="${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      return element.tagName.toLowerCase();
    }

    function accessibleName(element: Element): string {
      const ariaLabel = element.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = element.getAttribute("aria-labelledby")?.trim().split(/\s+/).filter(Boolean) || [];
      const labelledText = labelledBy.map((id) => document.getElementById(id)?.textContent?.trim() || "")
        .filter(Boolean).join(" ");
      if (labelledText) return labelledText;
      const id = element.getAttribute("id");
      if (id) {
        const label = Array.from(document.querySelectorAll("label"))
          .find((candidate) => candidate.htmlFor === id)?.textContent?.trim();
        if (label) return label;
      }
      return element.getAttribute("placeholder")?.trim() || "";
    }

    function referenceText(id: string): string {
      const element = document.getElementById(id);
      if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") return "";
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return "";
      return (element.textContent || "").replace(/\s+/g, " ").trim();
    }

    const fields = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"));
    const invalidFields = fields.filter((field) => field.getAttribute("aria-invalid")?.toLowerCase() === "true")
      .slice(0, 30).map((field) => {
        const ids = [...new Set([
          ...(field.getAttribute("aria-errormessage") || "").split(/\s+/),
          ...(field.getAttribute("aria-describedby") || "").split(/\s+/)
        ].map((value) => value.trim()).filter(Boolean))];
        const associatedErrorText = ids.map(referenceText).filter(Boolean).join(" ");
        return {
          selector: selectorFor(field),
          accessibleName: accessibleName(field) || undefined,
          errorReferenceIds: ids,
          associatedErrorText: associatedErrorText || undefined,
          focused: document.activeElement === field
        };
      });
    const errorSummaryCount = Array.from(document.querySelectorAll("[role='alert'], [aria-live]"))
      .filter((element) => (element.textContent || "").trim().length > 0).length;

    if (document.querySelectorAll("form").length === 0 && fields.length === 0) return undefined;
    return {
      formCount: document.querySelectorAll("form").length,
      fieldCount: fields.length,
      invalidFieldCount: invalidFields.length,
      associatedErrorCount: invalidFields.filter((field) => field.associatedErrorText).length,
      unassociatedInvalidCount: invalidFields.filter((field) => !field.associatedErrorText).length,
      errorSummaryCount,
      invalidFields
    };
  });
  if (!evidence) return { issues: [] };
  const issues = createFormErrorIssues(config.framework, page.url(), state, evidence);

  return { evidence, issues };
}

interface RawImageAlternative {
  selector: string;
  alt: string | null;
  sourceKey: string;
  nearbyText: string;
}

export function analyzeImageAlternativeEvidence(images: RawImageAlternative[]): ImageAlternativeEvidence {
  const informative = images.filter((image) => typeof image.alt === "string" && image.alt.trim().length > 0);
  const repeated = new Map<string, { sources: Set<string>; count: number }>();

  for (const image of informative) {
    const key = normalizeAlternativeText(image.alt || "");
    const group = repeated.get(key) || { sources: new Set<string>(), count: 0 };
    group.sources.add(image.sourceKey);
    group.count += 1;
    repeated.set(key, group);
  }

  const samples: ImageAlternativeEvidence["samples"] = [];
  for (const image of informative) {
    const alt = image.alt?.trim() || "";
    const normalizedAlt = normalizeAlternativeText(alt);
    const sourceName = normalizeAlternativeText(image.sourceKey.replace(/\.[a-z0-9]{2,5}$/i, ""));
    const concerns: ImageAlternativeConcern[] = [];
    const repeatedGroup = repeated.get(normalizedAlt);
    const genericAlternatives = new Set(["image", "photo", "picture", "graphic", "icon", "logo"]);

    if (
      normalizedAlt === normalizeAlternativeText(image.sourceKey) ||
      normalizedAlt === sourceName ||
      /^(?:img|image|photo|dsc|screenshot)[-_ ]?\d+(?:\.[a-z0-9]+)?$/i.test(alt)
    ) concerns.push("filename");
    if (genericAlternatives.has(normalizedAlt)) concerns.push("generic");
    if (image.nearbyText && normalizeAlternativeText(image.nearbyText) === normalizedAlt) {
      concerns.push("nearby-text-duplicate");
    }
    if (repeatedGroup && repeatedGroup.count > 1 && repeatedGroup.sources.size > 1) {
      concerns.push("repeated");
    }
    if (alt.length > 150) concerns.push("excessive-length");

    if (concerns.length > 0) {
      samples.push({
        selector: image.selector,
        alt,
        concerns,
        ...(concerns.includes("repeated") ? { repeatedCount: repeatedGroup?.count } : {})
      });
    }
  }

  return {
    imageCount: images.length,
    decorativeCount: images.filter((image) => image.alt === "").length,
    informativeCount: informative.length,
    suspiciousCount: samples.length,
    repeatedAlternativeGroups: [...repeated.values()].filter((group) => group.count > 1 && group.sources.size > 1).length,
    samples: samples.slice(0, 30)
  };
}

async function auditImageAlternatives(
  page: Page,
  config: A11yConfig,
  state: {
    stateId: string;
    stateLabel: string;
    colorScheme: Issue["colorScheme"];
  }
): Promise<{ evidence?: ImageAlternativeEvidence; issues: Issue[] }> {
  const images = await page.evaluate(() => {
    function selectorFor(element: HTMLImageElement): string {
      if (element.id) return `[id="${element.id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      const alt = element.getAttribute("alt");
      if (alt) return `img[alt="${alt.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      return "img";
    }

    function sourceKey(element: HTMLImageElement): string {
      const source = element.currentSrc || element.src || "unknown-image";
      if (source.startsWith("data:")) return "inline-data";
      try {
        const pathname = new URL(source, document.baseURI).pathname;
        return decodeURIComponent(pathname.split("/").pop() || "unknown-image");
      } catch {
        return source.split(/[/?#]/).filter(Boolean).pop() || "unknown-image";
      }
    }

    function nearbyText(element: HTMLImageElement): string {
      const container = element.closest("a, button, figure") || element.parentElement;
      if (!container) return "";
      const clone = container.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("img, svg").forEach((node) => node.remove());
      return (clone.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300);
    }

    return Array.from(document.querySelectorAll("img")).slice(0, 100).map((element) => ({
      selector: selectorFor(element),
      alt: element.getAttribute("alt"),
      sourceKey: sourceKey(element),
      nearbyText: nearbyText(element)
    }));
  });
  if (images.length === 0) return { issues: [] };

  const evidence = analyzeImageAlternativeEvidence(images);
  const issues = createImageAlternativeIssues(config.framework, page.url(), state, evidence);
  return { evidence, issues };
}

export function createImageAlternativeIssues(
  framework: A11yConfig["framework"],
  url: string,
  state: { stateId: string; stateLabel: string; colorScheme: Issue["colorScheme"] },
  evidence: ImageAlternativeEvidence
): Issue[] {
  const ruleForConcern: Record<ImageAlternativeConcern, string> = {
    filename: "image-alt-filename",
    generic: "image-alt-generic",
    "nearby-text-duplicate": "image-alt-duplicates-nearby-text",
    repeated: "image-alt-repeated",
    "excessive-length": "image-alt-excessive-length"
  };
  const messageForConcern: Record<ImageAlternativeConcern, string> = {
    filename: "Alternative text appears to expose an image filename instead of its purpose.",
    generic: "Alternative text is too generic to communicate the image purpose.",
    "nearby-text-duplicate": "Alternative text duplicates nearby visible text and may be announced twice.",
    repeated: "The same alternative text is used for images with different sources; confirm that their purposes are identical.",
    "excessive-length": "Alternative text is unusually long; keep it concise or provide a longer description in nearby content."
  };

  return evidence.samples.flatMap((sample) => sample.concerns.map<Issue>((concern) => ({
    source: "image-quality",
    framework,
    ruleId: ruleForConcern[concern],
    wcag: ["1.1.1"],
    tags: ["wcag111", "best-practice", "heuristic"],
    severity: concern === "filename" || concern === "generic" ? "warning" : "info",
    confidence: "medium",
    confidenceScore: 75,
    confidenceReason: "The rendered alternative matches a deterministic quality pattern, but image purpose still requires human judgment.",
    category: "images",
    findingType: "best-practice",
    selector: sample.selector,
    url,
    stateId: state.stateId,
    stateLabel: state.stateLabel,
    colorScheme: state.colorScheme,
    message: `${messageForConcern[concern]} Current alt: "${sample.alt}"`
  })));
}

function normalizeAlternativeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

interface RawMediaEvidence {
  elements: MediaElementEvidence[];
  activeAnimationCount: number;
  reducedMotionQueryDetected: boolean;
  unreadableStylesheetCount: number;
}

export function analyzeMediaEvidence(raw: RawMediaEvidence): MediaEvidence {
  return {
    audioCount: raw.elements.filter((element) => element.kind === "audio").length,
    videoCount: raw.elements.filter((element) => element.kind === "video").length,
    videosWithCaptions: raw.elements.filter((element) => element.kind === "video" && element.captionTrackCount > 0).length,
    audioWithTranscriptCandidate: raw.elements.filter((element) => element.kind === "audio" && element.transcriptCandidate).length,
    autoplayRiskCount: raw.elements.filter((element) => element.autoplay && !element.muted && !element.controls).length,
    activeAnimationCount: raw.activeAnimationCount,
    reducedMotionQueryDetected: raw.reducedMotionQueryDetected,
    unreadableStylesheetCount: raw.unreadableStylesheetCount,
    elements: raw.elements.slice(0, 30)
  };
}

async function auditMedia(
  page: Page,
  config: A11yConfig,
  state: { stateId: string; stateLabel: string; colorScheme: Issue["colorScheme"] },
  scannedIssues: Issue[]
): Promise<{ evidence?: MediaEvidence; issues: Issue[] }> {
  const raw = await page.evaluate(() => {
    function selectorFor(element: Element): string {
      const id = element.getAttribute("id");
      if (id) return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.body && parts.length < 4) {
        const tag = current.tagName.toLowerCase();
        const parent: Element | null = current.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children).filter((sibling) => sibling.tagName === current?.tagName);
        parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})` : tag);
        current = parent;
      }
      return parts.join(" > ") || element.tagName.toLowerCase();
    }

    function hasTranscriptCandidate(element: Element): boolean {
      const container = element.closest("figure, article, section") || document.body;
      return Array.from(container.querySelectorAll("a[href], [data-transcript]"))
        .some((candidate) => /\b(transcript|text alternative)\b/i.test([
          candidate.textContent || "",
          candidate.getAttribute("href") || "",
          candidate.getAttribute("aria-label") || ""
        ].join(" ")));
    }

    let reducedMotionQueryDetected = false;
    let unreadableStylesheetCount = 0;
    for (const stylesheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(stylesheet.cssRules || []);
        if (rules.some((rule) => /prefers-reduced-motion/i.test(rule.cssText))) {
          reducedMotionQueryDetected = true;
        }
      } catch {
        unreadableStylesheetCount += 1;
      }
    }

    const elements = Array.from(document.querySelectorAll("audio, video")).slice(0, 30).map((element) => {
      const media = element as HTMLMediaElement;
      return {
        selector: selectorFor(element),
        kind: element.tagName.toLowerCase() as "audio" | "video",
        autoplay: media.autoplay,
        muted: media.muted || media.defaultMuted,
        controls: media.controls,
        captionTrackCount: element.querySelectorAll("track[kind='captions' i]").length,
        transcriptCandidate: hasTranscriptCandidate(element)
      };
    });

    return {
      elements,
      activeAnimationCount: document.getAnimations().filter((animation) => animation.playState === "running").length,
      reducedMotionQueryDetected,
      unreadableStylesheetCount
    };
  });
  const evidence = analyzeMediaEvidence(raw);
  if (evidence.audioCount === 0 && evidence.videoCount === 0 && evidence.activeAnimationCount === 0 && !evidence.reducedMotionQueryDetected) {
    return { issues: [] };
  }
  const coveredRules = new Set(scannedIssues.map((issue) => issue.ruleId).filter((ruleId): ruleId is string => Boolean(ruleId)));
  return {
    evidence,
    issues: createMediaIssues(config.framework, page.url(), state, evidence, coveredRules)
  };
}

export function createMediaIssues(
  framework: A11yConfig["framework"],
  url: string,
  state: { stateId: string; stateLabel: string; colorScheme: Issue["colorScheme"] },
  evidence: MediaEvidence,
  coveredRules = new Set<string>()
): Issue[] {
  const issues: Issue[] = [];
  const common = {
    source: "media-evidence",
    framework,
    tags: ["best-practice", "heuristic"],
    confidence: "medium" as const,
    confidenceScore: 70,
    confidenceReason: "Rendered markup provides a deterministic media signal, but media content, duration, and alternative quality require human review.",
    category: "media" as const,
    findingType: "best-practice" as const,
    url,
    stateId: state.stateId,
    stateLabel: state.stateLabel,
    colorScheme: state.colorScheme
  };

  for (const element of evidence.elements) {
    if (element.kind === "video" && element.captionTrackCount === 0 && !coveredRules.has("video-caption")) {
      issues.push({
        ...common,
        ruleId: "media-video-captions-not-detected",
        wcag: ["1.2.2"],
        severity: "info",
        selector: element.selector,
        message: "No captions track was detected for this video. Confirm whether it contains prerecorded audio and requires captions."
      });
    }
    if (element.kind === "audio" && !element.transcriptCandidate && !coveredRules.has("audio-caption")) {
      issues.push({
        ...common,
        ruleId: "media-audio-transcript-not-detected",
        wcag: ["1.2.1"],
        severity: "info",
        selector: element.selector,
        message: "No nearby transcript candidate was detected for this audio element. Confirm whether a text alternative is required."
      });
    }
    if (element.autoplay && !element.muted && !element.controls && !coveredRules.has("no-autoplay-audio")) {
      issues.push({
        ...common,
        ruleId: "media-autoplay-control-risk",
        wcag: ["1.4.2"],
        severity: "warning",
        selector: element.selector,
        message: "This media can autoplay with sound and exposes no native controls. Confirm that audio stops within three seconds or provide a pause or stop control."
      });
    }
  }

  return issues;
}

export function summarizeEmbeddedContentEvidence(input: {
  iframes: EmbeddedContentEvidence["iframes"];
  canvases: EmbeddedContentEvidence["canvases"];
}): EmbeddedContentEvidence {
  return {
    iframeCount: input.iframes.length,
    sameOriginIframeCount: input.iframes.filter((frame) => frame.sameOrigin).length,
    crossOriginIframeCount: input.iframes.filter((frame) => !frame.sameOrigin).length,
    inaccessibleIframeCount: input.iframes.filter((frame) => !frame.browserAccessible).length,
    canvasCount: input.canvases.length,
    canvasWithAlternativeCount: input.canvases.filter((canvas) => canvas.decorative || canvas.hasAccessibleAlternative).length,
    canvasWithoutAlternativeCount: input.canvases.filter((canvas) => !canvas.decorative && !canvas.hasAccessibleAlternative).length,
    iframes: input.iframes.slice(0, 30),
    canvases: input.canvases.slice(0, 30)
  };
}

async function auditEmbeddedContent(
  page: Page,
  config: A11yConfig,
  state: { stateId: string; stateLabel: string; colorScheme: Issue["colorScheme"] }
): Promise<{ evidence?: EmbeddedContentEvidence; issues: Issue[] }> {
  const frameAccess = await Promise.all(page.frames().filter((frame) => frame !== page.mainFrame()).map(async (frame) => {
    const url = sanitizeEvidenceUrl(frame.url());
    const browserAccessible = await frame.evaluate(() => Boolean(document.documentElement)).then(() => true).catch(() => false);
    return { url, browserAccessible };
  }));
  const raw = await page.evaluate(() => {
    function selectorFor(element: Element): string {
      const id = element.getAttribute("id");
      if (id) return `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      const tag = element.tagName.toLowerCase();
      const siblings = Array.from(document.querySelectorAll(tag));
      return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})` : tag;
    }

    function accessibleText(element: Element): string {
      const labelledBy = (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent || "").join(" ");
      return [
        element.getAttribute("aria-label") || "",
        labelledBy,
        element.getAttribute("title") || "",
        element.textContent || ""
      ].join(" ").replace(/\s+/g, " ").trim();
    }

    const baseOrigin = location.origin;
    const iframes = Array.from(document.querySelectorAll("iframe")).slice(0, 30).map((iframe) => {
      let resolved = "about:blank";
      try {
        const parsed = new URL(iframe.getAttribute("src") || "about:blank", document.baseURI);
        parsed.search = "";
        parsed.hash = "";
        resolved = parsed.href;
      } catch {
        resolved = "invalid-url";
      }
      let sameOrigin = resolved === "about:blank";
      try {
        sameOrigin ||= new URL(resolved).origin === baseOrigin;
      } catch {
        sameOrigin = false;
      }
      return {
        selector: selectorFor(iframe),
        url: resolved,
        sameOrigin,
        title: iframe.getAttribute("title")?.trim() || undefined
      };
    });
    const canvases = Array.from(document.querySelectorAll("canvas")).slice(0, 30).map((canvas) => {
      const role = canvas.getAttribute("role")?.toLowerCase();
      const decorative = canvas.getAttribute("aria-hidden") === "true" || role === "presentation" || role === "none";
      return {
        selector: selectorFor(canvas),
        width: canvas.width,
        height: canvas.height,
        decorative,
        hasAccessibleAlternative: accessibleText(canvas).length > 0
      };
    });
    return { iframes, canvases };
  });

  const accessByUrl = new Map<string, boolean>();
  for (const frame of frameAccess) {
    accessByUrl.set(frame.url, (accessByUrl.get(frame.url) || false) || frame.browserAccessible);
  }
  const iframes = raw.iframes.map((frame) => ({
    ...frame,
    browserAccessible: accessByUrl.get(frame.url) ?? false
  }));
  const evidence = summarizeEmbeddedContentEvidence({ iframes, canvases: raw.canvases });
  if (evidence.iframeCount === 0 && evidence.canvasCount === 0) return { issues: [] };
  return {
    evidence,
    issues: createEmbeddedContentIssues(config.framework, page.url(), state, evidence)
  };
}

export function createEmbeddedContentIssues(
  framework: A11yConfig["framework"],
  url: string,
  state: { stateId: string; stateLabel: string; colorScheme: Issue["colorScheme"] },
  evidence: EmbeddedContentEvidence
): Issue[] {
  const common = {
    framework,
    url,
    stateId: state.stateId,
    stateLabel: state.stateLabel,
    colorScheme: state.colorScheme
  };
  return [
    ...evidence.iframes.filter((frame) => !frame.browserAccessible).map<Issue>((frame) => ({
      ...common,
      source: "embedded-content",
      ruleId: "iframe-scan-unavailable",
      tags: ["coverage-gap"],
      severity: "info",
      confidence: "high",
      confidenceScore: 90,
      confidenceReason: "The browser exposed the iframe element but its document could not be evaluated during this run.",
      category: "adapter",
      findingType: "unmapped",
      selector: frame.selector,
      message: `Iframe document coverage was unavailable for ${frame.url}. Test the embedded content separately.`
    })),
    ...evidence.canvases.filter((canvas) => !canvas.decorative && !canvas.hasAccessibleAlternative).map<Issue>((canvas) => ({
      ...common,
      source: "embedded-content",
      ruleId: "canvas-alternative-not-detected",
      wcag: ["1.1.1"],
      tags: ["wcag111", "best-practice", "heuristic"],
      severity: "warning",
      confidence: "medium",
      confidenceScore: 70,
      confidenceReason: "The rendered canvas has dimensions and is not marked decorative, but its visual purpose cannot be inferred automatically.",
      category: "images",
      findingType: "best-practice",
      selector: canvas.selector,
      message: "No accessible name, fallback text, or fallback content was detected for this canvas. Confirm whether it conveys meaningful information."
    }))
  ];
}

function sanitizeEvidenceUrl(value: string): string {
  if (!value || value === "about:blank") return "about:blank";
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "invalid-url";
  }
}

export function createFormErrorIssues(
  framework: A11yConfig["framework"],
  url: string,
  state: {
    stateId: string;
    stateLabel: string;
    colorScheme: Issue["colorScheme"];
  },
  evidence: FormErrorEvidence
): Issue[] {
  return evidence.invalidFields.filter((field) => !field.associatedErrorText).map<Issue>((field) => ({
    source: "form",
    framework,
    ruleId: "form-invalid-error-not-associated",
    wcag: ["3.3.1", "3.3.2"],
    tags: ["wcag331", "wcag332", "heuristic"],
    severity: "warning",
    confidence: "medium",
    confidenceScore: 80,
    confidenceReason: "The rendered field is explicitly aria-invalid but has no existing, exposed, non-empty aria-errormessage or aria-describedby target.",
    category: "forms",
    findingType: "wcag",
    selector: field.selector,
    url,
    stateId: state.stateId,
    stateLabel: state.stateLabel,
    colorScheme: state.colorScheme,
    message: `${field.accessibleName || "Invalid field"} does not reference an accessible error message.`
  }));
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
        elementBounds: toDocumentPercentBounds(
          resolvedRects,
          index,
          captured
            ? {
              ...metrics,
              documentWidth: captured.width,
              documentHeight: captured.height
            }
            : metrics
        )
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
        kind: "evidence-crop",
        issueIndexes: clip.issueIndexes,
        filenameSuffix: `-evidence-${clipIndex + 1}`,
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
          elementBounds: rect && captured.clip
            ? toPercentBounds({
              x: rect.x - captured.clip.x,
              y: rect.y - captured.clip.y,
              width: rect.width,
              height: rect.height,
              containerWidth: captured.width,
              containerHeight: captured.height
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

export function normalizeScreenshotClip(
  clip: EvidenceClip,
  metrics: PageCaptureMetrics
): EvidenceClip | undefined {
  const documentWidth = Math.floor(metrics.documentWidth);
  const documentHeight = Math.floor(metrics.documentHeight);
  const values = [clip.x, clip.y, clip.width, clip.height, documentWidth, documentHeight];

  if (
    values.some((value) => !Number.isFinite(value)) ||
    clip.width <= 0 ||
    clip.height <= 0 ||
    documentWidth <= 0 ||
    documentHeight <= 0
  ) {
    return undefined;
  }

  const rawRight = clip.x + clip.width;
  const rawBottom = clip.y + clip.height;
  if (rawRight <= 0 || rawBottom <= 0 || clip.x >= documentWidth || clip.y >= documentHeight) {
    return undefined;
  }

  const x = Math.max(0, Math.floor(clip.x));
  const y = Math.max(0, Math.floor(clip.y));
  const right = Math.min(documentWidth, Math.ceil(rawRight));
  const bottom = Math.min(documentHeight, Math.ceil(rawBottom));
  const width = right - x;
  const height = bottom - y;

  if (width < 1 || height < 1) return undefined;

  return {
    x,
    y,
    width,
    height,
    issueIndexes: [...clip.issueIndexes]
  };
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

  const rawActions = prioritizeExploreActions(discovery.actions);
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
    const key = exploreActionKey(action);

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

export function prioritizeExploreActions<T extends {
  type?: ExploreAction["type"];
  label?: string;
  text?: string;
  selector?: string;
}>(actions: T[]): T[] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const rankDifference = exploreActionRank(left.action) - exploreActionRank(right.action);
      return rankDifference || left.index - right.index;
    })
    .map(({ action }) => action);
}

export function exploreActionKey(action: Pick<ExploreAction, "type" | "selector" | "url">): string {
  return action.type === "navigate"
    ? `navigate:${action.url}`
    : `${action.type}:${action.selector}`;
}

function exploreActionRank(action: {
  type?: ExploreAction["type"];
  label?: string;
  text?: string;
  selector?: string;
}): number {
  if (isThemeAction(action)) return 0;
  if (action.type === "navigate") return 1;
  return 2;
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
  let effectiveClip = options.clip
    ? normalizeScreenshotClip(options.clip, await readPageCaptureMetrics(page))
    : undefined;
  let effectiveKind = options.clip && !effectiveClip ? "viewport" : options.kind;

  const createScreenshotOptions = (
    clip: EvidenceClip | undefined
  ): Parameters<Page["screenshot"]>[0] => ({
    animations: "disabled",
    caret: "hide",
    path: screenshotPath,
    fullPage: clip ? false : options.fullPage && !options.clip,
    type: options.format,
    ...(clip ? {
      captureBeyondViewport: true,
      clip: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height
      }
    } : {}),
    ...(options.redactSensitiveFields ? {
      mask: [page.locator(SENSITIVE_SCREENSHOT_SELECTOR)],
      maskColor: SCREENSHOT_REDACTION_COLOR
    } : {}),
    ...(options.format === "jpeg" ? { quality: options.quality } : {})
  });

  let screenshotBuffer: Buffer;
  try {
    screenshotBuffer = await page.screenshot(createScreenshotOptions(effectiveClip));
  } catch {
    if (!effectiveClip) return undefined;

    // The document can resize again while Playwright waits for fonts.
    effectiveClip = undefined;
    effectiveKind = "viewport";
    const fallbackBuffer = await page.screenshot(createScreenshotOptions(undefined)).catch(() => undefined);
    if (!fallbackBuffer) return undefined;
    screenshotBuffer = fallbackBuffer;
  }
  const dimensions = readScreenshotDimensions(screenshotBuffer, options.format);

  return {
    path: path.posix.join("screenshots", filename),
    fingerprint: hashBuffer(screenshotBuffer),
    kind: effectiveKind,
    issueIndexes: options.issueIndexes,
    width: dimensions?.width || options.imageWidth,
    height: dimensions?.height || options.imageHeight,
    clip: effectiveClip
  };
}

export function readScreenshotDimensions(
  buffer: Buffer,
  format: ScreenshotFormat
): { width: number; height: number } | undefined {
  if (format === "png") {
    if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return undefined;
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : undefined;
  }

  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf
  ]);
  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 1 >= buffer.length) return undefined;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return undefined;

    if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return width > 0 && height > 0 ? { width, height } : undefined;
    }

    offset += segmentLength;
  }

  return undefined;
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
