import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeAdoptionMetrics } from "../../dist/scripts/collect-adoption-metrics.js";
import {
  collectAdoptionSnapshot,
  parseSnapshotArgs
} from "../../dist/scripts/collect-adoption-snapshot.js";

test("parseSnapshotArgs supports packages, repo, period, and output", () => {
  const options = parseSnapshotArgs([
    "--package",
    "a11y-shiftleft-cli,@a11y-shiftleft/react",
    "--package",
    "@a11y-shiftleft/vue",
    "--repo",
    "owner/repo",
    "--period",
    "last-week",
    "--out",
    "analysis/adoption-snapshot.json"
  ]);

  assert.deepEqual(options, {
    packages: [
      "a11y-shiftleft-cli",
      "@a11y-shiftleft/react",
      "@a11y-shiftleft/vue"
    ],
    repo: "owner/repo",
    period: "last-week",
    out: "analysis/adoption-snapshot.json"
  });
});

test("collectAdoptionSnapshot collects all package metrics and totals downloads", async () => {
  const snapshot = await collectAdoptionSnapshot({
    packages: ["pkg-a", "pkg-b"],
    repo: "owner/repo",
    period: "last-week",
    githubToken: ""
  }, {
    now: () => new Date("2026-06-09T00:00:00.000Z"),
    fetchImpl: async (url) => fakeResponse(route(url))
  });

  assert.equal(snapshot.generatedAt, "2026-06-09T00:00:00.000Z");
  assert.equal(snapshot.summary.packageCount, 2);
  assert.equal(snapshot.summary.npmApiDownloadsTotal, 45);
  assert.deepEqual(Object.keys(snapshot.summary.byPackage), ["pkg-a", "pkg-b"]);
  assert.equal(snapshot.summary.byPackage["pkg-a"].latestVersion, "1.0.0");
  assert.match(snapshot.interpretation.evidenceUse, /periodic adoption telemetry/);
});

test("collectAdoptionSnapshot can be written with the shared adoption writer", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-adoption-snapshot-"));
  const outputPath = path.join(outputDir, "snapshot.json");
  const snapshot = await collectAdoptionSnapshot({
    packages: ["pkg-a"],
    repo: "owner/repo",
    period: "last-week",
    githubToken: ""
  }, {
    now: () => new Date("2026-06-09T00:00:00.000Z"),
    fetchImpl: async (url) => fakeResponse(route(url))
  });

  await writeAdoptionMetrics(outputPath, snapshot);

  const content = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.equal(content.summary.packageCount, 1);
});

function route(url) {
  if (url.includes("api.npmjs.org/downloads/range")) {
    const downloads = url.includes("pkg-a") ? 20 : 25;
    return {
      downloads: [
        { day: "2026-06-08", downloads }
      ]
    };
  }

  if (url.includes("registry.npmjs.org")) {
    return {
      "dist-tags": {
        latest: "1.0.0"
      },
      time: {
        created: "2026-06-01T00:00:00.000Z",
        modified: "2026-06-02T00:00:00.000Z"
      },
      versions: {
        "1.0.0": { license: "MIT" }
      }
    };
  }

  throw new Error(`Unexpected URL: ${url}`);
}

function fakeResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body
  };
}
