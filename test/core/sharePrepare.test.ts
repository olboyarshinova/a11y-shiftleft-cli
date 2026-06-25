import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepareShareReport } from "../../dist/core/sharePrepare.js";

test("prepareShareReport writes sanitized local share artifacts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-share-"));
  const reportsDir = path.join(root, "reports");
  const outputDir = path.join(root, "share");
  await fs.mkdir(reportsDir);
  await fs.writeFile(path.join(reportsDir, "a11y-report.json"), JSON.stringify({
    generatedAt: "2026-06-25T00:00:00.000Z",
    summary: {
      total: 1,
      critical: 1,
      warning: 0,
      info: 0,
      rawCount: 1,
      uniqueCount: 1,
      duplicateCount: 0,
      duplicateRate: 0,
      scanDurationMs: 25,
      framework: "react",
      urls: ["https://example.com/account?token=secret#profile"],
      complianceEvidence: {
        automatedCoverage: "partial",
        requiresManualReview: true,
        totalFindings: 1,
        wcagMappedFindings: 1,
        unmappedFindings: 0,
        affectedPages: 1,
        topAffectedPages: [page("https://example.com/account?email=user@example.com")]
      },
      bySource: { axe: 1 },
      bySeverity: { critical: 1 },
      byConfidence: { high: 1 },
      byFindingType: { wcag: 1 },
      byCategory: { aria: 1 },
      byPour: { robust: 1 },
      byWcagLevel: { A: 1 },
      byWcagVersion: { "2.0": 1 },
      byUnmappedRule: {},
      byPage: [page("https://example.com/account?session=abc")]
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
        principle: "robust",
        introducedIn: "2.0",
        url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
      }],
      severity: "critical",
      confidence: "high",
      confidenceScore: 95,
      confidenceReason: "Fixture",
      findingType: "wcag",
      category: "aria",
      url: "https://example.com/account?token=secret",
      file: "/Users/example/private/project/src/App.tsx",
      selector: "button[data-email=\"user@example.com\"]",
      message: "Button leaks user@example.com and Bearer abc123 token=secret",
      screenshot: "screenshots/state-1.jpg",
      fingerprint: "button-name",
      duplicateCount: 0
    }]
  }, null, 2));
  await fs.writeFile(path.join(reportsDir, "evaluation-scope.json"), JSON.stringify({
    methodology: {
      name: "WCAG-EM-inspired evaluation scope",
      conformanceClaim: false
    },
    target: {
      urlsRequested: ["https://example.com/account?token=secret"],
      owner: "user@example.com"
    },
    sample: {
      includedUrls: ["https://example.com/account?session=abc"],
      statesVisited: 2,
      maxDepth: 1,
      representativeStates: [{
        id: "state-1",
        findingCount: 1,
        url: "https://example.com/account?email=user@example.com",
        sourcePath: "/Users/example/private/project/src/App.tsx"
      }]
    },
    evidence: {
      automatedSources: ["axe"],
      visualExploration: true,
      keyboardTraversal: true,
      lighthouseComparison: false,
      manualChecklist: true
    }
  }, null, 2));

  const manifest = await prepareShareReport({
    reportPath: reportsDir,
    outputDir,
    generatedAt: "2026-06-25T00:00:00.000Z"
  });

  assert.deepEqual(manifest.outputs, ["share-report.json", "share-evaluation-scope.json", "share-summary.md", "privacy-summary.json"]);
  assert.equal(manifest.privacy.screenshotsIncluded, false);
  assert.equal(manifest.privacy.evaluationScopeIncluded, true);
  assert.equal(manifest.privacy.rawExplorationIncluded, false);
  assert.equal(manifest.privacy.reviewRequiredBeforeSharing, true);
  assert.equal(manifest.privacy.queryStringsRemoved >= 7, true);
  assert.equal(manifest.privacy.absolutePathsRedacted >= 2, true);
  assert.equal(manifest.privacy.sensitiveTokensRedacted >= 3, true);

  const shareReport = JSON.parse(await fs.readFile(path.join(outputDir, "share-report.json"), "utf8"));
  const shareScope = JSON.parse(await fs.readFile(path.join(outputDir, "share-evaluation-scope.json"), "utf8"));
  const markdown = await fs.readFile(path.join(outputDir, "share-summary.md"), "utf8");

  assert.equal(shareReport.summary.urls[0], "https://example.com/account");
  assert.equal(shareReport.summary.byPage[0].url, "https://example.com/account");
  assert.equal(shareReport.issues[0].file, "[local-path]/project/src/App.tsx");
  assert.equal(shareScope.target.urlsRequested[0], "https://example.com/account");
  assert.equal(shareScope.sample.includedUrls[0], "https://example.com/account");
  assert.equal(shareScope.sample.representativeStates[0].sourcePath, "[local-path]/project/src/App.tsx");
  assert.equal(shareReport.issues[0].screenshot, undefined);
  assert.doesNotMatch(JSON.stringify(shareReport), /user@example\.com/);
  assert.doesNotMatch(JSON.stringify(shareScope), /user@example\.com/);
  assert.doesNotMatch(JSON.stringify(shareReport), /Bearer abc123/);
  assert.doesNotMatch(JSON.stringify(shareReport), /token=secret/);
  assert.doesNotMatch(JSON.stringify(shareScope), /token=secret/);
  assert.match(markdown, /Sanitized Accessibility Share Report/);
  assert.match(markdown, /## Evaluation Scope/);
  assert.match(markdown, /not a WCAG conformance claim/);
  assert.match(markdown, /Requested URLs \| https:\/\/example.com\/account/);
  assert.match(markdown, /Rendered states \| 2/);
  assert.match(markdown, /Automated sources \| axe/);
  assert.match(markdown, /Keyboard traversal \| yes/);
});

test("prepareShareReport refuses to write into a non-empty output directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-share-existing-"));
  const reportsDir = path.join(root, "reports");
  const outputDir = path.join(root, "share");
  await fs.mkdir(reportsDir);
  await fs.mkdir(outputDir);
  await fs.writeFile(path.join(outputDir, "keep.txt"), "keep");
  await fs.writeFile(path.join(reportsDir, "a11y-report.json"), JSON.stringify({
    generatedAt: "2026-06-25T00:00:00.000Z",
    summary: { total: 0, critical: 0, warning: 0, info: 0, rawCount: 0, uniqueCount: 0, duplicateCount: 0, duplicateRate: 0, scanDurationMs: 0, framework: "react", urls: [], complianceEvidence: { automatedCoverage: "partial", requiresManualReview: true, totalFindings: 0, wcagMappedFindings: 0, unmappedFindings: 0, affectedPages: 0, topAffectedPages: [] }, bySource: {}, bySeverity: {}, byConfidence: {}, byCategory: {}, byPour: {}, byWcagLevel: {}, byWcagVersion: {}, byUnmappedRule: {}, byPage: [] },
    issues: []
  }));

  await assert.rejects(
    prepareShareReport({ reportPath: reportsDir, outputDir }),
    /Share output directory must be empty/
  );
});

function page(url: string) {
  return {
    url,
    total: 1,
    critical: 1,
    warning: 0,
    info: 0,
    severityScore: 5
  };
}
