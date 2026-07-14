import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_IGNORE_FILE,
  applyIgnores,
  auditIgnoreFile,
  createMatcher,
  issueTarget,
  validateIgnoreEntry
} from "../../dist/core/ignore.js";
import type { DedupedIssue } from "../../dist/types.js";

test("applyIgnores filters active scoped ignore entries", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-ignore-"));
  await fs.writeFile(path.join(cwd, DEFAULT_IGNORE_FILE), JSON.stringify({
    version: 1,
    ignores: [
      {
        ruleId: "color-contrast",
        selector: ".muted",
        reason: "Legacy theme will be replaced in the next design pass.",
        owner: "@frontend",
        expires: "2026-12-31"
      }
    ]
  }));

  const result = await applyIgnores([
    issue({
      fingerprint: "color-contrast::selector=.muted::critical",
      ruleId: "color-contrast",
      selector: ".muted",
      severity: "critical"
    }),
    issue({
      fingerprint: "button-name::selector=button::warning",
      ruleId: "button-name",
      selector: "button",
      severity: "warning"
    })
  ], {
    cwd,
    now: new Date("2026-06-01T00:00:00.000Z")
  });

  assert.deepEqual(result.issues.map((item) => item.ruleId), ["button-name"]);
  assert.equal(result.summary?.ignoredIssues, 1);
  assert.equal(result.summary?.activeRules, 1);
  assert.equal(result.summary?.expiringSoonRules, 0);
  assert.equal(result.summary?.file, DEFAULT_IGNORE_FILE);
  assert.deepEqual(result.summary?.ownerSummaries, [
    {
      owner: "@frontend",
      totalRules: 1,
      activeRules: 1,
      expiredRules: 0,
      invalidRules: 0,
      expiringSoonRules: 0,
      ignoredIssues: 1
    }
  ]);
});

test("applyIgnores keeps expired and invalid entries visible", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-ignore-expired-"));
  await fs.writeFile(path.join(cwd, DEFAULT_IGNORE_FILE), JSON.stringify({
    version: 1,
    ignores: [
      {
        ruleId: "color-contrast",
        reason: "Expired debt item.",
        owner: "@frontend",
        expires: "2026-01-01"
      },
      {
        ruleId: "button-name",
        reason: "Missing owner and expiry."
      }
    ]
  }));

  const result = await applyIgnores([
    issue({
      fingerprint: "color-contrast::selector=.muted::critical",
      ruleId: "color-contrast",
      selector: ".muted",
      severity: "critical"
    })
  ], {
    cwd,
    now: new Date("2026-06-01T00:00:00.000Z")
  });

  assert.equal(result.issues.length, 1);
  assert.equal(result.summary?.ignoredIssues, 0);
  assert.equal(result.summary?.expiredRules, 1);
  assert.equal(result.summary?.invalidRules, 1);
  assert.equal(result.summary?.ownerSummaries.find((owner) => owner.owner === "@frontend")?.expiredRules, 1);
  assert.equal(result.summary?.ownerSummaries.find((owner) => owner.owner === "unknown")?.invalidRules, 1);
});

test("applyIgnores reports rules that expire soon", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-ignore-expiring-"));
  await fs.writeFile(path.join(cwd, DEFAULT_IGNORE_FILE), JSON.stringify({
    version: 1,
    ignores: [
      {
        ruleId: "color-contrast",
        selector: ".muted",
        reason: "Temporary brand exception under review.",
        owner: "@design-system",
        expires: "2026-06-10"
      }
    ]
  }));

  const result = await applyIgnores([
    issue({
      ruleId: "color-contrast",
      selector: ".muted",
      severity: "warning"
    })
  ], {
    cwd,
    now: new Date("2026-06-01T00:00:00.000Z")
  });

  assert.equal(result.summary?.expiringSoonRules, 1);
  assert.equal(result.summary?.ownerSummaries[0]?.owner, "@design-system");
  assert.equal(result.summary?.ownerSummaries[0]?.expiringSoonRules, 1);

  const shorterReminder = await applyIgnores([], {
    cwd,
    now: new Date("2026-06-01T00:00:00.000Z"),
    expiryReminderDays: 5
  });

  assert.equal(shorterReminder.summary?.expiringSoonRules, 0);
});

