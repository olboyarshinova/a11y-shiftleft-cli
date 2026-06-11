import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverConfig, loadConfig } from "../../dist/config/loadConfig.js";

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
        urls: ["http://localhost:3000"]
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

test("loadConfig discovers .a11yrc.json when the default config is missing", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-config-rc-"));

  await fs.writeFile(
    path.join(cwd, ".a11yrc.json"),
    JSON.stringify({
      framework: "vue",
      outputDir: "a11y-output"
    })
  );

  const config = await loadConfig({ cwd });

  assert.equal(config.framework, "vue");
  assert.equal(config.configPath, path.join(cwd, ".a11yrc.json"));
  assert.equal(config.outputDir, path.join(cwd, "a11y-output"));
});

test("loadConfig discovers package.json#a11y after JSON config files", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-config-package-"));

  await fs.writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({
      name: "target-app",
      a11y: {
        framework: "angular",
        dynamic: {
          urls: ["http://localhost:4200"]
        }
      }
    })
  );

  const config = await loadConfig({ cwd });

  assert.equal(config.framework, "angular");
  assert.equal(config.configPath, path.join(cwd, "package.json"));
  assert.deepEqual(config.dynamic.urls, ["http://localhost:4200"]);
});

test("discoverConfig prefers .a11y-shiftleft.json over other config locations", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-config-priority-"));

  await fs.writeFile(path.join(cwd, ".a11y-shiftleft.json"), JSON.stringify({ framework: "react" }));
  await fs.writeFile(path.join(cwd, ".a11yrc.json"), JSON.stringify({ framework: "vue" }));
  await fs.writeFile(path.join(cwd, "package.json"), JSON.stringify({
    a11y: {
      framework: "angular"
    }
  }));

  const discovered = await discoverConfig(cwd);

  assert.equal(discovered.source, ".a11y-shiftleft.json");
  assert.equal(discovered.config.framework, "react");
});
