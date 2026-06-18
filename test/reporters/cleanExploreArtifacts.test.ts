import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanExploreArtifacts } from "../../dist/reporters/cleanExploreArtifacts.js";

test("cleanExploreArtifacts removes generated reports and stale state screenshots only", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-clean-explore-"));
  const screenshotsDir = path.join(outputDir, "screenshots");
  await fs.mkdir(screenshotsDir, { recursive: true });

  await fs.writeFile(path.join(outputDir, "a11y-report.json"), "{}");
  await fs.writeFile(path.join(outputDir, "exploration-visual-check.html"), "<html></html>");
  await fs.writeFile(path.join(outputDir, "exploration.html"), "<html></html>");
  await fs.writeFile(path.join(outputDir, "exploration.pdf"), "pdf");
  await fs.writeFile(path.join(outputDir, "custom-team-report.json"), "{}");
  await fs.writeFile(path.join(screenshotsDir, "state-1.png"), "old screenshot");
  await fs.writeFile(path.join(screenshotsDir, "state-2.jpg"), "old screenshot");
  await fs.writeFile(path.join(screenshotsDir, "state-12.jpeg"), "old screenshot");
  await fs.writeFile(path.join(screenshotsDir, "custom.png"), "keep me");

  const result = await cleanExploreArtifacts(outputDir);

  assert.deepEqual(result, {
    filesRemoved: 4,
    screenshotsRemoved: 3
  });
  assert.equal(await exists(path.join(outputDir, "a11y-report.json")), false);
  assert.equal(await exists(path.join(outputDir, "exploration-visual-check.html")), false);
  assert.equal(await exists(path.join(outputDir, "exploration.html")), false);
  assert.equal(await exists(path.join(outputDir, "exploration.pdf")), false);
  assert.equal(await exists(path.join(outputDir, "custom-team-report.json")), true);
  assert.equal(await exists(path.join(screenshotsDir, "state-1.png")), false);
  assert.equal(await exists(path.join(screenshotsDir, "state-2.jpg")), false);
  assert.equal(await exists(path.join(screenshotsDir, "state-12.jpeg")), false);
  assert.equal(await exists(path.join(screenshotsDir, "custom.png")), true);
});

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
