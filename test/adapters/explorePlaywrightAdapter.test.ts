import test from "node:test";
import assert from "node:assert/strict";
import {
  attachExplorePopupGuard,
  analyzeImageAlternativeEvidence,
  analyzeMediaEvidence,
  createFormErrorIssues,
  createImageAlternativeIssues,
  createMediaIssues,
  createEmbeddedContentIssues,
  createEvidenceClips,
  getExploreActionSafety,
  isAdvertisingActionContext,
  isCookieConsentContext,
  isSafeExploreAction,
  isSafeExploreActionWithConfig,
  normalizeExploreUrl,
  prioritizeThemeActions,
  readScreenshotDimensions,
  SENSITIVE_SCREENSHOT_SELECTOR,
  isThemeAction,
  shouldCaptureFullPageScreenshot,
  summarizeEmbeddedContentEvidence,
  summarizeAccessibilityTreeNodes
} from "../../dist/adapters/explorePlaywrightAdapter.js";

test("readScreenshotDimensions reads PNG and JPEG dimensions", () => {
  const png = Buffer.alloc(24);
  png.write("PNG", 1, "ascii");
  png.writeUInt32BE(1280, 16);
  png.writeUInt32BE(896, 20);

  const jpeg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0,
    0x00, 0x11,
    0x08,
    0x02, 0xd0,
    0x05, 0x00,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9
  ]);

  assert.deepEqual(readScreenshotDimensions(png, "png"), {
    width: 1280,
    height: 896
  });
  assert.deepEqual(readScreenshotDimensions(jpeg, "jpeg"), {
    width: 1280,
    height: 720
  });
  assert.equal(readScreenshotDimensions(Buffer.from("invalid"), "jpeg"), undefined);
});

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

test("summarizeAccessibilityTreeNodes keeps compact semantic evidence", () => {
  const evidence = summarizeAccessibilityTreeNodes([
    { role: { value: "RootWebArea" }, name: { value: "Demo" } },
    { role: { value: "main" }, name: { value: "Main content" } },
    { role: { value: "heading" }, name: { value: "Account" }, properties: [{ name: "level", value: { value: 1 } }] },
    { role: { value: "button" }, name: { value: "Save" } },
    { role: { value: "button" }, name: { value: "" } },
    { ignored: true, role: { value: "link" }, name: { value: "Ignored" } }
  ]);

  assert.equal(evidence.totalNodes, 5);
  assert.equal(evidence.interactiveNodes, 2);
  assert.equal(evidence.unnamedInteractiveNodes, 1);
  assert.deepEqual(evidence.landmarks[0], { role: "main", name: "Main content", level: undefined });
  assert.equal(evidence.headings[0].level, 1);
});

test("createFormErrorIssues reports only invalid fields without exposed associated errors", () => {
  const issues = createFormErrorIssues("react", "http://localhost:3000/checkout", {
    stateId: "state-1",
    stateLabel: "Initial page",
    colorScheme: "light"
  }, {
    formCount: 1,
    fieldCount: 2,
    invalidFieldCount: 2,
    associatedErrorCount: 1,
    unassociatedInvalidCount: 1,
    errorSummaryCount: 0,
    invalidFields: [{
      selector: "#email",
      accessibleName: "Email",
      errorReferenceIds: ["email-error"],
      associatedErrorText: "Email is required",
      focused: true
    }, {
      selector: "#zip",
      accessibleName: "ZIP code",
      errorReferenceIds: ["missing-error"],
      focused: false
    }]
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].selector, "#zip");
  assert.deepEqual(issues[0].wcag, ["3.3.1", "3.3.2"]);
  assert.equal(issues[0].severity, "warning");
  assert.match(issues[0].message, /ZIP code/);
});

test("analyzeImageAlternativeEvidence detects deterministic quality patterns without flagging decorative images", () => {
  const evidence = analyzeImageAlternativeEvidence([
    { selector: "#decorative", alt: "", sourceKey: "divider.svg", nearbyText: "" },
    { selector: "#filename", alt: "IMG_2048.jpg", sourceKey: "IMG_2048.jpg", nearbyText: "" },
    { selector: "#generic", alt: "Image", sourceKey: "product.webp", nearbyText: "" },
    { selector: "#brand", alt: "Acme", sourceKey: "logo-a.svg", nearbyText: "Acme" },
    { selector: "#brand-footer", alt: "Acme", sourceKey: "logo-b.svg", nearbyText: "" },
    { selector: "#good", alt: "Customer reviewing an order summary", sourceKey: "review.webp", nearbyText: "" }
  ]);

  assert.equal(evidence.imageCount, 6);
  assert.equal(evidence.decorativeCount, 1);
  assert.equal(evidence.suspiciousCount, 4);
  assert.equal(evidence.repeatedAlternativeGroups, 1);
  assert.deepEqual(evidence.samples.find((sample) => sample.selector === "#filename")?.concerns, ["filename"]);
  assert.deepEqual(evidence.samples.find((sample) => sample.selector === "#generic")?.concerns, ["generic"]);
  assert.deepEqual(evidence.samples.find((sample) => sample.selector === "#brand")?.concerns, ["nearby-text-duplicate", "repeated"]);
  assert.equal(evidence.samples.some((sample) => sample.selector === "#decorative"), false);
  assert.equal(evidence.samples.some((sample) => sample.selector === "#good"), false);
});

