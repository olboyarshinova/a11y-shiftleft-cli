import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCliValue, normalizeHttpUrlInput } from "../../dist/core/urlInput.js";

test("normalizeCliValue trims whitespace and common smart quotes", () => {
  assert.equal(normalizeCliValue(" “https://example.com/” "), "https://example.com/");
  assert.equal(normalizeCliValue("«http://localhost:5173»"), "http://localhost:5173");
  assert.equal(normalizeCliValue("'https://example.com/dashboard'"), "https://example.com/dashboard");
});

test("normalizeHttpUrlInput validates and canonicalizes HTTP URLs", () => {
  assert.equal(normalizeHttpUrlInput(" https://example.com "), "https://example.com/");
  assert.equal(normalizeHttpUrlInput("“http://localhost:5173/app”"), "http://localhost:5173/app");
  assert.throws(
    () => normalizeHttpUrlInput("file:///tmp/report.html"),
    /Use http:\/\/ or https:\/\//
  );
  assert.throws(
    () => normalizeHttpUrlInput("localhost:5173"),
    /Invalid --url protocol/
  );
});
