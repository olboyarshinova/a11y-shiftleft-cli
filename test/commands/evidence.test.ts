import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProgram } from "../../dist/cli.js";
import { formatEvidenceExportOutput, formatEvidencePackOutput, formatEvidenceVerifyOutput, formatEvidenceVerifyResult, shouldFailEvidenceVerify } from "../../dist/commands/evidence.js";
import { createEvidenceExport } from "../../dist/core/evidenceExport.js";
import type { EvidencePackageManifest } from "../../dist/core/evidencePackage.js";

test("evidence export exposes machine-readable evidence options", () => {
  const evidence = createProgram().commands.find((item) => item.name() === "evidence");
  const exportCommand = evidence?.commands.find((item) => item.name() === "export");

  assert.ok(exportCommand);
  const flags = exportCommand.options.map((option) => option.long);
  assert.equal(flags.includes("--report"), true);
  assert.equal(flags.includes("--out"), true);
  assert.equal(flags.includes("--format"), true);
  assert.match(exportCommand.description(), /machine-readable finding evidence dataset/);
});

test("evidence verify exposes evidence package verification options", () => {
  const evidence = createProgram().commands.find((item) => item.name() === "evidence");
  const verifyCommand = evidence?.commands.find((item) => item.name() === "verify");

  assert.ok(verifyCommand);
  const flags = verifyCommand.options.map((option) => option.long);
  assert.equal(flags.includes("--package"), true);
  assert.equal(flags.includes("--require-review-ready"), true);
  assert.equal(flags.includes("--format"), true);
  assert.match(verifyCommand.description(), /Verify checksums/);
});

test("formatEvidencePackOutput includes review hints for evidence packages", () => {
  const manifest = evidenceManifest({
    reviewHints: [
      "No keyboard evidence file was included.",
      "Manual review is incomplete.",
      "Visual reports and screenshots were excluded.",
      "No evaluation-scope.json was included."
    ],
    reviewReadiness: {
      readyForReview: false,
      blockingHints: [
        "Add a valid a11y-report.json with audit summary counts.",
        "Add evaluation-scope.json so review scope and manual-review status are documented.",
        "Add manual-review completion evidence before treating this package as review-ready."
      ]
    }
  });

  const output = formatEvidencePackOutput(manifest, "/tmp/a11y-evidence");

  assert.match(output, /Created local evidence package with 1 file/);
  assert.match(output, /Contents: reports=1 exports=0 manual=0 keyboard=0 dashboard=0 visual=0 screenshots=0/);
  assert.match(output, /Review summary: none included/);
  assert.match(output, /Review readiness: not ready for review handoff \(3 blockers\)/);
  assert.match(output, /Review before sharing: \/tmp\/a11y-evidence\/evidence-summary\.md/);
  assert.match(output, /Machine-readable manifest: \/tmp\/a11y-evidence\/evidence-manifest\.json/);
  assert.match(output, /Next: npx a11y-shiftleft-cli evidence verify --package \/tmp\/a11y-evidence/);
  assert.match(output, /Review hints: 4/);
  assert.match(output, /No keyboard evidence file was included/);
  assert.match(output, /1 more hint in evidence-summary\.md/);
});

test("formatEvidencePackOutput quotes verify command paths when needed", () => {
  const output = formatEvidencePackOutput(evidenceManifest(), "/tmp/a11y evidence");

  assert.match(output, /Next: npx a11y-shiftleft-cli evidence verify --package '\/tmp\/a11y evidence'/);
});

test("formatEvidencePackOutput shows when no review hints remain", () => {
  const output = formatEvidencePackOutput(evidenceManifest({
    reviewHints: [],
    contentSummary: {
      automatedReports: 2,
      evidenceExportFiles: 1,
      manualReviewFiles: 1,
      evaluationScope: true,
      keyboardEvidenceFiles: 1,
      dashboardFiles: 1,
      visualReports: 2,
      screenshots: 3,
      rawExplorationGraph: true
    }
  }), "/tmp/a11y-evidence");

  assert.match(output, /Review hints: none/);
  assert.match(output, /Contents: reports=2 exports=1 manual=1 keyboard=1 dashboard=1 visual=2 screenshots=3/);
  assert.match(output, /Review readiness: ready for review handoff/);
});

