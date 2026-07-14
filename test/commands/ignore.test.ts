import test from "node:test";
import assert from "node:assert/strict";
import { createProgram } from "../../dist/cli.js";
import { formatIgnoreAudit } from "../../dist/commands/ignore.js";

test("ignore audit exposes stale exception review options", () => {
  const ignore = createProgram().commands.find((item) => item.name() === "ignore");
  const audit = ignore?.commands.find((item) => item.name() === "audit");

  assert.ok(audit);
  const flags = audit.options.map((option) => option.long);
  assert.equal(flags.includes("--file"), true);
  assert.equal(flags.includes("--format"), true);
  assert.equal(flags.includes("--expiry-reminder-days"), true);
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
