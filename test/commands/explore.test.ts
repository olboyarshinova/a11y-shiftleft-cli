import test from "node:test";
import assert from "node:assert/strict";
import { formatVerboseExploreSummary } from "../../dist/commands/explore.js";

test("formatVerboseExploreSummary renders exploration context", () => {
  const output = formatVerboseExploreSummary({
    url: "http://localhost:3000",
    framework: "react",
    outputDir: "reports",
    maxDepth: 2,
    maxStates: 20,
    maxActionsPerState: 8,
    formats: ["json", "markdown"],
    html: true,
    screenshots: true,
    screenshotFormat: "jpeg",
    screenshotQuality: 70,
    screenshotFullPage: false,
    screenshotRedaction: true,
    safeModeEnabled: true,
    safeModeDismissDialogs: true,
    safeModeBlockedText: ["logout", "delete"],
    safeModeBlockedRoles: [],
    safeModeBlockedUrls: ["*/checkout*"],
    safeModeBlockedSelectors: ["[data-danger]"],
    retentionEnabled: true
  });

  assert.match(output, /a11y-shiftleft explore/);
  assert.match(output, /url: http:\/\/localhost:3000/);
  assert.match(output, /framework: react/);
  assert.match(output, /limits: depth=2, states=20, actionsPerState=8/);
  assert.match(output, /screenshots: jpeg quality=70/);
  assert.match(output, /screenshotRedaction: on/);
  assert.match(output, /safeMode: on/);
  assert.match(output, /safeModeBlockedText: logout, delete/);
  assert.match(output, /safeModeBlockedRoles: none/);
  assert.match(output, /safeModeBlockedUrls: \*\/checkout\*/);
  assert.match(output, /safeModeBlockedSelectors: \[data-danger\]/);
  assert.match(output, /retention: on/);
});
