import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProgram } from "../../dist/cli.js";
import { formatEvidenceExportOutput, formatEvidencePackOutput } from "../../dist/commands/evidence.js";
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

test("formatEvidencePackOutput includes review hints for evidence packages", () => {
  const manifest = evidenceManifest({
    reviewHints: [
      "No keyboard evidence file was included.",
      "Manual review is incomplete.",
      "Visual reports and screenshots were excluded.",
      "No evaluation-scope.json was included."
    ]
  });

  const output = formatEvidencePackOutput(manifest, "/tmp/a11y-evidence");

  assert.match(output, /Created local evidence package with 1 file/);
  assert.match(output, /Review before sharing: \/tmp\/a11y-evidence\/evidence-summary\.md/);
  assert.match(output, /Machine-readable manifest: \/tmp\/a11y-evidence\/evidence-manifest\.json/);
  assert.match(output, /Review hints: 4/);
  assert.match(output, /No keyboard evidence file was included/);
  assert.match(output, /1 more hint in evidence-summary\.md/);
});

test("formatEvidencePackOutput shows when no review hints remain", () => {
  const output = formatEvidencePackOutput(evidenceManifest({ reviewHints: [] }), "/tmp/a11y-evidence");

  assert.match(output, /Review hints: none/);
});

test("formatEvidenceExportOutput summarizes the exported evidence dataset", () => {
  const output = formatEvidenceExportOutput(createEvidenceExport(reportFixture()), "/tmp/evidence.json");

  assert.match(output, /Wrote 1 evidence record to \/tmp\/evidence\.json/);
  assert.match(output, /Summary: 1 critical, 0 warning, 0 info/);
  assert.match(output, /Evidence types: 1 WCAG-mapped, 0 needs review, 0 best practice/);
  assert.match(output, /Top URL: https:\/\/example\.test \(1\)/);
  assert.match(output, /Top WCAG criterion: 4\.1\.2 \(1\)/);
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
    summary: {},
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
      manualReviewFiles: 0,
      evaluationScope: false,
      keyboardEvidenceFiles: 0,
      visualReports: 0,
      screenshots: 0,
      rawExplorationGraph: false
    },
    reviewHints: [],
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
