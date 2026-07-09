import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  DEFAULT_AUTH_STATE_FILE,
  normalizeAuthUrl,
  parseAuthTimeoutMs,
  resolveAuthStatePath
} from "../../dist/core/authState.js";

test("resolveAuthStatePath normalizes shell-quoted relative paths", () => {
  const cwd = "/tmp/a11y-project";

  assert.equal(
    resolveAuthStatePath(`"${DEFAULT_AUTH_STATE_FILE}"`, cwd),
    path.join(cwd, ".a11y-auth/state.json")
  );
  assert.equal(resolveAuthStatePath(undefined, cwd), undefined);
});

test("normalizeAuthUrl accepts http URLs and rejects other protocols", () => {
  assert.equal(normalizeAuthUrl(" https://example.com/login "), "https://example.com/login");
  assert.throws(() => normalizeAuthUrl("file:///tmp/login.html"), /Invalid login URL/);
});

test("parseAuthTimeoutMs validates login wait bounds", () => {
  assert.equal(parseAuthTimeoutMs(undefined), 120_000);
  assert.equal(parseAuthTimeoutMs("5000"), 5_000);
  assert.throws(() => parseAuthTimeoutMs("100"), /Auth timeout/);
});
