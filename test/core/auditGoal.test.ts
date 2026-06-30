import test from "node:test";
import assert from "node:assert/strict";
import { formatAuditGoal, resolveAuditGoal } from "../../dist/core/auditGoal.js";

test("resolveAuditGoal maps supported audit goals", () => {
  const goal = resolveAuditGoal("level-of-effort");

  assert.equal(goal?.id, "level-of-effort");
  assert.match(goal?.label || "", /Level-of-effort/);
  assert.match(goal?.description || "", /remediation scope/);
  assert.equal(formatAuditGoal(goal), "Level-of-effort audit (level-of-effort)");
});

test("resolveAuditGoal rejects unsupported goals", () => {
  assert.throws(() => resolveAuditGoal("quick"), /Unsupported audit goal/);
  assert.equal(resolveAuditGoal(undefined), undefined);
  assert.equal(formatAuditGoal(undefined), "not specified");
});
