import test from "node:test";
import assert from "node:assert/strict";
import { applyUserImpact, countUserImpact, inferUserImpact } from "../../dist/core/userImpact.js";
import type { DedupedIssue } from "../../dist/types.js";

function issue(overrides: Partial<DedupedIssue>): DedupedIssue {
  return {
    source: "axe",
    framework: "unknown",
    ruleId: "color-contrast",
    message: "Elements must meet minimum color contrast ratio thresholds",
    wcag: [],
    wcagCriteria: [],
    tags: [],
    severity: "warning",
    confidence: "high",
    confidenceScore: 95,
    confidenceReason: "Detected by rendered DOM evidence.",
    findingType: "wcag",
    category: "contrast",
    fingerprint: "color-contrast::body",
    duplicateCount: 0,
    ...overrides
  };
}

test("inferUserImpact separates practical user impact from technical severity", () => {
  assert.deepEqual(inferUserImpact(issue({ ruleId: "button-name", severity: "critical", category: "aria" })), {
    level: "blocker",
    affectedUsers: ["Screen reader users", "Voice-control users"],
    reason: "Controls without accessible names may be impossible to identify or activate by assistive technology."
  });

  assert.deepEqual(inferUserImpact(issue({ ruleId: "color-contrast", severity: "warning", category: "contrast" })), {
    level: "significant",
    affectedUsers: ["Low-vision users", "Users in bright environments"],
    reason: "Low contrast can make text or controls hard to perceive."
  });

  assert.equal(inferUserImpact(issue({
    ruleId: "page-has-heading-one",
    severity: "info",
    category: "headings",
    findingType: "best-practice"
  })).level, "minor");
});

test("applyUserImpact preserves explicit user-impact evidence and counts levels", () => {
  const issues = applyUserImpact([
    issue({ ruleId: "button-name", severity: "critical", category: "aria" }),
    issue({
      ruleId: "custom-reviewed-finding",
      category: "other",
      userImpact: {
        level: "workaround",
        affectedUsers: ["Keyboard users"],
        reason: "Reviewed by the project team."
      }
    })
  ]);

  assert.equal(issues[0].userImpact?.level, "blocker");
  assert.equal(issues[1].userImpact?.reason, "Reviewed by the project team.");
  assert.deepEqual(countUserImpact(issues), {
    blocker: 1,
    workaround: 1
  });
});
