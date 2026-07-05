import test from "node:test";
import assert from "node:assert/strict";
import {
  browserEvidenceName,
  normalizeBrowserEngine,
  supportedBrowserEnginesText
} from "../../dist/core/browserRuntime.js";

test("normalizeBrowserEngine keeps supported engines", () => {
  assert.equal(normalizeBrowserEngine("chromium"), "chromium");
  assert.equal(normalizeBrowserEngine("firefox"), "firefox");
  assert.equal(normalizeBrowserEngine("webkit"), "webkit");
});

test("normalizeBrowserEngine falls back to chromium for unsupported engines", () => {
  assert.equal(normalizeBrowserEngine(undefined), "chromium");
  assert.equal(normalizeBrowserEngine("safari"), "chromium");
});

test("browserEvidenceName includes Playwright device names", () => {
  assert.equal(browserEvidenceName("webkit", "iPhone 13"), "WebKit (iPhone 13)");
  assert.equal(browserEvidenceName("firefox", undefined), "Firefox");
});

test("supportedBrowserEnginesText lists CLI engine choices", () => {
  assert.equal(supportedBrowserEnginesText(), "chromium, firefox, webkit");
});
