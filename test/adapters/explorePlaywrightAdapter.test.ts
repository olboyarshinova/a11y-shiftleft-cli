import test from "node:test";
import assert from "node:assert/strict";
import {
  attachExplorePopupGuard,
  createEvidenceClips,
  getExploreActionSafety,
  isAdvertisingActionContext,
  isCookieConsentContext,
  isSafeExploreAction,
  isSafeExploreActionWithConfig,
  normalizeExploreUrl,
  prioritizeThemeActions,
  SENSITIVE_SCREENSHOT_SELECTOR,
  isThemeAction,
  shouldCaptureFullPageScreenshot
} from "../../dist/adapters/explorePlaywrightAdapter.js";

test("attachExplorePopupGuard closes popup pages without observing the primary page", async () => {
  let registeredEvent = "";
  let popupListener: ((popup: { close(): Promise<void> }) => Promise<void>) | undefined;
  let popupClosed = false;

  attachExplorePopupGuard({
    on(event, listener) {
      registeredEvent = event;
      popupListener = listener;
    }
  });

  assert.equal(registeredEvent, "popup");
  assert.ok(popupListener);
  await popupListener({
    async close() {
      popupClosed = true;
    }
  });
  assert.equal(popupClosed, true);
});

test("normalizeExploreUrl keeps same-origin HTTP URLs and removes hash", () => {
  assert.equal(
    normalizeExploreUrl("/settings#profile", "http://localhost:3000/"),
    "http://localhost:3000/settings"
  );
  assert.equal(
    normalizeExploreUrl("https://example.com/docs", "http://localhost:3000/"),
    null
  );
  assert.equal(
    normalizeExploreUrl("mailto:team@example.com", "http://localhost:3000/"),
    null
  );
});

test("isSafeExploreAction allows low-risk UI expansion actions", () => {
  assert.equal(isSafeExploreAction({
    id: "menu",
    type: "click",
    selector: "[aria-label=\"Open menu\"]",
    label: "Click: Open menu",
    text: "Open menu",
    role: "button"
  }, "http://localhost:3000/"), true);

  assert.equal(isSafeExploreAction({
    id: "details",
    type: "click",
    selector: "details > summary",
    label: "Click: More details",
    text: "More details",
    role: "summary"
  }, "http://localhost:3000/"), true);
});

test("isSafeExploreAction blocks dangerous or external actions", () => {
  assert.equal(isSafeExploreAction({
    id: "delete",
    type: "click",
    selector: "button:nth-of-type(2)",
    label: "Click: Delete account",
    text: "Delete account",
    role: "button"
  }, "http://localhost:3000/"), false);

  assert.equal(isSafeExploreAction({
    id: "payment",
    type: "navigate",
    url: "http://localhost:3000/checkout",
    label: "Navigate: Checkout",
    text: "Checkout",
    role: "a"
  }, "http://localhost:3000/"), false);

  assert.equal(isSafeExploreAction({
    id: "external",
    type: "navigate",
    url: "https://example.com/",
    label: "Navigate: external docs",
    text: "external docs",
    role: "a"
  }, "http://localhost:3000/"), false);
});

test("isSafeExploreAction blocks high-risk actions across common languages", () => {
  const unsafeActions = [
    ["logout", "Click: Log out"],
    ["pay", "Click: Pay now"],
    ["cookies", "Click: Accept all cookies"],
    ["camera", "Click: Take photo"],
    ["microphone", "Click: Enable microphone"],
    ["location", "Click: Share location"],
    ["russian-pay", "Click: Оплатить заказ"],
    ["spanish-camera", "Click: Activar cámara"],
    ["french-mic", "Click: Activer le micro"],
    ["chinese-cookie", "Click: 同意 Cookie"],
    ["japanese-photo", "Click: 写真を撮る"]
  ] as const;

  for (const [id, label] of unsafeActions) {
    assert.equal(isSafeExploreAction({
      id,
      type: "click",
      selector: `#${id}`,
      label,
      text: label.replace("Click: ", ""),
      role: "button"
    }, "http://localhost:3000/"), false, label);
  }
});

