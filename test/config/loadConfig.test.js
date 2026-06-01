import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../../src/config/loadConfig.js";

test("loadConfig uses defaults when no config file exists", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-config-default-"));
  const config = await loadConfig({ cwd });

  assert.equal(config.cwd, cwd);
  assert.equal(config.failOn, "critical");
  assert.equal(config.dynamic.urls[0], "http://localhost:3000");
  assert.equal(config.outputDir, path.join(cwd, "reports"));
});

test("loadConfig deep merges file config and command overrides", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-config-merge-"));

  await fs.writeFile(
    path.join(cwd, ".a11y-shiftleft.json"),
    JSON.stringify({
      framework: "react",
      dynamic: {
        enabled: true,
        urls: ["http://127.0.0.1:3000"]
      }
    })
  );

  const config = await loadConfig({ cwd }, {
    outputDir: "custom-reports",
    dynamic: {
      urls: ["http://localhost:4173"]
    }
  });

  assert.equal(config.framework, "react");
  assert.equal(config.dynamic.enabled, true);
  assert.deepEqual(config.dynamic.urls, ["http://localhost:4173"]);
  assert.equal(config.outputDir, path.join(cwd, "custom-reports"));
});
