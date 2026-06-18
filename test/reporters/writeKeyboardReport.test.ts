import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { toKeyboardMarkdown, writeKeyboardReport } from "../../dist/reporters/writeKeyboardReport.js";
import type { KeyboardAuditResult } from "../../dist/types.js";

const result: KeyboardAuditResult = {
  url: "http://localhost:3000/settings",
  generatedAt: "2026-06-18T12:00:00.000Z",
  durationMs: 125,
  maxTabs: 40,
  focusableCount: 2,
  completedCycle: true,
  reverseOrderMatches: true,
  issues: [],
  steps: [{
    index: 1,
    direction: "forward",
    selector: "#save",
    tagName: "button",
    role: "button",
    accessibleName: "Save | continue",
    tabIndex: 0,
    visible: true,
    focusVisible: true,
    indicatorVisible: true,
    obscured: false
  }],
  backwardSteps: [{
    index: 1,
    direction: "backward",
    selector: "#save",
    tagName: "button",
    role: "button",
    accessibleName: "Save | continue",
    tabIndex: 0,
    visible: true,
    focusVisible: true,
    indicatorVisible: true,
    obscured: false
  }]
};

test("toKeyboardMarkdown renders a readable focus path", () => {
  const markdown = toKeyboardMarkdown(result);

  assert.match(markdown, /Keyboard Focus Path/);
  assert.match(markdown, /Save \\| continue/);
  assert.match(markdown, /Completed focus cycle \| yes/);
  assert.match(markdown, /Reverse order matches \| yes/);
  assert.match(markdown, /Reverse Focus Path/);
  assert.match(markdown, /bounded automated Tab and Shift\+Tab traversal/);
});

test("writeKeyboardReport writes JSON and Markdown artifacts", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-keyboard-"));
  await writeKeyboardReport(outputDir, result);

  const json = JSON.parse(await fs.readFile(path.join(outputDir, "keyboard-report.json"), "utf8"));
  const markdown = await fs.readFile(path.join(outputDir, "keyboard-path.md"), "utf8");

  assert.equal(json.steps[0].selector, "#save");
  assert.match(markdown, /http:\/\/localhost:3000\/settings/);
});
