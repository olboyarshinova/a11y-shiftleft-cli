import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectAdoptionMetrics,
  parseArgs,
  writeAdoptionMetrics
} from "../../dist/scripts/collect-adoption-metrics.js";

test("parseArgs supports package, repo, period, and output options", () => {
  const options = parseArgs([
    "--package",
    "demo-package",
    "--repo",
    "owner/repo",
    "--period",
    "last-week",
    "--out",
    "analysis/adoption.json"
  ]);

  assert.deepEqual(options, {
    packageName: "demo-package",
    repo: "owner/repo",
    period: "last-week",
    out: "analysis/adoption.json"
  });
});

test("collectAdoptionMetrics collects npm downloads and registry metadata", async () => {
  const metrics = await collectAdoptionMetrics({
    packageName: "demo-package",
    repo: "owner/repo",
    period: "last-week",
    githubToken: ""
  }, {
    now: () => new Date("2026-06-03T00:00:00.000Z"),
    fetchImpl: async (url) => fakeResponse(route(url))
  });

  assert.equal(metrics.generatedAt, "2026-06-03T00:00:00.000Z");
  assert.equal(metrics.npm.downloads.total, 30);
  assert.equal(metrics.registry.latestVersion, "1.2.3");
  assert.equal(metrics.github.available, false);
  assert.match(metrics.interpretation.geography, /does not expose country-level/);
});

test("collectAdoptionMetrics includes GitHub traffic when a token is provided", async () => {
  const metrics = await collectAdoptionMetrics({
    packageName: "demo-package",
    repo: "owner/repo",
    period: "last-week",
    githubToken: "token"
  }, {
    now: () => new Date("2026-06-03T00:00:00.000Z"),
    fetchImpl: async (url) => fakeResponse(route(url))
  });

  assert.equal(metrics.github.available, true);
  assert.equal(metrics.github.views.uniques, 4);
  assert.equal(metrics.github.clones.uniques, 2);
  assert.equal(metrics.github.referrers[0].referrer, "github.com");
});

test("writeAdoptionMetrics writes JSON output", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-adoption-"));
  const outputPath = path.join(outputDir, "adoption.json");

  await writeAdoptionMetrics(outputPath, {
    generatedAt: "2026-06-03T00:00:00.000Z",
    package: "demo-package"
  });

  const content = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.equal(content.package, "demo-package");
});

function route(url) {
  if (url.includes("api.npmjs.org/downloads/range")) {
    return {
      downloads: [
        { day: "2026-06-01", downloads: 10 },
        { day: "2026-06-02", downloads: 20 }
      ]
    };
  }

  if (url.includes("registry.npmjs.org")) {
    return {
      "dist-tags": {
        latest: "1.2.3"
      },
      time: {
        created: "2026-06-01T00:00:00.000Z",
        modified: "2026-06-02T00:00:00.000Z"
      },
      versions: {
        "1.0.0": { license: "MIT" },
        "1.2.3": { license: "MIT" }
      }
    };
  }

  if (url.endsWith("/traffic/views")) {
    return {
      count: 8,
      uniques: 4,
      views: []
    };
  }

  if (url.endsWith("/traffic/clones")) {
    return {
      count: 3,
      uniques: 2,
      clones: []
    };
  }

  if (url.endsWith("/traffic/popular/referrers")) {
    return [
      {
        referrer: "github.com",
        count: 5,
        uniques: 3
      }
    ];
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
