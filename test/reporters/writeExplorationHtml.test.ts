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
      screenshotFullPage: true,
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
    },
    {
      id: "state-3",
      url: "http://localhost:3000/",
      title: "Demo",
      depth: 1,
      fingerprint: "ghi789",
      actionLabel: "Click: Close menu",
      screenshot: "screenshots/state-1.png",
      screenshotFullPage: true,
      visualDuplicateOf: "state-1",
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
    statesVisited: 3,
    actionsTried: 1,
    skippedActions: 1,
    screenshots: 2,
    duplicateScreenshots: 1,
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
  assert.match(html, /Generated: <time datetime="2026-06-09T00:00:00.000Z">9 June 2026, 00:00 UTC<\/time>/);
  assert.doesNotMatch(html, />Generated 2026-06-09T/);
  assert.match(html, /States visited/);
  assert.match(html, /screenshots\/state-1\.png/);
  assert.match(html, /Unique screenshots/);
  assert.match(html, /Duplicate screenshots skipped/);
  assert.match(html, /Duplicate visual not stored again/);
  assert.match(html, /visual reused from state-1/);
  assert.match(html, /Open this state's annotated evidence/);
  assert.match(html, /button-name/);
  assert.match(html, /Buttons must have discernible text/);
  assert.match(html, /Triage Overview/);
  assert.match(html, /Most Affected States/);
  assert.match(html, /Top Rules/);
  assert.match(html, /score 5/);
  assert.match(html, /WCAG 4\.1\.2 Name, Role, Value, Level A/);
  assert.match(html, /annotation annotation-critical/);
  assert.match(html, /class="annotation-layer" aria-hidden="true"/);
  assert.match(html, /\.annotation-layer/);
  assert.match(html, /screenshot-frame screenshot-frame-full/);
  assert.match(html, /Open full-page evidence/);
  assert.match(html, /full-page evidence/);
  assert.match(html, /class="state state-critical" id="state-1"/);
  assert.match(html, /class="state state-ok" id="state-2"/);
  assert.match(html, /\.state-critical/);
  assert.match(html, /background: rgb\(180 35 24 \/ 10%\)/);
  assert.match(html, /--warning-marker: #f97316/);
  assert.match(html, /border-color: var\(--warning-marker\)/);
  assert.doesNotMatch(html, /9999px rgb\(30 36 48 \/ 4%\)/);
  assert.match(html, /Open annotated screenshot/);
  assert.match(html, /id="screenshot-state-1"/);
  assert.match(html, /Annotated screenshot for state-1/);
  assert.match(html, /left: 10%; top: 20%; width: 30%; height: 12%/);
  assert.match(html, /Exploration Details/);
  assert.match(html, /Start with Triage Overview and Checked States/);
  assert.match(html, /State transitions: 1/);
  assert.match(html, /state-1.*->.*state-2/s);
  assert.match(html, /Skipped actions: 1/);
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

test("renderExplorationHtml renders color contrast evidence and suggestions", () => {
  const html = renderExplorationHtml(graph, [{
    ...issues[0],
    ruleId: "color-contrast",
    contrast: {
      actualRatio: 2.32,
      requiredRatio: 4.5,
      foreground: "#aaaaaa",
      background: "#ffffff",
      fontSize: "12.0pt (16px)",
      fontWeight: "normal",
      suggestions: [
        { target: "foreground", purpose: "minimum", color: "#767676", contrastRatio: 4.54 },
        { target: "foreground", purpose: "recommended", color: "#6F6F6F", contrastRatio: 5.02 },
        { target: "foreground", purpose: "enhanced", color: "#595959", contrastRatio: 7 }
      ]
    }
  }]);

  assert.match(html, /Contrast 2\.32:1/);
  assert.match(html, /required 4\.5:1/);
  assert.match(html, /Text <code>#aaaaaa<\/code>/);
  assert.match(html, /Background <code>#ffffff<\/code>/);
  assert.match(html, /Keep background #ffffff and change the text color/);
  assert.match(html, /Minimum change: <code>#767676<\/code> → 4\.54:1/);
  assert.match(html, /Recommended: <code>#6F6F6F<\/code> → 5\.02:1/);
  assert.match(html, /Enhanced contrast: <code>#595959<\/code> → 7:1/);
  assert.match(html, /background-color: #767676/);
});

test("writeExplorationHtml writes exploration.html", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-exploration-html-"));

  await writeExplorationHtml(outputDir, graph, issues);

  const html = await fs.readFile(path.join(outputDir, "exploration.html"), "utf8");
  assert.match(html, /state-1/);
  assert.match(html, /button-name/);
});
