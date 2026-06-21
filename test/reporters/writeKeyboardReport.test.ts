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
  activationEnabled: true,
  maxActivations: 6,
  activationAttempts: [{
    selector: "#save",
    role: "button",
    key: "Enter",
    outcome: "changed",
    beforeStateId: "state-settings",
    afterStateId: "state-saved",
    focusAfter: "#save"
  }],
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
    obscured: false,
    pageState: {
      id: "state-settings",
      url: "http://localhost:3000/settings",
      title: "Account settings",
      heading: "Settings",
      scrollX: 0,
      scrollY: 240,
      viewportWidth: 1280,
      viewportHeight: 720,
      openDialogs: 0,
      expandedControls: 1
    }
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
    obscured: false,
    pageState: {
      id: "state-settings",
      url: "http://localhost:3000/settings",
      title: "Account settings",
      heading: "Settings",
      scrollX: 0,
      scrollY: 240,
      viewportWidth: 1280,
      viewportHeight: 720,
      openDialogs: 0,
      expandedControls: 1
    }
  }]
};

test("toKeyboardMarkdown renders a readable focus path", () => {
  const markdown = toKeyboardMarkdown(result);

  assert.match(markdown, /Keyboard Focus Path/);
  assert.match(markdown, /Save \\| continue/);
  assert.match(markdown, /Completed focus cycle \| yes/);
  assert.match(markdown, /Reverse order matches \| yes/);
  assert.match(markdown, /Reverse Focus Path/);
  assert.match(markdown, /Page States/);
  assert.match(markdown, /state-settings/);
  assert.match(markdown, /Account settings \/ Settings/);
  assert.match(markdown, /0, 240/);
  assert.match(markdown, /Activation Attempts/);
  assert.match(markdown, /Enter.*#save.*button.*changed/);
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

test("toKeyboardMarkdown includes deterministic fix recommendations", () => {
  const markdown = toKeyboardMarkdown({
    ...result,
    issues: [{
      source: "keyboard",
      framework: "react",
      ruleId: "focus-visible",
      wcag: ["2.4.7"],
      wcagCriteria: [],
      tags: [],
      severity: "warning",
      selector: "#save",
      message: "Focused control has no visible focus indicator.",
      remediation: {
        summary: "Add a visible focus indicator.",
        howToFix: ["Use :focus-visible with a high-contrast outline."],
        docs: ["https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html"],
        frameworkExamples: {
          react: ".button:focus-visible { outline: 2px solid currentColor; }"
        }
      }
    }]
  });

  assert.match(markdown, /Findings And Recommendations/);
  assert.match(markdown, /Suggested fix: Add a visible focus indicator/);
  assert.match(markdown, /Use :focus-visible with a high-contrast outline/);
  assert.match(markdown, /focus-visible\.html/);
  assert.match(markdown, /react example/);
});