test("formatEvidencePackOutput summarizes manual review and journey evidence", () => {
  const output = formatEvidencePackOutput(evidenceManifest({
    reviewSummary: {
      manualReviewItems: 5,
      manualReviewCompleted: 3,
      manualStepRecords: 4,
      manualStepsCompleted: 2,
      manualTaskEvidenceAttachments: 1,
      manualRedactedTaskEvidence: 1,
      manualTemporaryAcceptances: 0,
      manualTemporaryAcceptancesExpiringSoon: 0,
      criticalJourneys: 1,
      journeyFindings: 3,
      journeyCritical: 1,
      journeyWarning: 2,
      journeyInfo: 0
    }
  }), "/tmp/a11y-evidence");

  assert.match(output, /Review summary: manual 3\/5 completed; steps 2\/4 reviewed; journeys 1 tracked; 3 journey findings; 1 critical, 2 warning, 0 info/);
});

test("formatEvidenceVerifyOutput summarizes valid and invalid packages", () => {
  assert.match(formatEvidenceVerifyOutput({
    valid: true,
    filesChecked: 2,
    missingFiles: [],
    changedFiles: [],
    reviewSummary: undefined,
    reviewHints: [],
    reviewReadiness: {
      readyForReview: true,
      blockingHints: []
    },
    privacy: {
      screenshotsIncluded: false,
      reviewRequiredBeforeSharing: true,
      warnings: []
    }
  }, "/tmp/a11y-evidence"), /Evidence package verified: \/tmp\/a11y-evidence[\s\S]*Files checked: 2/);

  const invalid = formatEvidenceVerifyOutput({
    valid: false,
    filesChecked: 3,
    missingFiles: ["a11y-report.json"],
    changedFiles: ["a11y-comment.md"],
    reviewSummary: {
      manualReviewItems: 5,
      manualReviewCompleted: 3,
      manualStepRecords: 4,
      manualStepsCompleted: 2,
      manualTaskEvidenceAttachments: 1,
      manualRedactedTaskEvidence: 1,
      manualTemporaryAcceptances: 0,
      manualTemporaryAcceptancesExpiringSoon: 0,
      criticalJourneys: 1,
      journeyFindings: 3,
      journeyCritical: 1,
      journeyWarning: 2,
      journeyInfo: 0
    },
    reviewHints: [
      "Manual review is incomplete.",
      "No keyboard evidence file was included.",
      "No evaluation-scope.json was included.",
      "Visual reports and screenshots were excluded."
    ],
    reviewReadiness: {
      readyForReview: false,
      blockingHints: [
        "Fix missing or changed package files before sharing this evidence package.",
        "Complete manual review."
      ]
    },
    privacy: {
      screenshotsIncluded: true,
      reviewRequiredBeforeSharing: true,
      warnings: [
        "Review URLs, selectors, file paths, issue messages, and manual-review notes before sharing.",
        "Screenshots may contain personal, account, payment, or other sensitive information."
      ]
    }
  }, "/tmp/a11y-evidence");

  assert.match(invalid, /verification failed/);
  assert.match(invalid, /Review summary: manual 3\/5 completed; steps 2\/4 reviewed; journeys 1 tracked; 3 journey findings; 1 critical, 2 warning, 0 info/);
  assert.match(invalid, /Review readiness: not ready for review handoff \(2 blockers\)/);
  assert.match(invalid, /Review readiness blockers:/);
  assert.match(invalid, /Fix missing or changed package files before sharing this evidence package/);
  assert.match(invalid, /Complete manual review/);
  assert.match(invalid, /Privacy: screenshots included; review before sharing required; 2 privacy warnings/);
  assert.match(invalid, /Review before sharing: \/tmp\/a11y-evidence\/evidence-summary\.md/);
  assert.match(invalid, /Review hints: 4/);
  assert.match(invalid, /Manual review is incomplete/);
  assert.match(invalid, /1 more hint in evidence-summary\.md/);
  assert.match(invalid, /missing: a11y-report\.json/);
  assert.match(invalid, /changed: a11y-comment\.md/);
});

test("shouldFailEvidenceVerify can require review-ready handoff evidence", () => {
  const checksumValidButNotReady = {
    valid: true,
    filesChecked: 1,
    missingFiles: [],
    changedFiles: [],
    reviewHints: [],
    reviewReadiness: {
      readyForReview: false,
      blockingHints: ["Add keyboard evidence before treating this package as review-ready."]
    },
    privacy: {
      screenshotsIncluded: false,
      reviewRequiredBeforeSharing: true,
      warnings: []
    }
  };

  assert.equal(shouldFailEvidenceVerify(checksumValidButNotReady), false);
  assert.equal(shouldFailEvidenceVerify(checksumValidButNotReady, { requireReviewReady: true }), true);
  assert.equal(shouldFailEvidenceVerify({
    ...checksumValidButNotReady,
    valid: false,
    reviewReadiness: {
      readyForReview: true,
      blockingHints: []
    }
  }, { requireReviewReady: true }), true);
});

