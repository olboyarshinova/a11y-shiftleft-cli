import test from "node:test";
import assert from "node:assert/strict";
import {
  isSafeExploreAction,
  isSafeExploreActionWithConfig,
  normalizeExploreUrl,
  SENSITIVE_SCREENSHOT_SELECTOR
} from "../../dist/adapters/explorePlaywrightAdapter.js";

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

test("isSafeExploreActionWithConfig applies custom safe-mode patterns", () => {
  const safeMode = {
    enabled: true,
    blockedText: ["archive*", "settings"],
    blockedRoles: ["menuitem"],
    blockedUrls: ["*/account/*"],
    blockedSelectors: ["[data-danger]"],
    allowedSelectors: ["[data-a11y-explore]"],
    dismissDialogs: true
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

test("isSafeExploreActionWithConfig still blocks external URLs when safe mode is disabled", () => {
  const safeMode = {
    enabled: false,
    blockedText: [],
    blockedRoles: [],
    blockedUrls: [],
    blockedSelectors: [],
    allowedSelectors: ["[data-a11y-explore]"],
    dismissDialogs: false
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
