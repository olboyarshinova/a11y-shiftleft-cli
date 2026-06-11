import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  renderExplorationHtml,
  writeExplorationHtml
} from "../../dist/reporters/writeExplorationHtml.js";

const graph = {
  generatedAt: "2026-06-09T00:00:00.000Z",
  startUrl: "http://localhost:3000",
  states: [
    {
      id: "state-1",
      url: "http://localhost:3000/",
      title: "Demo",
      depth: 0,
      fingerprint: "abc123",
      actionLabel: "Initial page",
      screenshot: "screenshots/state-1.png",
      issueCount: 1,
      actionCount: 2
    },
    {
      id: "state-2",
      url: "http://localhost:3000/",
      title: "Demo",
      depth: 1,
      fingerprint: "def456",
      actionLabel: "Click: Open menu",
      screenshot: "screenshots/state-2.png",
      issueCount: 0,
      actionCount: 0
    }
  ],
  edges: [
    {
      from: "state-1",
      to: "state-2",
      action: {
        id: "open-menu",
        type: "click",
        selector: "[aria-label=\"Open menu\"]",
        label: "Click: Open menu",
        text: "Open menu",
        role: "button"
      }
    }
  ],
  skippedActions: [
    {
      stateId: "state-1",
      type: "click",
      selector: "button[type=\"submit\"]",
      label: "Submit order",
      text: "Submit order",
      role: "button",
      reason: "Submit/reset controls are blocked by safe mode unless explicitly allowed."
    }
  ],
  summary: {
    statesVisited: 2,
    actionsTried: 1,
    skippedActions: 1,
    screenshots: 2,
    maxDepth: 2,
    maxStates: 20
  }
};

const issues = [
  {
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    wcag: ["4.1.2"],
    wcagCriteria: [{
      id: "4.1.2",
      title: "Name, Role, Value",
      level: "A",
      principle: "robust",
      introducedIn: "2.0",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    }],
    tags: [],
    severity: "critical",
    selector: ".icon-button",
    url: "http://localhost:3000/",
    stateId: "state-1",
    stateLabel: "Initial page",
    screenshot: "screenshots/state-1.png",
    elementBounds: {
      x: 10,
      y: 20,
      width: 30,
      height: 12,
      coordinateSpace: "viewport"
    },
    message: "Buttons must have discernible text",
    fingerprint: "button-name::state-1",
    duplicateCount: 0
  }
];

test("renderExplorationHtml renders state screenshots, issues, and edges", () => {
  const html = renderExplorationHtml(graph, issues);

  assert.match(html, /a11y-shiftleft exploration report/);
  assert.match(html, /States visited/);
  assert.match(html, /screenshots\/state-1\.png/);
  assert.match(html, /button-name/);
  assert.match(html, /Buttons must have discernible text/);
  assert.match(html, /Triage Overview/);
  assert.match(html, /Most Affected States/);
  assert.match(html, /Top Rules/);
  assert.match(html, /score 5/);
  assert.match(html, /WCAG 4\.1\.2 Name, Role, Value, Level A/);
  assert.match(html, /annotation annotation-critical/);
  assert.match(html, /left: 10%; top: 20%; width: 30%; height: 12%/);
  assert.match(html, /state-1.*->.*state-2/s);
  assert.match(html, /Skipped Actions/);
  assert.match(html, /Submit\/reset controls are blocked by safe mode/);
  assert.match(html, /Coverage Note/);
});

test("renderExplorationHtml escapes dynamic content", () => {
  const html = renderExplorationHtml({
    ...graph,
    startUrl: "http://localhost:3000/?q=<script>",
    states: [{
      ...graph.states[0],
      actionLabel: "Click: <script>alert(1)</script>",
      url: "http://localhost:3000/?q=<script>"
    }]
  }, issues);

  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("writeExplorationHtml writes exploration.html", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-exploration-html-"));

  await writeExplorationHtml(outputDir, graph, issues);

  const html = await fs.readFile(path.join(outputDir, "exploration.html"), "utf8");
  assert.match(html, /state-1/);
  assert.match(html, /button-name/);
});
