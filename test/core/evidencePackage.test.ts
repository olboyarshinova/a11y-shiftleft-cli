import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEvidencePackage, verifyEvidencePackage } from "../../dist/core/evidencePackage.js";

test("createEvidencePackage defaults to text evidence with checksums", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-"));
  const reportsDir = path.join(root, "reports-run-1");
  const outputDir = path.join(root, "evidence");
  await fs.mkdir(path.join(reportsDir, "screenshots"), { recursive: true });
  await fs.writeFile(path.join(reportsDir, "a11y-report.json"), JSON.stringify({
    generatedAt: "2026-06-19T00:00:00.000Z",
    summary: {
      total: 4,
      critical: 1,
      warning: 2,
      info: 1,
      baseline: {
        enabled: true,
        newIssues: 1,
        resolvedIssues: 3
      },
      retest: {
        enabled: true,
        newIssues: 1,
        fixedIssues: 2,
        remainingIssues: 2
      }
    },
    issues: []
  }, null, 2));
  await fs.writeFile(path.join(reportsDir, "a11y-comment.md"), "# Report\n");
  await fs.writeFile(path.join(reportsDir, "a11y-evidence.jsonl"), "{\"ruleId\":\"button-name\"}\n");
  await fs.writeFile(path.join(reportsDir, "a11y-manual-checklist.md"), "# Manual\n");
  await fs.writeFile(path.join(reportsDir, "evaluation-scope.json"), JSON.stringify({
    reviewStatus: {
      manualReviewItems: 5,
      manualReviewCompleted: 3,
      manualStepRecords: 8,
      manualStepsCompleted: 4,
      manualTaskEvidenceAttachments: 2,
      manualRedactedTaskEvidence: 1,
      manualTemporaryAcceptances: 1,
      manualTemporaryAcceptancesExpiringSoon: 0
    }
  }, null, 2));
  await fs.writeFile(path.join(reportsDir, "keyboard-report.json"), "{}\n");
  await fs.writeFile(path.join(reportsDir, "dashboard.json"), JSON.stringify({
    totalRuns: 2,
    latestRun: {
      total: 4,
      manualReviewOpen: 2,
      journeyFindings: 1
    }
  }, null, 2));
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
  assert.deepEqual(manifest.reportSummary, {
    total: 4,
    critical: 1,
    warning: 2,
    info: 1,
    baseline: {
      enabled: true,
      newIssues: 1,
      resolvedIssues: 3
    },
    retest: {
      enabled: true,
      newIssues: 1,
      fixedIssues: 2,
      remainingIssues: 2
    }
  });
  assert.deepEqual(manifest.reviewSummary, {
    manualReviewItems: 5,
    manualReviewCompleted: 3,
    manualStepRecords: 8,
    manualStepsCompleted: 4,
    manualTaskEvidenceAttachments: 2,
    manualRedactedTaskEvidence: 1,
    manualTemporaryAcceptances: 1,
    manualTemporaryAcceptancesExpiringSoon: 0
  });
  assert.deepEqual(manifest.files.map((file) => file.path), [
    "a11y-comment.md",
    "a11y-evidence.json",
    "a11y-evidence.jsonl",
    "a11y-manual-checklist.md",
    "a11y-report.json",
    "dashboard.json",
    "evaluation-scope.json",
    "keyboard-report.json"
  ]);
  assert.deepEqual(manifest.contentSummary, {
    automatedReports: 2,
    evidenceExportFiles: 2,
    manualReviewFiles: 1,
    evaluationScope: true,
    keyboardEvidenceFiles: 1,
    dashboardFiles: 1,
    visualReports: 0,
    screenshots: 0,
    rawExplorationGraph: false
  });
  assert.deepEqual(manifest.reviewHints, [
    "Manual review is incomplete; review the remaining checklist items before treating this package as final evidence.",
    "Visual reports and screenshots were excluded. Re-run with --include-visual only when visual evidence is approved for sharing."
  ]);
  assert.match(manifest.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(await exists(path.join(outputDir, "exploration.html")), false);
  assert.equal(await exists(path.join(outputDir, "screenshots", "state-1.jpg")), false);
  assert.equal(await exists(path.join(outputDir, "evidence-manifest.json")), true);
  assert.equal(await exists(path.join(outputDir, "evidence-summary.md")), true);

  const summary = await fs.readFile(path.join(outputDir, "evidence-summary.md"), "utf8");
  assert.match(summary, /Accessibility Evidence Package/);
  assert.match(summary, /It does not upload reports anywhere/);
  assert.match(summary, /Screenshots included \| no/);
  assert.match(summary, /Audit Summary/);
  assert.match(summary, /Total findings \| 4/);
  assert.match(summary, /Critical \| 1/);
  assert.match(summary, /Baseline new findings \| 1/);
  assert.match(summary, /Retest fixed findings \| 2/);
  assert.match(summary, /Manual Review Summary/);
  assert.match(summary, /Manual review completed \| 3/);
  assert.match(summary, /Manual task evidence attachments \| 2/);
  assert.match(summary, /Temporary acceptances \| 1/);
  assert.match(summary, /Review Hints/);
  assert.match(summary, /Manual review is incomplete/);
  assert.match(summary, /Visual reports and screenshots were excluded/);
  assert.match(summary, /Automated report files \| 2/);
  assert.match(summary, /Machine-readable evidence exports \| 2/);
  assert.match(summary, /Manual-review files \| 1/);
  assert.match(summary, /Keyboard evidence files \| 1/);
  assert.match(summary, /Dashboard files \| 1/);
  assert.match(summary, /`a11y-report\.json`/);
  assert.match(summary, /`a11y-evidence\.json`/);
  assert.match(summary, /`a11y-evidence\.jsonl`/);
  assert.match(summary, /`dashboard\.json`/);
  assert.match(summary, /`evaluation-scope\.json`/);
  assert.match(summary, /[a-f0-9]{64}/);

  const generatedEvidence = JSON.parse(await fs.readFile(path.join(outputDir, "a11y-evidence.json"), "utf8"));
  assert.equal(generatedEvidence.generatedAt, "2026-06-20T00:00:00.000Z");
  assert.equal(generatedEvidence.localOnly, true);
  assert.equal(generatedEvidence.summary.total, 0);

  const verification = await verifyEvidencePackage(outputDir);
  assert.deepEqual(verification, {
    valid: true,
    filesChecked: manifest.files.length,
    missingFiles: [],
    changedFiles: []
  });

  await fs.appendFile(path.join(outputDir, "a11y-comment.md"), "Changed\n");
  const changed = await verifyEvidencePackage(outputDir);
  assert.equal(changed.valid, false);
  assert.deepEqual(changed.changedFiles, ["a11y-comment.md"]);
});

