import test from "node:test";
import assert from "node:assert/strict";
import {
  type AxeProgressEvent,
  crawlSameOriginUrls,
  mergeEquivalentColorSchemeIssues,
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
    goto: async (url: string) => {
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

test("crawlSameOriginUrls reports discovery progress", async () => {
  const progress: AxeProgressEvent[] = [];
  const linksByUrl = new Map([
    ["http://localhost:3000/", [
      "http://localhost:3000/about"
    ]],
    ["http://localhost:3000/about", []]
  ]);
  let currentUrl = "";
  const page = {
    goto: async (url: string) => {
      currentUrl = url;
    },
    $$eval: async () => linksByUrl.get(currentUrl) || []
  };

  await crawlSameOriginUrls(page, ["http://localhost:3000/"], {
    maxDepth: 1,
    maxUrls: 5,
    onProgress: (event) => progress.push(event)
  });

  assert.deepEqual(progress.map((event) => event.type), ["crawl", "crawl"]);
  assert.deepEqual(progress.filter((event) => event.type === "crawl").map((event) => event.url), [
    "http://localhost:3000/",
    "http://localhost:3000/about"
  ]);
});

test("mergeEquivalentColorSchemeIssues avoids duplicating theme-independent findings", () => {
  const shared = {
    source: "axe",
    ruleId: "button-name",
    selector: "#menu",
    message: "Buttons must have discernible text",
    url: "http://localhost:3000/"
  };

  const merged = mergeEquivalentColorSchemeIssues(
    [{ ...shared, colorScheme: "light" }],
    [{ ...shared, colorScheme: "dark" }]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].colorScheme, undefined);
});

test("mergeEquivalentColorSchemeIssues preserves theme-specific evidence", () => {
  const shared = {
    source: "axe",
    ruleId: "color-contrast",
    selector: ".muted",
    message: "Elements must meet minimum color contrast ratio thresholds",
    url: "http://localhost:3000/"
  };

  const merged = mergeEquivalentColorSchemeIssues(
    [{
      ...shared,
      colorScheme: "light",
      contrast: { actualRatio: 4.6, requiredRatio: 7 }
    }],
    [{
      ...shared,
      colorScheme: "dark",
      contrast: { actualRatio: 2.1, requiredRatio: 4.5 }
    }]
  );

  assert.deepEqual(merged.map((issue) => issue.colorScheme), ["light", "dark"]);
});
