import test from "node:test";
import assert from "node:assert/strict";
import {
  createHumanVerificationIssue,
  detectHumanVerificationText,
  waitForHumanVerificationToClear
} from "../../dist/core/humanVerification.js";

test("detectHumanVerificationText detects common challenge pages", () => {
  assert.deepEqual(detectHumanVerificationText("Verify you are human before continuing"), {
    provider: "cloudflare",
    matched: "Verify you are human",
    message: "Cloudflare human verification"
  });

  assert.equal(detectHumanVerificationText("Welcome to the product page"), undefined);
});

test("createHumanVerificationIssue returns a clear adapter finding", () => {
  const signal = detectHumanVerificationText("<div class=\"g-recaptcha\">I'm not a robot</div>");
  assert.ok(signal);

  const issue = createHumanVerificationIssue({
    source: "axe",
    framework: "unknown",
    url: "https://example.com",
    signal,
    stateId: "state-1",
    stateLabel: "Initial page"
  });

  assert.equal(issue.ruleId, "adapter/human-verification");
  assert.equal(issue.severity, "warning");
  assert.equal(issue.category, "adapter");
  assert.equal(issue.confidence, "high");
  assert.match(issue.message || "", /blocked automated scanning/);
  assert.match(issue.message || "", /manual accessibility review/);
});

test("waitForHumanVerificationToClear waits until the challenge disappears", async () => {
  let calls = 0;
  const page = {
    async evaluate() {
      calls += 1;
      return calls < 3 ? "Verify you are human" : "Welcome";
    }
  };

  const remaining = await waitForHumanVerificationToClear(page, {
    timeoutMs: 700,
    pollMs: 250
  });

  assert.equal(remaining, undefined);
  assert.equal(calls >= 3, true);
});
