import test from "node:test";
import assert from "node:assert/strict";
import {
  crawlSameOriginUrls,
  normalizeSameOriginUrl
} from "../../dist/adapters/axePlaywrightAdapter.js";

test("normalizeSameOriginUrl keeps same-origin HTTP URLs and removes hash", () => {
  assert.equal(
    normalizeSameOriginUrl("/pricing#plans", "http://localhost:3000/"),
    "http://localhost:3000/pricing"
  );
  assert.equal(
    normalizeSameOriginUrl("https://example.com/docs", "http://localhost:3000/"),
    null
  );
  assert.equal(
    normalizeSameOriginUrl("mailto:team@example.com", "http://localhost:3000/"),
    null
  );
});

test("crawlSameOriginUrls discovers bounded same-origin links", async () => {
  const linksByUrl = new Map([
    ["http://localhost:3000/", [
      "http://localhost:3000/about",
      "http://localhost:3000/contact",
      "https://external.example/docs"
    ]],
    ["http://localhost:3000/about", [
      "http://localhost:3000/team",
      "http://localhost:3000/contact#form"
    ]],
    ["http://localhost:3000/contact", []]
  ]);
  let currentUrl = "";
  const page = {
    goto: async (url) => {
      currentUrl = url;
    },
    $$eval: async () => linksByUrl.get(currentUrl) || []
  };

  const urls = await crawlSameOriginUrls(page, ["http://localhost:3000/"], {
    maxDepth: 1,
    maxUrls: 3
  });

  assert.deepEqual(urls, [
    "http://localhost:3000/",
    "http://localhost:3000/about",
    "http://localhost:3000/contact"
  ]);
});
