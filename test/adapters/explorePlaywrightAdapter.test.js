import test from "node:test";
import assert from "node:assert/strict";
import {
  isSafeExploreAction,
  normalizeExploreUrl
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