test("createEvidencePackage includes visual evidence only when requested", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-visual-"));
  const reportsDir = path.join(root, "reports");
  const outputDir = path.join(root, "evidence");
  await fs.mkdir(path.join(reportsDir, "screenshots"), { recursive: true });
  await fs.writeFile(path.join(reportsDir, "a11y-report.json"), "{}\n");
  await fs.writeFile(path.join(reportsDir, "exploration.html"), "<h1>Visual</h1>");
  await fs.writeFile(path.join(reportsDir, "exploration.pdf"), "pdf-data");
  await fs.writeFile(path.join(reportsDir, "dashboard.html"), "<h1>Dashboard</h1>");
  await fs.writeFile(path.join(reportsDir, "screenshots", "state-1.png"), "image-data");
  await fs.writeFile(path.join(reportsDir, "screenshots", "notes.txt"), "not evidence");

  const manifest = await createEvidencePackage({ reportsDir, outputDir, includeVisual: true });

  assert.equal(manifest.reportSummary, undefined);
  assert.deepEqual(manifest.files.map((file) => file.path), [
    "a11y-report.json",
    "dashboard.html",
    "exploration.html",
    "exploration.pdf",
    "screenshots/state-1.png"
  ]);
  assert.equal(manifest.privacy.screenshotsIncluded, true);
  assert.equal(manifest.privacy.reviewRequiredBeforeSharing, true);
  assert.equal(manifest.privacy.warnings.length, 3);
  assert.equal(manifest.contentSummary.visualReports, 3);
  assert.equal(manifest.contentSummary.dashboardFiles, 1);
  assert.equal(manifest.contentSummary.screenshots, 1);
  assert.deepEqual(manifest.reviewHints, [
    "No audit count summary was found in a11y-report.json.",
    "No evaluation-scope.json was included, so review scope and manual-review status are not documented in this package.",
    "No manual-review completion summary was found.",
    "No keyboard evidence file was included."
  ]);

  const summary = await fs.readFile(path.join(outputDir, "evidence-summary.md"), "utf8");
  assert.match(summary, /Include visual evidence \| yes/);
  assert.match(summary, /Screenshots included \| yes/);
  assert.match(summary, /Visual reports \| 3/);
  assert.match(summary, /Dashboard files \| 1/);
  assert.match(summary, /Screenshots \| 1/);
  assert.match(summary, /No audit count summary was found/);
  assert.match(summary, /No keyboard evidence file was included/);
  assert.match(summary, /Visual reports may contain rendered page content/);
  assert.match(summary, /Screenshots may contain personal/);
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
