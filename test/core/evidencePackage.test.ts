import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEvidencePackage } from "../../dist/core/evidencePackage.js";

test("createEvidencePackage defaults to text evidence with checksums", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-"));
  const reportsDir = path.join(root, "reports-run-1");
  const outputDir = path.join(root, "evidence");
  await fs.mkdir(path.join(reportsDir, "screenshots"), { recursive: true });
  await fs.writeFile(path.join(reportsDir, "a11y-report.json"), "{\"issues\":[]}\n");
  await fs.writeFile(path.join(reportsDir, "a11y-comment.md"), "# Report\n");
  await fs.writeFile(path.join(reportsDir, "exploration.html"), "<h1>Visual</h1>");
  await fs.writeFile(path.join(reportsDir, "screenshots", "state-1.jpg"), "image-data");

  const manifest = await createEvidencePackage({
    reportsDir,
    outputDir,
    generatedAt: "2026-06-20T00:00:00.000Z"
  });

  assert.equal(manifest.generatedAt, "2026-06-20T00:00:00.000Z");
  assert.equal(manifest.source, "reports-run-1");
  assert.equal(manifest.includeVisual, false);
  assert.deepEqual(manifest.files.map((file) => file.path), ["a11y-comment.md", "a11y-report.json"]);
  assert.match(manifest.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(await exists(path.join(outputDir, "exploration.html")), false);
  assert.equal(await exists(path.join(outputDir, "screenshots", "state-1.jpg")), false);
  assert.equal(await exists(path.join(outputDir, "evidence-manifest.json")), true);
});

test("createEvidencePackage includes visual evidence only when requested", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-visual-"));
  const reportsDir = path.join(root, "reports");
  const outputDir = path.join(root, "evidence");
  await fs.mkdir(path.join(reportsDir, "screenshots"), { recursive: true });
  await fs.writeFile(path.join(reportsDir, "a11y-report.json"), "{}\n");
  await fs.writeFile(path.join(reportsDir, "exploration.html"), "<h1>Visual</h1>");
  await fs.writeFile(path.join(reportsDir, "exploration.pdf"), "pdf-data");
  await fs.writeFile(path.join(reportsDir, "screenshots", "state-1.png"), "image-data");
  await fs.writeFile(path.join(reportsDir, "screenshots", "notes.txt"), "not evidence");

  const manifest = await createEvidencePackage({ reportsDir, outputDir, includeVisual: true });

  assert.deepEqual(manifest.files.map((file) => file.path), [
    "a11y-report.json",
    "exploration.html",
    "exploration.pdf",
    "screenshots/state-1.png"
  ]);
  assert.equal(manifest.privacy.screenshotsIncluded, true);
  assert.equal(manifest.privacy.reviewRequiredBeforeSharing, true);
  assert.equal(manifest.privacy.warnings.length, 3);
});

test("createEvidencePackage refuses to mix with an existing output directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-existing-"));
  const reportsDir = path.join(root, "reports");
  const outputDir = path.join(root, "evidence");
  await fs.mkdir(reportsDir);
  await fs.mkdir(outputDir);
  await fs.writeFile(path.join(reportsDir, "a11y-report.json"), "{}\n");
  await fs.writeFile(path.join(outputDir, "keep.txt"), "keep");

  await assert.rejects(
    createEvidencePackage({ reportsDir, outputDir }),
    /Evidence output directory must be empty/
  );
});

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
