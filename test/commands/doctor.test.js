import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { adapterPackagesForFramework, checkFrameworkAdapterPackages, formatDoctorChecks, runDoctorChecks, summarizeDoctorChecks } from "../../dist/commands/doctor.js";

test("runDoctorChecks reports local setup and reachable target URL", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-doctor-"));
  await fs.writeFile(path.join(cwd, ".a11y-shiftleft.json"), "{}");

  const checks = await runDoctorChecks({
    cwd,
    url: "http://localhost:3000"
  }, {
    nodeVersion: "22.0.0",
    env: { CI: "true" },
    checkChromium: async () => ({
      name: "Chromium",
      status: "pass",
      message: "Mock browser installed."
    }),
    fetch: async () => new Response("", { status: 200 })
  });

  assert.equal(checks.find((check) => check.name === "Node.js")?.status, "pass");
  assert.equal(checks.find((check) => check.name === "Config file")?.status, "pass");
  assert.equal(checks.find((check) => check.name === "Target URL")?.status, "pass");
});

test("adapterPackagesForFramework returns framework-specific packages", () => {
  assert.deepEqual(adapterPackagesForFramework("react"), ["eslint-plugin-jsx-a11y"]);
  assert.deepEqual(adapterPackagesForFramework("vue"), ["eslint-plugin-vue"]);
  assert.deepEqual(adapterPackagesForFramework("angular"), [
    "@angular-eslint/eslint-plugin-template",
    "@angular-eslint/template-parser"
  ]);
  assert.deepEqual(adapterPackagesForFramework("auto"), []);
});

test("checkFrameworkAdapterPackages warns when framework is auto", () => {
  const checks = checkFrameworkAdapterPackages(process.cwd(), "auto");

  assert.equal(checks.length, 1);
  assert.equal(checks[0].status, "warn");
  assert.match(checks[0].message, /Framework is auto\/unknown/);
});

test("runDoctorChecks warns when config and URL are missing", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-doctor-"));

  const checks = await runDoctorChecks({
    cwd
  }, {
    nodeVersion: "18.20.0",
    env: {},
    checkChromium: async () => ({
      name: "Chromium",
      status: "pass",
      message: "Mock browser installed."
    }),
    fetch: async () => new Response("", { status: 200 })
  });

  assert.equal(checks.find((check) => check.name === "Config file")?.status, "warn");
  assert.equal(checks.find((check) => check.name === "Target URL")?.status, "warn");
});

test("formatDoctorChecks renders status summary", () => {
  const checks = [
    { name: "Node.js", status: "pass", message: "Using Node 22." },
    { name: "Config file", status: "warn", message: "No config found." },
    { name: "Target URL", status: "fail", message: "Cannot reach app." }
  ];

  assert.deepEqual(summarizeDoctorChecks(checks), {
    pass: 1,
    warn: 1,
    fail: 1
  });
  assert.match(formatDoctorChecks(checks), /PASS Node.js/);
  assert.match(formatDoctorChecks(checks), /Summary: 1 pass, 1 warn, 1 fail/);
});
