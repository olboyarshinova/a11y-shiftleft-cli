import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyRemediationTracking,
  createRemediationTrackingFile,
  DEFAULT_REMEDIATION_FILE,
  isValidTrackingEntry,
  updateRemediationStatus
} from "../../dist/core/remediationTracking.js";

test("applyRemediationTracking annotates findings without filtering them", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-remediation-"));
  await fs.writeFile(path.join(cwd, DEFAULT_REMEDIATION_FILE), JSON.stringify({
    version: 1,
    items: [
      {
        fingerprint: "known-warning",
        status: "in-progress",
        owner: "@frontend",
        reason: "Fix is in the current sprint.",
        updatedAt: "2026-06-20",
        reviewBy: "2026-07-01"
      },
      {
        fingerprint: "stale-fixed",
        status: "fixed",
        owner: "@frontend",
        reason: "Removed from the current UI.",
        updatedAt: "2026-06-19"
      },
      {
        fingerprint: "invalid-entry",
        status: "accepted-temporarily",
        owner: "",
        reason: "",
        updatedAt: "not-a-date"
      }
    ]
  }));

  const result = await applyRemediationTracking([
    issue("known-warning"),
    issue("untracked-warning")
  ], { cwd });

  assert.equal(result.issues.length, 2);
  assert.equal(result.issues[0].remediationTracking?.status, "in-progress");
  assert.equal(result.issues[1].remediationTracking, undefined);
  assert.equal(result.summary?.matchedIssues, 1);
  assert.equal(result.summary?.staleEntries, 1);
  assert.equal(result.summary?.invalidEntries, 1);
  assert.deepEqual(result.summary?.byStatus, { "in-progress": 1 });
});

test("accepted temporary findings require ownership, reason, and review date", () => {
  assert.equal(isValidTrackingEntry({
    fingerprint: "known",
    status: "accepted-temporarily",
    owner: "@frontend",
    reason: "Waiting for the design-system release.",
    updatedAt: "2026-06-20",
    reviewBy: "2026-07-20"
  }), true);

  assert.equal(isValidTrackingEntry({
    fingerprint: "known",
    status: "accepted-temporarily",
    owner: "@frontend",
    reason: "",
    updatedAt: "2026-06-20"
  }), false);
});

test("createRemediationTrackingFile creates sorted unique open items", () => {
  const file = createRemediationTrackingFile({
    issues: [issue("z-warning"), issue("a-warning"), issue("z-warning")]
  }, new Date("2026-06-20T12:00:00.000Z"));

  assert.deepEqual(file.items.map((item) => item.fingerprint), ["a-warning", "z-warning"]);
  assert.equal(file.items[0].status, "open");
  assert.equal(file.items[0].updatedAt, "2026-06-20");
});

test("updateRemediationStatus validates temporary acceptance metadata", () => {
  const file = createRemediationTrackingFile({ issues: [issue("known-warning")] });
  const updated = updateRemediationStatus(file, {
    fingerprint: "known-warning",
    status: "accepted-temporarily",
    owner: "@frontend",
    reason: "Waiting for the shared component release.",
    reviewBy: "2026-07-20"
  }, new Date("2026-06-20T12:00:00.000Z"));

  assert.equal(updated.items[0].status, "accepted-temporarily");
  assert.equal(updated.items[0].owner, "@frontend");
  assert.equal(updated.items[0].updatedAt, "2026-06-20");
  assert.throws(() => updateRemediationStatus(file, {
    fingerprint: "known-warning",
    status: "accepted-temporarily"
  }), /required owner, reason, and review date/);
  assert.throws(() => updateRemediationStatus(file, {
    fingerprint: "missing",
    status: "open"
  }), /fingerprint not found/);
});

function issue(fingerprint: string) {
  return {
    source: "axe",
    framework: "react",
    ruleId: "button-name",
    message: "Button must have an accessible name",
    wcag: ["4.1.2"],
    wcagCriteria: [],
    tags: [],
    severity: "warning",
    fingerprint,
    duplicateCount: 0
  } as never;
}
