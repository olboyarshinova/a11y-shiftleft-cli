import test from "node:test";
import assert from "node:assert/strict";
import { hidePageElements, normalizeHideElementSelectors } from "../../dist/core/hideElements.js";

test("normalizeHideElementSelectors splits comma-separated selectors and removes duplicates", () => {
  assert.deepEqual(
    normalizeHideElementSelectors([".cookie-banner, .chat-widget", ".cookie-banner", "  #ad  "]),
    [".cookie-banner", ".chat-widget", "#ad"]
  );
});

test("hidePageElements injects visibility-hidden CSS for selectors", async () => {
  const calls: Array<{ content: string }> = [];
  const page = {
    addStyleTag: async (payload: { content: string }) => {
      calls.push(payload);
    }
  };

  await hidePageElements(page as never, [".cookie-banner", ".chat-widget"]);

  assert.equal(calls.length, 1);
  assert.match(calls[0].content, /\.cookie-banner \{ visibility: hidden !important; \}/);
  assert.match(calls[0].content, /\.chat-widget \{ visibility: hidden !important; \}/);
});