test("isSafeExploreAction blocks advertising and sponsored actions", () => {
  const unsafeActions = [
    ["advertisement", "Navigate: Advertisement", "http://localhost:3000/ads/click"],
    ["sponsored", "Navigate: Sponsored story", "http://localhost:3000/story"],
    ["russian-ad", "Click: Реклама", undefined],
    ["spanish-ad", "Click: Contenido patrocinado", undefined],
    ["japanese-ad", "Click: 広告", undefined]
  ] as const;

  for (const [id, label, url] of unsafeActions) {
    assert.equal(isSafeExploreAction({
      id,
      type: url ? "navigate" : "click",
      selector: `#${id}`,
      url,
      label,
      text: label.replace(/^(Navigate|Click): /, ""),
      role: url ? "a" : "button"
    }, "http://localhost:3000/"), false, label);
  }
});

test("isAdvertisingActionContext recognizes ad metadata and networks", () => {
  assert.equal(isAdvertisingActionContext("rel=sponsored"), true);
  assert.equal(isAdvertisingActionContext("class=ad-banner"), true);
  assert.equal(isAdvertisingActionContext("https://googleadservices.com/pagead/aclk"), true);
  assert.equal(isAdvertisingActionContext("Open navigation menu"), false);
});

test("isCookieConsentContext recognizes consent surfaces with short action labels", () => {
  assert.equal(isCookieConsentContext("Airbnb cookie preferences Accept"), true);
  assert.equal(isCookieConsentContext("Privacy choices OK"), true);
  assert.equal(isCookieConsentContext("Настройки конфиденциальности Принять"), true);
  assert.equal(isCookieConsentContext("Open navigation menu"), false);
});

test("isSafeExploreActionWithConfig applies custom safe-mode patterns", () => {
  const safeMode = {
    enabled: true,
    blockedText: ["archive*", "settings"],
    blockedRoles: ["menuitem"],
    blockedUrls: ["*/account/*"],
    blockedSelectors: ["[data-danger]"],
    allowedSelectors: ["[data-a11y-explore]"],
    dismissDialogs: true,
    isolateCookies: true
  };

  assert.equal(isSafeExploreActionWithConfig({
    id: "archive",
    type: "click",
    selector: "button",
    label: "Click: Archive item",
    text: "Archive item",
    role: "button"
  }, "http://localhost:3000/", safeMode), false);

  assert.equal(isSafeExploreActionWithConfig({
    id: "role",
    type: "click",
    selector: "[role=\"menuitem\"]",
    label: "Click: Preferences",
    text: "Preferences",
    role: "menuitem"
  }, "http://localhost:3000/", safeMode), false);

  assert.equal(isSafeExploreActionWithConfig({
    id: "url",
    type: "navigate",
    url: "http://localhost:3000/account/billing",
    label: "Navigate: Billing",
    text: "Billing",
    role: "a"
  }, "http://localhost:3000/", safeMode), false);

  assert.equal(isSafeExploreActionWithConfig({
    id: "selector",
    type: "click",
    selector: "[data-danger]",
    label: "Click: Open panel",
    text: "Open panel",
    role: "button"
  }, "http://localhost:3000/", safeMode), false);
});

test("getExploreActionSafety returns reviewable skip reasons", () => {
  const safety = getExploreActionSafety({
    id: "payment",
    type: "navigate",
    url: "http://localhost:3000/checkout",
    label: "Navigate: Checkout",
    text: "Checkout",
    role: "a"
  }, "http://localhost:3000/", {
    enabled: true,
    blockedText: [],
    blockedRoles: [],
    blockedUrls: [],
    blockedSelectors: [],
    allowedSelectors: ["[data-a11y-explore]"],
    dismissDialogs: true,
    isolateCookies: true
  });

  assert.equal(safety.safe, false);
  assert.match(safety.reason || "", /high-risk action/);
});

test("getExploreActionSafety explains advertising blocks", () => {
  const safety = getExploreActionSafety({
    id: "sponsored",
    type: "navigate",
    selector: "[rel='sponsored']",
    url: "http://localhost:3000/promoted-story",
    label: "Navigate: Sponsored story",
    text: "Sponsored story",
    role: "a"
  }, "http://localhost:3000/", {
    enabled: false,
    blockedText: [],
    blockedRoles: [],
    blockedUrls: [],
    blockedSelectors: [],
    allowedSelectors: ["[data-a11y-explore]"],
    dismissDialogs: false,
    isolateCookies: false
  });

  assert.equal(safety.safe, false);
  assert.match(safety.reason || "", /Advertising and sponsored content/);
});