test("formatEvidenceVerifyResult can output machine-readable JSON", () => {
  const output = formatEvidenceVerifyResult({
    valid: true,
    filesChecked: 1,
    missingFiles: [],
    changedFiles: [],
    reviewHints: [],
    reviewReadiness: {
      readyForReview: true,
      blockingHints: []
    },
    privacy: {
      screenshotsIncluded: false,
      reviewRequiredBeforeSharing: true,
      warnings: []
    }
  }, "/tmp/a11y-evidence", "json");

  const parsed = JSON.parse(output);
  assert.equal(parsed.package, "/tmp/a11y-evidence");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.filesChecked, 1);
  assert.equal(parsed.reviewReadiness.readyForReview, true);
});

test("evidence verify rejects unsupported output formats", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-verify-format-"));
  const packageDir = path.join(root, "evidence");
  await fs.mkdir(packageDir);
  await fs.writeFile(path.join(packageDir, "evidence-manifest.json"), JSON.stringify({
    version: 1,
    generatedAt: "2026-07-30T00:00:00.000Z",
    source: "reports",
    localOnly: true,
    includeVisual: false,
    reviewHints: [],
    contentSummary: {
      automatedReports: 0,
      evidenceExportFiles: 0,
      manualReviewFiles: 0,
      evaluationScope: false,
      keyboardEvidenceFiles: 0,
      dashboardFiles: 0,
      visualReports: 0,
      screenshots: 0,
      rawExplorationGraph: false
    },
    files: [],
    reviewReadiness: {
      readyForReview: true,
      blockingHints: []
    },
    privacy: {
      screenshotsIncluded: false,
      reviewRequiredBeforeSharing: true,
      warnings: []
    }
  }));

  await assert.rejects(
    createProgram().parseAsync([
      "node",
      "a11y-shiftleft",
      "evidence",
      "verify",
      "--package",
      packageDir,
      "--format",
      "yaml"
    ]),
    /Unsupported evidence verify format/
  );
});

test("formatEvidenceExportOutput summarizes the exported evidence dataset", () => {
  const output = formatEvidenceExportOutput(createEvidenceExport(reportFixture()), "/tmp/evidence.json");

  assert.match(output, /Wrote 1 evidence record to \/tmp\/evidence\.json/);
  assert.match(output, /Scope: audit\/validation \| wcag22-aa \| 1 URL \| Chromium/);
  assert.match(output, /Summary: 1 critical, 0 warning, 0 info/);
  assert.match(output, /Evidence types: 1 WCAG-mapped, 0 needs review, 0 best practice/);
  assert.match(output, /Top URL: https:\/\/example\.test \(1\)/);
  assert.match(output, /Top WCAG criterion: 4\.1\.2 \(1\)/);
});

test("formatEvidenceExportOutput includes manual review and journey summaries when available", () => {
  const evidence = createEvidenceExport(reportFixture());
  evidence.review = {
    manualChecklist: {
      total: 3,
      pass: 1,
      fail: 1,
      notReviewed: 1,
      notApplicable: 0,
      targetCount: 2,
      journeyTargetCount: 1,
      stepRecords: 4,
      reviewedSteps: 2,
      taskEvidenceAttachments: 1,
      redactedTaskEvidence: 1,
      temporaryAcceptances: 0,
      temporaryAcceptanceExpiring: 0
    },
    journeys: [{
      name: "Checkout",
      urls: ["https://example.test"],
      findingCount: 2,
      critical: 1,
      warning: 1,
      info: 0
    }]
  };
  evidence.summary.byJourney = {
    Checkout: 2,
    Search: 1
  };

  const output = formatEvidenceExportOutput(evidence, "/tmp/evidence.json");

  assert.match(output, /Manual review: 1 pass, 1 fail, 1 not reviewed, 2 targets/);
  assert.match(output, /Journeys: 1 tracked, 2 findings \(1 critical, 1 warning, 0 info\)/);
  assert.match(output, /Top journey: Checkout \(2\)/);
});

