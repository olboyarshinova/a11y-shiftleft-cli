import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applyReportRetention } from "../../dist/core/reportRetention.js";

test("applyReportRetention is a no-op when disabled", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-retention-disabled-"));
  const current = path.join(root, "current");
  const oldRun = await createReportRun(root, "run-old", "2026-01-01T00:00:00.000Z");

  const summary = await applyReportRetention(current, {
    enabled: false,
    maxRuns: 1,
    maxAgeDays: 1
  }, {
    now: new Date("2026-06-11T00:00:00.000Z")
  });

  assert.equal(summary.enabled, false);
  assert.equal(await exists(oldRun), true);
});

test("applyReportRetention removes report directories older than maxAgeDays", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-retention-age-"));
  const current = await createReportRun(root, "current", "2026-06-11T00:00:00.000Z");
  const staleRun = await createReportRun(root, "run-stale", "2026-05-01T00:00:00.000Z");
  const freshRun = await createReportRun(root, "run-fresh", "2026-06-10T00:00:00.000Z");
  const unrelated = path.join(root, "unrelated");
  await fs.mkdir(unrelated);

  const summary = await applyReportRetention(current, {
    enabled: true,
    maxRuns: 10,
    maxAgeDays: 14
  }, {
    now: new Date("2026-06-11T00:00:00.000Z")
  });

  assert.equal(summary.deletedRuns, 1);
  assert.equal(await exists(staleRun), false);
  assert.equal(await exists(freshRun), true);
  assert.equal(await exists(unrelated), true);
  assert.equal(await exists(current), true);
});

test("applyReportRetention keeps maxRuns including the current output directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-retention-runs-"));
  const current = await createReportRun(root, "current", "2026-06-11T00:00:00.000Z");
  const newest = await createReportRun(root, "run-newest", "2026-06-10T00:00:00.000Z");
  const middle = await createReportRun(root, "run-middle", "2026-06-09T00:00:00.000Z");
  const oldest = await createReportRun(root, "run-oldest", "2026-06-08T00:00:00.000Z");

  const summary = await applyReportRetention(current, {
    enabled: true,
    maxRuns: 2,
    maxAgeDays: 365
  }, {
    now: new Date("2026-06-11T00:00:00.000Z")
  });

  assert.equal(summary.deletedRuns, 2);
  assert.equal(await exists(current), true);
  assert.equal(await exists(newest), true);
  assert.equal(await exists(middle), false);
  assert.equal(await exists(oldest), false);
});

async function createReportRun(root: string, name: string, isoDate: string): Promise<string> {
  const dir = path.join(root, name);
  const date = new Date(isoDate);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "a11y-report.json"), "{}");
  await fs.utimes(dir, date, date);

  return dir;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
