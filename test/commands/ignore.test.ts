import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import {
  createIgnoreCleanupPlan,
  formatIgnoreAudit,
  formatIgnoreCleanupPlan
} from "../../dist/commands/ignore.js";

test("ignore audit exposes stale exception review options", () => {
  const ignore = createProgram().commands.find((item) => item.name() === "ignore");
  const audit = ignore?.commands.find((item) => item.name() === "audit");

  assert.ok(audit);
  const flags = audit.options.map((option) => option.long);
  assert.equal(flags.includes("--file"), true);
  assert.equal(flags.includes("--format"), true);
  assert.equal(flags.includes("--expiry-reminder-days"), true);
});

test("ignore cleanup-plan exposes read-only cleanup options", () => {
  const ignore = createProgram().commands.find((item) => item.name() === "ignore");
  const cleanupPlan = ignore?.commands.find((item) => item.name() === "cleanup-plan");

  assert.ok(cleanupPlan);
  const flags = cleanupPlan.options.map((option) => option.long);
  assert.equal(flags.includes("--file"), true);
  assert.equal(flags.includes("--format"), true);
  assert.equal(flags.includes("--expiry-reminder-days"), true);
  assert.match(cleanupPlan.description(), /read-only cleanup plan/);
});

test("formatIgnoreAudit renders cleanup guidance", () => {
  const output = formatIgnoreAudit({
    file: "a11y-ignore.json",
    exists: true,
    entries: [
      {
        index: 1,
        status: "expired",
        owner: "@frontend",
        reason: "Legacy exception.",
        expires: "2026-01-01",
        matchFields: ["ruleId", "selector"],
        expiringSoon: false,
        cleanup: "Remove this entry if the issue is fixed, or renew it with a new reviewed expiry date."
      }
    ],
    summary: {
      enabled: true,
      file: "a11y-ignore.json",
      totalRules: 1,
      activeRules: 0,
      expiredRules: 1,
      invalidRules: 0,
      expiringSoonRules: 0,
      ignoredIssues: 0,
      ownerSummaries: [
        {
          owner: "@frontend",
          totalRules: 1,
          activeRules: 0,
          expiredRules: 1,
          invalidRules: 0,
          expiringSoonRules: 0,
          ignoredIssues: 0
        }
      ]
    }
  });

  assert.match(output, /a11y-shiftleft ignore audit/);
  assert.match(output, /Rules: total 1 \| active 0 \| expiring soon 0 \| expired 1 \| invalid 0/);
  assert.match(output, /Cleanup needed:/);
  assert.match(output, /\[1\] expired owner=@frontend expires=2026-01-01 match=ruleId, selector/);
  assert.match(output, /Owners to review:/);
});

test("formatIgnoreAudit handles missing ignore files", () => {
  const output = formatIgnoreAudit({
    file: "a11y-ignore.json",
    exists: false,
    entries: []
  });

  assert.match(output, /Status: no scoped ignore file found/);
  assert.match(output, /create a11y-ignore\.json only for reviewed temporary exceptions/);
});

test("createIgnoreCleanupPlan converts stale entries into proposed actions", () => {
  const plan = createIgnoreCleanupPlan({
    file: "a11y-ignore.json",
    exists: true,
    entries: [
      {
        index: 1,
        status: "active",
        owner: "@design",
        reason: "Temporary color exception.",
        expires: "2026-06-10",
        matchFields: ["ruleId"],
        expiringSoon: true,
        cleanup: "Review before expiry."
      },
      {
        index: 2,
        status: "expired",
        owner: "@frontend",
        reason: "Expired exception.",
        expires: "2026-01-01",
        matchFields: ["fingerprint"],
        expiringSoon: false,
        cleanup: "Remove this entry."
      },
      {
        index: 3,
        status: "invalid",
        owner: "unknown",
        reason: "missing",
        expires: "missing",
        matchFields: [],
        expiringSoon: false,
        cleanup: "Fix required."
      }
    ]
  });

  assert.deepEqual(plan.items.map((item) => item.action), [
    "review-before-expiry",
    "remove-or-renew",
    "fix-entry"
  ]);

  const output = formatIgnoreCleanupPlan(plan);
  assert.match(output, /a11y-shiftleft ignore cleanup-plan/);
  assert.match(output, /Items: 3/);
  assert.match(output, /\[1\] review-before-expiry/);
  assert.match(output, /\[2\] remove-or-renew/);
  assert.match(output, /\[3\] fix-entry/);
  assert.match(output, /This is a read-only plan/);
});

test("formatIgnoreCleanupPlan handles missing and clean files", () => {
  assert.match(formatIgnoreCleanupPlan({
    file: "a11y-ignore.json",
    exists: false,
    generatedAt: "2026-07-14T00:00:00.000Z",
    items: []
  }), /no scoped ignore file found/);

  assert.match(formatIgnoreCleanupPlan({
    file: "a11y-ignore.json",
    exists: true,
    generatedAt: "2026-07-14T00:00:00.000Z",
    items: []
  }), /no stale ignore cleanup is needed/);
});
