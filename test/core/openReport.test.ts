import test from "node:test";
import assert from "node:assert/strict";
import { getOpenReportCommand } from "../../dist/core/openReport.js";

test("getOpenReportCommand uses the native opener on macOS", () => {
  assert.deepEqual(getOpenReportCommand("reports/a11y-report.html", "darwin"), {
    command: "open",
    args: ["reports/a11y-report.html"]
  });
});

test("getOpenReportCommand uses xdg-open on Linux", () => {
  assert.deepEqual(getOpenReportCommand("reports/a11y-report.html", "linux"), {
    command: "xdg-open",
    args: ["reports/a11y-report.html"]
  });
});

test("getOpenReportCommand uses start through cmd on Windows", () => {
  assert.deepEqual(getOpenReportCommand("reports/a11y-report.html", "win32"), {
    command: "cmd",
    args: ["/c", "start", "", "reports/a11y-report.html"]
  });
});