test("auditIgnoreFile reports stale cleanup metadata without filtering issues", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-ignore-audit-"));
  await fs.writeFile(path.join(cwd, DEFAULT_IGNORE_FILE), JSON.stringify({
    version: 1,
    ignores: [
      {
        ruleId: "color-contrast",
        selector: ".muted",
        reason: "Temporary brand exception under review.",
        owner: "@design-system",
        expires: "2026-06-10"
      },
      {
        ruleId: "button-name",
        reason: "Expired exception.",
        owner: "@frontend",
        expires: "2026-01-01"
      },
      {
        ruleId: "image-alt",
        reason: "Missing owner and expiry."
      }
    ]
  }));

  const result = await auditIgnoreFile({
    cwd,
    now: new Date("2026-06-01T00:00:00.000Z")
  });

  assert.equal(result.exists, true);
  assert.equal(result.summary?.totalRules, 3);
  assert.equal(result.summary?.activeRules, 1);
  assert.equal(result.summary?.expiringSoonRules, 1);
  assert.equal(result.summary?.expiredRules, 1);
  assert.equal(result.summary?.invalidRules, 1);
  assert.deepEqual(result.entries.map((entry) => entry.status), ["active", "expired", "invalid"]);
  assert.equal(result.entries[0]?.expiringSoon, true);
  assert.match(result.entries[0]?.cleanup || "", /Review before expiry/);
  assert.match(result.entries[1]?.cleanup || "", /Remove this entry/);
  assert.match(result.entries[2]?.cleanup || "", /Fix required/);
});

test("auditIgnoreFile reports a missing ignore file", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-ignore-audit-missing-"));
  const result = await auditIgnoreFile({ cwd });

  assert.equal(result.exists, false);
  assert.equal(result.summary, undefined);
  assert.deepEqual(result.entries, []);
  assert.equal(result.file, DEFAULT_IGNORE_FILE);
});

test("applyIgnores is a no-op when the ignore file is missing or disabled", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-ignore-missing-"));
  const issues = [issue({ ruleId: "image-alt", selector: "img" })];

  assert.equal((await applyIgnores(issues, { cwd })).summary, undefined);
  assert.deepEqual((await applyIgnores(issues, { cwd })).issues, issues);
  assert.deepEqual((await applyIgnores(issues, { cwd, enabled: false })).issues, issues);
});

test("createMatcher supports target wildcards and WCAG criteria", () => {
  const targetIssue = issue({
    ruleId: "label",
    selector: "#email",
    file: "src/Form.tsx",
    line: 12,
    wcag: ["1.3.1"]
  });

  assert.equal(issueTarget(targetIssue), "selector=#email|file=src/Form.tsx|line=12");
  assert.equal(createMatcher({
    target: "*src/Form.tsx*",
    reason: "Covered by design-system migration.",
    owner: "@forms",
    expires: "2026-12-31"
  })(targetIssue), true);
  assert.equal(createMatcher({
    wcag: "1.3.1",
    reason: "Covered by design-system migration.",
    owner: "@forms",
    expires: "2026-12-31"
  })(targetIssue), true);
});

test("validateIgnoreEntry requires ownership, expiry, reason, and a match field", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  assert.equal(validateIgnoreEntry({
    ruleId: "image-alt",
    reason: "Temporary fixture.",
    owner: "@docs",
    expires: "2026-12-31"
  }, now), "active");
  assert.equal(validateIgnoreEntry({
    ruleId: "image-alt",
    reason: "Temporary fixture.",
    owner: "@docs",
    expires: "2026-01-01"
  }, now), "expired");
  assert.equal(validateIgnoreEntry({
    reason: "No match field.",
    owner: "@docs",
    expires: "2026-12-31"
  }, now), "invalid");
});

function issue(overrides: Partial<DedupedIssue> = {}): DedupedIssue {
  return {
    source: "axe",
    framework: "react",
    ruleId: "color-contrast",
    wcag: [],
    wcagCriteria: [],
    tags: [],
    severity: "warning",
    confidence: "high",
    confidenceScore: 95,
    confidenceReason: "Detected by axe.",
    category: "contrast",
    message: "Accessibility issue",
    fingerprint: "color-contrast::selector=.target::warning",
    duplicateCount: 1,
    ...overrides
  };
}
