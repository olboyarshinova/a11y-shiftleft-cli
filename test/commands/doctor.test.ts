import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkFrameworkAdapterPackages, formatDoctorChecks, runDoctorChecks, summarizeDoctorChecks } from "../../dist/commands/doctor.js";

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
  assert.equal(checks.find((check) => check.name === "Framework")?.status, "warn");
  assert.equal(checks.find((check) => check.name === "Audit scope")?.status, "pass");
  assert.match(checks.find((check) => check.name === "Audit scope")?.message || "", /any rendered website URL/);
  assert.equal(checks.find((check) => check.name === "Target URL")?.status, "pass");
});

test("runDoctorChecks discovers .a11yrc.json config", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-doctor-rc-"));
  await fs.writeFile(path.join(cwd, ".a11yrc.json"), JSON.stringify({
    framework: "auto"
  }));

  const checks = await runDoctorChecks({
    cwd
  }, {
    nodeVersion: "22.0.0",
    env: {},
    checkChromium: async () => ({
      name: "Chromium",
      status: "pass",
      message: "Mock browser installed."
    }),
    fetch: async () => new Response("", { status: 200 })
  });

  assert.equal(checks.find((check) => check.name === "Config file")?.status, "pass");
  assert.match(checks.find((check) => check.name === "Config file")?.message || "", /\.a11yrc\.json/);
});

test("checkFrameworkAdapterPackages warns when framework is auto", () => {
  const checks = checkFrameworkAdapterPackages(process.cwd(), "auto");

  assert.equal(checks.length, 1);
  assert.equal(checks[0].status, "warn");
  assert.match(checks[0].message, /Framework is auto\/unknown/);
  assert.match(checks[0].message, /Browser audits still work/);
});

test("checkFrameworkAdapterPackages recommends user-facing adapter bundles", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-doctor-adapter-"));
  const checks = checkFrameworkAdapterPackages(cwd, "react");

  assert.equal(checks.length, 1);
  assert.equal(checks[0].name, "Framework adapter");
  assert.equal(checks[0].status, "warn");
  assert.match(checks[0].message, /@a11y-shiftleft\/react/);
  assert.match(checks[0].message, /npm install --save-dev/);
  assert.match(checks[0].message, /optional static adapter/);
});

test("runDoctorChecks autodetects React from package.json", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-doctor-react-"));
  await fs.writeFile(path.join(cwd, "package.json"), JSON.stringify({
    dependencies: {
      react: "^19.0.0"
    }
  }));

  const checks = await runDoctorChecks({
    cwd
  }, {
    nodeVersion: "22.0.0",
    env: {},
    checkChromium: async () => ({
      name: "Chromium",
      status: "pass",
      message: "Mock browser installed."
    }),
    fetch: async () => new Response("", { status: 200 })
  });

  assert.equal(checks.find((check) => check.name === "Framework")?.status, "pass");
  assert.match(checks.find((check) => check.name === "Framework")?.message || "", /Detected react/);
  assert.match(checks.find((check) => check.name === "Framework adapter")?.message || "", /@a11y-shiftleft\/react/);
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