test("createImageAlternativeIssues keeps quality heuristics review-oriented", () => {
  const evidence = analyzeImageAlternativeEvidence([
    { selector: "#hero", alt: "hero-banner.png", sourceKey: "hero-banner.png", nearbyText: "" }
  ]);
  const issues = createImageAlternativeIssues("react", "http://localhost:3000", {
    stateId: "state-1",
    stateLabel: "Initial page",
    colorScheme: undefined
  }, evidence);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "image-alt-filename");
  assert.equal(issues[0].findingType, "best-practice");
  assert.equal(issues[0].confidence, "medium");
  assert.deepEqual(issues[0].wcag, ["1.1.1"]);
});

test("analyzeMediaEvidence summarizes captions, transcripts, autoplay, and motion", () => {
  const evidence = analyzeMediaEvidence({
    elements: [{
      selector: "#video",
      kind: "video",
      autoplay: true,
      muted: false,
      controls: false,
      captionTrackCount: 1,
      transcriptCandidate: false
    }, {
      selector: "#audio",
      kind: "audio",
      autoplay: false,
      muted: false,
      controls: true,
      captionTrackCount: 0,
      transcriptCandidate: true
    }],
    activeAnimationCount: 2,
    reducedMotionQueryDetected: true,
    unreadableStylesheetCount: 1
  });

  assert.equal(evidence.audioCount, 1);
  assert.equal(evidence.videoCount, 1);
  assert.equal(evidence.videosWithCaptions, 1);
  assert.equal(evidence.audioWithTranscriptCandidate, 1);
  assert.equal(evidence.autoplayRiskCount, 1);
  assert.equal(evidence.activeAnimationCount, 2);
  assert.equal(evidence.reducedMotionQueryDetected, true);
});

test("createMediaIssues avoids duplicating equivalent axe findings", () => {
  const evidence = analyzeMediaEvidence({
    elements: [{
      selector: "#video",
      kind: "video",
      autoplay: true,
      muted: false,
      controls: false,
      captionTrackCount: 0,
      transcriptCandidate: false
    }],
    activeAnimationCount: 0,
    reducedMotionQueryDetected: false,
    unreadableStylesheetCount: 0
  });
  const state = { stateId: "state-1", stateLabel: "Initial page", colorScheme: undefined };
  const standalone = createMediaIssues("react", "http://localhost:3000", state, evidence);
  const covered = createMediaIssues("react", "http://localhost:3000", state, evidence, new Set([
    "video-caption",
    "no-autoplay-audio"
  ]));

  assert.deepEqual(standalone.map((issue) => issue.ruleId), [
    "media-video-captions-not-detected",
    "media-autoplay-control-risk"
  ]);
  assert.equal(covered.length, 0);
});

test("summarizeEmbeddedContentEvidence separates frame coverage and canvas alternatives", () => {
  const evidence = summarizeEmbeddedContentEvidence({
    iframes: [{
      selector: "#local-frame",
      url: "http://localhost:3000/help",
      sameOrigin: true,
      title: "Help",
      browserAccessible: true
    }, {
      selector: "#external-frame",
      url: "https://example.com/widget",
      sameOrigin: false,
      browserAccessible: false
    }],
    canvases: [{
      selector: "#chart",
      width: 600,
      height: 400,
      decorative: false,
      hasAccessibleAlternative: false
    }, {
      selector: "#decoration",
      width: 20,
      height: 20,
      decorative: true,
      hasAccessibleAlternative: false
    }]
  });

  assert.equal(evidence.iframeCount, 2);
  assert.equal(evidence.sameOriginIframeCount, 1);
  assert.equal(evidence.crossOriginIframeCount, 1);
  assert.equal(evidence.inaccessibleIframeCount, 1);
  assert.equal(evidence.canvasWithoutAlternativeCount, 1);
  assert.equal(evidence.canvasWithAlternativeCount, 1);
});

test("createEmbeddedContentIssues separates coverage gaps from canvas review signals", () => {
  const evidence = summarizeEmbeddedContentEvidence({
    iframes: [{ selector: "#frame", url: "https://example.com/widget", sameOrigin: false, browserAccessible: false }],
    canvases: [{ selector: "#chart", width: 600, height: 400, decorative: false, hasAccessibleAlternative: false }]
  });
  const issues = createEmbeddedContentIssues("react", "http://localhost:3000", {
    stateId: "state-1",
    stateLabel: "Initial page",
    colorScheme: undefined
  }, evidence);

  assert.deepEqual(issues.map((issue) => issue.ruleId), [
    "iframe-scan-unavailable",
    "canvas-alternative-not-detected"
  ]);
  assert.equal(issues[0].findingType, "unmapped");
  assert.equal(issues[1].findingType, "best-practice");
  assert.deepEqual(issues[1].wcag, ["1.1.1"]);
});
