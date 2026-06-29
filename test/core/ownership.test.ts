import test from "node:test";
import assert from "node:assert/strict";
import { collectThirdPartyFrames, inferIssueOwnership } from "../../dist/core/ownership.js";

test("inferIssueOwnership labels known third-party iframe providers", () => {
  const ownership = inferIssueOwnership("iframe #movie_player", "https://example.com/talk", [
    { url: "https://example.com/talk" },
    { url: "https://www.youtube.com/embed/demo" }
  ]);

  assert.deepEqual(ownership, {
    kind: "third-party-embed",
    label: "Third-party embedded content",
    source: "youtube.com",
    url: "https://www.youtube.com",
    note: "Third-party embedded content. Manual verification recommended."
  });
});

test("inferIssueOwnership ignores first-party selectors and same-origin frames", () => {
  assert.equal(inferIssueOwnership("button", "https://example.com", [
    { url: "https://www.youtube.com/embed/demo" }
  ]), undefined);

  assert.deepEqual(collectThirdPartyFrames("https://example.com/page", [
    { url: "https://example.com/frame" },
    { url: "about:blank" },
    { url: "https://codepen.io/team/embed/demo" }
  ]), [{
    source: "codepen.io",
    url: "https://codepen.io"
  }]);
});

test("inferIssueOwnership keeps a conservative note for unknown iframe providers", () => {
  const ownership = inferIssueOwnership("iframe .player", "https://example.com", [
    { url: "https://widgets.example-cdn.test/embed" }
  ]);

  assert.equal(ownership?.source, "widgets.example-cdn.test");
  assert.match(ownership?.note || "", /may not be fixable by the website owner/);
});
