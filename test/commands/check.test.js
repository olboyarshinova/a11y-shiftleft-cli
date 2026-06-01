import test from "node:test";
import assert from "node:assert/strict";
import { parseFormats, shouldFail } from "../../src/commands/check.js";

const summary = {
  critical: 1,
  warning: 1,
  info: 1
};

test("shouldFail supports severity gates", () => {
  assert.equal(shouldFail(summary, "critical"), true);
  assert.equal(shouldFail({ critical: 0, warning: 1, info: 0 }, "critical"), false);
  assert.equal(shouldFail({ critical: 0, warning: 1, info: 0 }, "warning"), true);
  assert.equal(shouldFail({ critical: 0, warning: 0, info: 1 }, "info"), true);
});

test("shouldFail supports disabled failure gate", () => {
  assert.equal(shouldFail(summary, "none"), false);
});

test("parseFormats defaults to all report formats", () => {
  assert.deepEqual(parseFormats(), ["json", "csv", "markdown"]);
  assert.deepEqual(parseFormats(["all"]), ["json", "csv", "markdown"]);
});

test("parseFormats supports space and comma separated formats", () => {
  assert.deepEqual(parseFormats(["json", "csv"]), ["json", "csv"]);
  assert.deepEqual(parseFormats(["json,csv"]), ["json", "csv"]);
});

test("parseFormats rejects unsupported formats", () => {
  assert.throws(() => parseFormats(["xml"]), /Unsupported report format: xml/);
});