test("isSafeExploreActionWithConfig keeps hard blocks when safe mode is disabled", () => {
  const safeMode = {
    enabled: false,
    blockedText: [],
    blockedRoles: [],
    blockedUrls: [],
    blockedSelectors: [],
    allowedSelectors: ["[data-a11y-explore]"],
    dismissDialogs: false,
    isolateCookies: false
  };

  assert.equal(isSafeExploreActionWithConfig({
    id: "delete",
    type: "click",
    selector: "button:nth-of-type(2)",
    label: "Click: Delete account",
    text: "Delete account",
    role: "button"
  }, "http://localhost:3000/", safeMode), true);

  assert.equal(isSafeExploreActionWithConfig({
    id: "pay",
    type: "click",
    selector: "button:nth-of-type(3)",
    label: "Click: Pay now",
    text: "Pay now",
    role: "button"
  }, "http://localhost:3000/", safeMode), false);

  assert.equal(isSafeExploreActionWithConfig({
    id: "external",
    type: "navigate",
    url: "https://example.com/",
    label: "Navigate: external docs",
    text: "external docs",
    role: "a"
  }, "http://localhost:3000/", safeMode), false);
});

test("SENSITIVE_SCREENSHOT_SELECTOR covers common private form fields", () => {
  assert.match(SENSITIVE_SCREENSHOT_SELECTOR, /\[data-a11y-sensitive\]/);
  assert.match(SENSITIVE_SCREENSHOT_SELECTOR, /input\[type='password'\]/);
  assert.match(SENSITIVE_SCREENSHOT_SELECTOR, /input\[type='email'\]/);
  assert.match(SENSITIVE_SCREENSHOT_SELECTOR, /autocomplete\*='cc-'/);
  assert.match(SENSITIVE_SCREENSHOT_SELECTOR, /name\*='token'/);
});

test("shouldCaptureFullPageScreenshot captures finding states automatically", () => {
  assert.equal(shouldCaptureFullPageScreenshot(false, 0), false);
  assert.equal(shouldCaptureFullPageScreenshot(false, 1), true);
  assert.equal(shouldCaptureFullPageScreenshot(false, 1, 5000), false);
  assert.equal(shouldCaptureFullPageScreenshot(true, 0), true);
});

test("createEvidenceClips groups nearby errors and separates distant regions", () => {
  const clips = createEvidenceClips([
    { issueIndex: 0, rect: { x: 100, y: 400, width: 200, height: 40 } },
    { issueIndex: 1, rect: { x: 120, y: 560, width: 180, height: 40 } },
    { issueIndex: 2, rect: { x: 80, y: 3600, width: 240, height: 50 } }
  ], {
    documentWidth: 1280,
    documentHeight: 6000,
    viewportWidth: 1280,
    viewportHeight: 720
  });

  assert.equal(clips.length, 2);
  assert.deepEqual(clips[0].issueIndexes, [0, 1]);
  assert.deepEqual(clips[1].issueIndexes, [2]);
  assert.ok(clips.every((clip) => clip.height <= 900));
  assert.ok(clips.every((clip) => clip.width <= 1600));
});

test("isThemeAction recognizes common theme toggles", () => {
  assert.equal(isThemeAction({
    type: "click",
    selector: "[data-testid=theme-toggle]",
    label: "Switch to dark mode",
    role: "button"
  }), true);
  assert.equal(isThemeAction({
    type: "click",
    selector: "#menu",
    label: "Open navigation",
    role: "button"
  }), false);
});

test("prioritizeThemeActions keeps theme controls inside bounded exploration", () => {
  const actions = prioritizeThemeActions([
    { label: "Open navigation", selector: "#menu" },
    { label: "Switch to dark mode", selector: "#theme" },
    { label: "Show details", selector: "#details" }
  ]);

  assert.equal(actions[0].selector, "#theme");
  assert.deepEqual(actions.slice(1).map((action) => action.selector), [
    "#menu",
    "#details"
  ]);
});