test("evidence export writes JSONL records from an accessibility report", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-export-"));
  const reportPath = path.join(root, "a11y-report.json");
  const outputPath = path.join(root, "evidence.jsonl");
  await fs.writeFile(reportPath, JSON.stringify({
    generatedAt: "2026-07-13T00:00:00.000Z",
    summary: {},
    issues: [{
      source: "axe",
      framework: "react",
      ruleId: "button-name",
      wcag: ["4.1.2"],
      wcagCriteria: [],
      tags: [],
      severity: "critical",
      confidence: "high",
      confidenceScore: 95,
      confidenceReason: "Rendered DOM evidence.",
      findingType: "wcag",
      category: "semantics",
      message: "Buttons must have discernible text",
      fingerprint: "button-name::test",
      duplicateCount: 1
    }]
  }));

  await createProgram().parseAsync([
    "node",
    "a11y-shiftleft",
    "evidence",
    "export",
    "--report",
    reportPath,
    "--out",
    outputPath,
    "--format",
    "jsonl"
  ]);

  const lines = (await fs.readFile(outputPath, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).ruleId, "button-name");
});

function reportFixture() {
  return {
    generatedAt: "2026-07-13T00:00:00.000Z",
    summary: {
      urls: ["https://example.test"],
      auditTrail: {
        command: {
          name: "audit",
          profile: "validation"
        },
        requestedUrls: ["https://example.test"],
        includedUrls: ["https://example.test"],
        outputFormats: ["json"],
        browsers: [{
          engine: "chromium",
          name: "Chromium",
          version: "141.0.0.0",
          source: "exploration"
        }],
        automation: {
          staticAnalysis: false,
          browserAutomation: true,
          keyboardTraversal: false,
          lighthouseComparison: false,
          manualChecklist: false
        }
      },
      standard: {
        id: "wcag22-aa",
        label: "WCAG 2.2 AA support mode",
        wcagVersion: "2.2",
        wcagLevel: "AA",
        automatedCoverage: "partial",
        requiresManualReview: true
      }
    },
    issues: [{
      source: "axe",
      framework: "react",
      ruleId: "button-name",
      wcag: ["4.1.2"],
      wcagCriteria: [{
        id: "4.1.2",
        title: "Name, Role, Value",
        level: "A",
        principle: "Robust",
        introducedIn: "2.0",
        url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
      }],
      tags: [],
      severity: "critical",
      confidence: "high",
      confidenceScore: 95,
      confidenceReason: "Rendered DOM evidence.",
      findingType: "wcag",
      category: "semantics",
      message: "Buttons must have discernible text",
      selector: ".icon-button",
      url: "https://example.test",
      fingerprint: "button-name::test",
      duplicateCount: 1
    }]
  } as const;
}

function evidenceManifest(overrides: Partial<EvidencePackageManifest> = {}): EvidencePackageManifest {
  return {
    version: 1,
    generatedAt: "2026-07-24T00:00:00.000Z",
    source: "reports",
    localOnly: true,
    includeVisual: false,
    contentSummary: {
      automatedReports: 1,
      evidenceExportFiles: 0,
      manualReviewFiles: 0,
      evaluationScope: false,
      keyboardEvidenceFiles: 0,
      dashboardFiles: 0,
      visualReports: 0,
      screenshots: 0,
      rawExplorationGraph: false
    },
    reviewHints: [],
    reviewReadiness: {
      readyForReview: true,
      blockingHints: []
    },
    files: [{
      path: "a11y-report.json",
      bytes: 2,
      sha256: "0".repeat(64)
    }],
    privacy: {
      screenshotsIncluded: false,
      reviewRequiredBeforeSharing: true,
      warnings: []
    },
    ...overrides
  };
}

test("evidence export writes JSON-LD evidence from an accessibility report", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-evidence-export-jsonld-"));
  const reportPath = path.join(root, "a11y-report.json");
  const outputPath = path.join(root, "evidence.jsonld");
  await fs.writeFile(reportPath, JSON.stringify({
    generatedAt: "2026-07-13T00:00:00.000Z",
    summary: {},
    issues: [{
      source: "axe",
      framework: "react",
      ruleId: "button-name",
      wcag: ["4.1.2"],
      wcagCriteria: [],
      tags: [],
      severity: "critical",
      confidence: "high",
      confidenceScore: 95,
      confidenceReason: "Rendered DOM evidence.",
      findingType: "wcag",
      category: "semantics",
      message: "Buttons must have discernible text",
      fingerprint: "button-name::test",
      duplicateCount: 1
    }]
  }));

  await createProgram().parseAsync([
    "node",
    "a11y-shiftleft",
    "evidence",
    "export",
    "--report",
    reportPath,
    "--out",
    outputPath,
    "--format",
    "jsonld"
  ]);

  const linkedData = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.equal(linkedData["@type"], "schema:Dataset");
  assert.equal(linkedData["earl:assertions"][0]["earl:test"]["schema:identifier"], "button-name");
});
