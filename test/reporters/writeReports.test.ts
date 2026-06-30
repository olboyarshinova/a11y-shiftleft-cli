import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeReports } from "../../dist/reporters/writeReports.js";
import type { ManualChecklist } from "../../dist/types.js";

test("writeReports writes JSON, CSV, and Markdown metrics", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-"));

  const report = await writeReports(
    outputDir,
    [
      {
        source: "axe",
        severity: "critical",
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
        selector: ".icon-button",
        url: "http://localhost:3000/settings",
        colorScheme: "dark",
        ownership: {
          kind: "third-party-embed",
          label: "Third-party embedded content",
          source: "youtube.com",
          url: "https://www.youtube.com",
          note: "Third-party embedded content. Manual verification recommended."
        },
        message: "Buttons must have discernible text",
        remediation: {
          summary: "Give every button an accessible name.",
          howToFix: ["Use visible button text when possible."],
          docs: ["https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"],
          frameworkExamples: {
            react: "<button type=\"button\" aria-label=\"Open menu\"><MenuIcon /></button>"
          }
        }
      },
      {
        source: "eslint",
        severity: "warning",
        ruleId: "jsx-a11y/alt-text",
        wcag: ["1.1.1"],
        wcagCriteria: [{
          id: "1.1.1",
          title: "Non-text Content",
          level: "A",
          principle: "perceivable",
          introducedIn: "2.0",
          url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html"
        }],
        file: "src/App.jsx",
        line: 10,
        column: 5,
        url: "http://localhost:3000/",
        message: "Image elements must have alternate text"
      }
    ],
    {
      framework: "react",
      rawCount: 4,
      uniqueCount: 2,
      duplicateCount: 2,
      scanDurationMs: 123,
      urls: ["http://localhost:3000"],
      lighthouse: [{
        url: "http://localhost:3000",
        finalUrl: "http://localhost:3000/",
        accessibilityScore: 91,
        failedAudits: [{
        id: "color-contrast",
        title: "Background and foreground colors have sufficient contrast",
        score: 0,
        scoreDisplayMode: "binary",
        description: "Low-contrast text can be difficult to read.",
        documentationUrl: "https://example.com/contrast"
      }],
      manualAudits: [{
        id: "logical-tab-order",
        title: "The page has a logical tab order",
        score: null,
        scoreDisplayMode: "manual",
        description: "Confirm that keyboard focus moves in a meaningful order.",
        documentationUrl: "https://example.com/tab-order"
      }],
        notApplicableAudits: 3,
        durationMs: 1500
      }],
      standard: {
        id: "ada-title-ii",
        label: "ADA Title II web accessibility support mode",
        wcagVersion: "2.1",
        wcagLevel: "AA",
        automatedCoverage: "partial",
        requiresManualReview: true,
        disclaimer: "This report supports accessibility risk detection and remediation tracking. It does not certify legal compliance with ADA, Section 508, or WCAG. Manual review is required."
      }
    },
    {
      frameworkExample: "react"
    }
  );

  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.duplicateRate, 0.5);
  assert.deepEqual(report.summary.bySource, {
    axe: 1,
    eslint: 1
  });
  assert.deepEqual(report.summary.byConfidence, {
    high: 1,
    medium: 1
  });
  assert.deepEqual(report.summary.byColorScheme, {
    dark: 1
  });
  assert.deepEqual(report.summary.byCategory, {
    aria: 1,
    images: 1
  });
  assert.deepEqual(report.summary.byOwnership, {
    "third-party-embed": 1
  });
  assert.equal(report.summary.blockedByHumanVerification, 0);
  assert.deepEqual(report.summary.byPour, {
    robust: 1,
    perceivable: 1
  });
  assert.deepEqual(report.summary.byWcagVersion, {
    "2.0": 2
  });
  assert.deepEqual(report.summary.complianceEvidence, {
    standardId: "ada-title-ii",
    wcagVersion: "2.1",
    wcagLevel: "AA",
    automatedCoverage: "partial",
    requiresManualReview: true,
    totalFindings: 2,
    wcagMappedFindings: 2,
    bestPracticeFindings: 0,
    unmappedFindings: 0,
    affectedPages: 2,
    topAffectedPages: [
      {
        url: "http://localhost:3000/settings",
        total: 1,
        critical: 1,
        warning: 0,
        info: 0,
        severityScore: 5
      },
      {
        url: "http://localhost:3000/",
        total: 1,
        critical: 0,
        warning: 1,
        info: 0,
        severityScore: 2
      }
    ]
  });
  assert.deepEqual(report.summary.byUnmappedRule, {});
  assert.deepEqual(report.summary.byFindingType, { wcag: 2 });
  assert.deepEqual(report.summary.lighthouse, {
    enabled: true,
    pageCount: 1,
    averageAccessibilityScore: 91,
    minAccessibilityScore: 91,
    failedAuditCount: 1,
    manualAuditCount: 1,
    comparison: {
      matchingRuleIds: [],
      lighthouseOnlyAudits: [{
        id: "color-contrast",
        title: "Background and foreground colors have sufficient contrast",
        score: 0,
        scoreDisplayMode: "binary",
        description: "Low-contrast text can be difficult to read.",
        documentationUrl: "https://example.com/contrast"
      }],
      pipelineOnlyRules: [{
        ruleId: "button-name",
        count: 1,
        sources: ["axe"],
        highestSeverity: "critical",
        findingType: "wcag",
        category: "aria"
      }, {
        ruleId: "jsx-a11y/alt-text",
        count: 1,
        sources: ["eslint"],
        highestSeverity: "warning",
        findingType: "wcag",
        category: "images"
      }]
    },
    pages: [{
      url: "http://localhost:3000/",
      score: 91,
      failedAudits: 1,
      manualAudits: 1
    }]
  });
  assert.equal(report.summary.rootCauseCount, 2);
  assert.deepEqual(report.summary.byPage, [
    {
      url: "http://localhost:3000/settings",
      total: 1,
      critical: 1,
      warning: 0,
      info: 0,
      severityScore: 5
    },
    {
      url: "http://localhost:3000/",
      total: 1,
      critical: 0,
      warning: 1,
      info: 0,
      severityScore: 2
    }
  ]);

  const json = JSON.parse(
    await fs.readFile(path.join(outputDir, "a11y-report.json"), "utf8")
  );
  const csv = await fs.readFile(path.join(outputDir, "a11y-metrics.csv"), "utf8");
  const findingsCsv = await fs.readFile(path.join(outputDir, "a11y-findings.csv"), "utf8");
  const summaryCsv = await fs.readFile(path.join(outputDir, "a11y-summary.csv"), "utf8");
  const pagesCsv = await fs.readFile(path.join(outputDir, "a11y-pages.csv"), "utf8");
  const rulesCsv = await fs.readFile(path.join(outputDir, "a11y-rules.csv"), "utf8");
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");
  const scope = JSON.parse(
    await fs.readFile(path.join(outputDir, "evaluation-scope.json"), "utf8")
  );

  assert.equal(json.summary.framework, "react");
  assert.equal(scope.methodology.name, "WCAG-EM-inspired evaluation scope");
  assert.equal(scope.methodology.conformanceClaim, false);
  assert.equal(scope.target.standard.id, "ada-title-ii");
  assert.equal(scope.sample.strategy, "configured-urls");
  assert.deepEqual(scope.evidence.automatedSources, ["axe", "eslint"]);
  assert.equal(scope.evidence.lighthouseComparison, true);
  assert.equal(scope.reviewStatus.needsHumanEvaluation, true);
  assert.equal(json.summary.standard.id, "ada-title-ii");
  assert.equal(json.issues[0].confidence, "high");
  assert.equal(json.issues[0].confidenceScore, 95);
  assert.equal(json.issues[0].category, "aria");
  assert.equal(json.issues[0].ownership.source, "youtube.com");
  assert.equal(json.issues[0].ownership.note, "Third-party embedded content. Manual verification recommended.");
  assert.equal(json.issues[0].remediation.summary, "Give every button an accessible name.");
  assert.equal(json.lighthouse[0].accessibilityScore, 91);
  assert.match(markdown, /Step 1: Use visible button text when possible/);
  assert.match(markdown, /Lighthouse Accessibility Score/);
  assert.match(markdown, /Average score \| 91/);
  assert.match(markdown, /http:\/\/localhost:3000\/ \| 91 \| 1 \| 1/);
  assert.match(markdown, /Lighthouse And Pipeline Comparison/);
  assert.match(markdown, /Lighthouse-only failed audits/);
  assert.match(markdown, /`color-contrast`: Background and foreground colors have sufficient contrast/);
  assert.match(markdown, /Pipeline-only rules/);
  assert.match(markdown, /`button-name`: 1 finding, critical, axe/);
  assert.match(markdown, /Lighthouse Recommendations/);
  assert.match(markdown, /Low-contrast text can be difficult to read/);
  assert.match(markdown, /Docs: https:\/\/example\.com\/contrast/);
  assert.match(markdown, /Confirm that keyboard focus moves in a meaningful order/);
  assert.match(csv, /duplicateRate,0\.5/);
  assert.match(csv, /standard\.id,ada-title-ii/);
  assert.match(csv, /standard\.requiresManualReview,true/);
  assert.match(csv, /complianceEvidence\.wcagMappedFindings,2/);
  assert.match(csv, /complianceEvidence\.affectedPages,2/);
  assert.match(csv, /bySource\.axe,1/);
  assert.match(csv, /byConfidence\.high,1/);
  assert.match(csv, /byColorScheme\.dark,1/);
  assert.match(csv, /byCategory\.aria,1/);
  assert.match(csv, /byOwnership\.third-party-embed,1/);
  assert.match(csv, /blockedByHumanVerification,0/);
  assert.match(csv, /byPour\.robust,1/);
  assert.match(csv, /byWcagVersion\.2\.0,2/);
  assert.match(csv, /byPage\.0\.url,http:\/\/localhost:3000\/settings/);
  assert.match(csv, /byPage\.0\.severityScore,5/);
  assert.match(findingsCsv, /fixSummary,fixSteps,documentation,frameworkExamples/);
  assert.match(findingsCsv, /ownership,ownershipSource,ownershipUrl,ownershipNote/);
  assert.match(findingsCsv, /Third-party embedded content,youtube\.com,https:\/\/www\.youtube\.com,Third-party embedded content\. Manual verification recommended\./);
  assert.match(findingsCsv, /Give every button an accessible name/);
  assert.match(findingsCsv, /Use visible button text when possible/);
  assert.match(findingsCsv, /react: <button type=""button"" aria-label=""Open menu"">/);
  assert.match(summaryCsv, /^generatedAt,framework,urls,standard,wcagVersion,wcagLevel,total,critical,warning,info,/);
  assert.match(summaryCsv, /react.*ada-title-ii.*2\.1,AA,2,1,1,0/);
  assert.match(summaryCsv, /thirdPartyEmbeddedFindings,humanVerificationBlocked/);
  assert.match(pagesCsv, /^url,total,critical,warning,info,severityScore/);
  assert.match(pagesCsv, /http:\/\/localhost:3000\/settings,1,1,0,0,5/);
  assert.match(rulesCsv, /^ruleId,highestSeverity,findings,occurrences,sources,findingTypes,categories,wcagCriteria,pages,fixSummary,documentation/);
  assert.match(rulesCsv, /button-name,critical,1,1,axe,wcag,aria/);
  assert.match(markdown, /Scan duration \| 123ms/);
  assert.match(markdown, /ADA Title II web accessibility support mode \(2\.1 AA\)/);
  assert.match(markdown, /## Evaluation Scope/);
  assert.match(markdown, /not a WCAG conformance claim/);
  assert.match(markdown, /evaluation-scope\.json/);
  assert.match(markdown, /Requested URLs \| http:\/\/localhost:3000/);
  assert.match(markdown, /Evidence collected \| browser exploration not included; axe, eslint; keyboard not included; Lighthouse comparison; manual checklist not included/);
  assert.match(markdown, /Compliance Note/);
  assert.match(markdown, /Compliance Evidence Summary/);
  assert.match(markdown, /WCAG-mapped findings \| 2/);
  assert.match(markdown, /Affected pages \| 2/);
  assert.match(markdown, /does not certify legal compliance/);
  assert.match(markdown, /Page Risk Ranking/);
  assert.match(markdown, /http:\/\/localhost:3000\/settings \| 1 \| 1 \| 0 \| 0 \| 5/);
  assert.match(markdown, /WCAG versions \| 2\.0: 2/);
  assert.match(markdown, /Confidence \| high: 1, medium: 1/);
  assert.match(markdown, /Color schemes \| dark: 1/);
  assert.match(markdown, /Categories \| aria: 1, images: 1/);
  assert.match(markdown, /Ownership \| third-party-embed: 1/);
  assert.match(markdown, /Human verification blockers \| 0/);
  assert.match(markdown, /category: aria confidence: high 95%/);
  assert.match(markdown, /ownership: Third-party embedded content source: youtube\.com note: Third-party embedded content\. Manual verification recommended\./);
  assert.match(markdown, /color scheme: dark/);
  assert.match(markdown, /WCAG 4\.1\.2 Name, Role, Value, Level A/);
  assert.match(markdown, /Fix: Give every button an accessible name/);
  assert.match(markdown, /name-role-value/);
  assert.match(markdown, /react example: `<button type="button" aria-label="Open menu">/);
});

test("writeReports hides auto-detected framework examples from dynamic findings", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-generic-example-"));

  await writeReports(outputDir, [{
    source: "axe",
    framework: "react",
    severity: "critical",
    ruleId: "button-name",
    wcag: ["4.1.2"],
    wcagCriteria: [],
    tags: [],
    selector: "button",
    message: "Buttons must have discernible text",
    remediation: {
      summary: "Give every button an accessible name.",
      howToFix: ["Use visible button text when possible."],
      docs: [],
      frameworkExamples: {
        react: "<button aria-label=\"Open menu\"><MenuIcon /></button>"
      }
    },
    fingerprint: "button-name::button",
    duplicateCount: 0
  }], {
    framework: "react"
  }, {
    formats: ["json", "markdown"]
  });

  const json = JSON.parse(await fs.readFile(path.join(outputDir, "a11y-report.json"), "utf8"));
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.equal(json.summary.framework, "react");
  assert.equal(json.issues[0].remediation.frameworkExamples, undefined);
  assert.doesNotMatch(markdown, /react example/i);
  assert.match(markdown, /Use visible button text when possible/);
});

test("findings CSV neutralizes spreadsheet formulas in report text", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-csv-safety-"));

  await writeReports(outputDir, [{
    source: "axe",
    severity: "warning",
    ruleId: "custom-rule",
    wcag: [],
    wcagCriteria: [],
    tags: [],
    selector: "@dangerous-cell",
    message: "=HYPERLINK(\"https://example.com\")"
  }], { framework: "unknown" });

  const findingsCsv = await fs.readFile(path.join(outputDir, "a11y-findings.csv"), "utf8");

  assert.match(findingsCsv, /'@dangerous-cell/);
  assert.match(findingsCsv, /'=HYPERLINK/);
});

test("writeReports supports a compact audit profile without legacy or duplicate CSV files", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-audit-profile-"));
  const manualChecklist: ManualChecklist = {
    generatedAt: "2026-06-21T00:00:00.000Z",
    framework: "react",
    urls: ["http://localhost:3000"],
    items: [{
      id: "manual-keyboard",
      title: "Complete the primary task with a keyboard",
      principle: "operable",
      wcag: ["2.1.1"],
      whyManual: "Task completion requires human judgment.",
      steps: ["Complete the primary task without a pointer."],
      evidence: ["Keyboard test notes"],
      review: {
        status: "not-reviewed",
        tester: "",
        testedAt: "",
        environment: "",
        notes: "",
        evidenceLinks: [],
        remediationOwner: ""
      }
    }]
  };

  await writeReports(outputDir, [], { framework: "react" }, {
    formats: ["json", "csv", "markdown"],
    legacyMetrics: false,
    keyboard: {
      url: "http://localhost:3000",
      generatedAt: "2026-06-21T00:00:00.000Z",
      durationMs: 100,
      maxTabs: 40,
      focusableCount: 3,
      completedCycle: true,
      steps: [],
      backwardSteps: [],
      reverseOrderMatches: true,
      activationEnabled: false,
      maxActivations: 0,
      activationAttempts: [],
      issues: []
    },
    manualChecklist
  });

  const json = JSON.parse(await fs.readFile(path.join(outputDir, "a11y-report.json"), "utf8"));
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");
  assert.equal(json.manualChecklist.framework, "react");
  assert.match(markdown, /## Keyboard Evidence/);
  assert.match(markdown, /## Manual Review Checklist/);
  assert.match(markdown, /## Audit Coverage/);
  assert.match(markdown, /Screen reader \| Human review required/);
  assert.match(markdown, /Dynamic announcements/);
  assert.match(markdown, /Form error states/);
  assert.match(markdown, /Image alternatives/);
  assert.match(markdown, /Media and motion/);
  assert.match(markdown, /Embedded content/);
  assert.match(markdown, /Complete the primary task with a keyboard/);
  assert.equal(await exists(path.join(outputDir, "a11y-summary.csv")), true);
  assert.equal(await exists(path.join(outputDir, "a11y-pages.csv")), true);
  assert.equal(await exists(path.join(outputDir, "a11y-rules.csv")), true);
  assert.equal(await exists(path.join(outputDir, "a11y-findings.csv")), true);
  assert.equal(await exists(path.join(outputDir, "a11y-metrics.csv")), false);
  assert.equal(await exists(path.join(outputDir, "a11y-remediation.csv")), false);
});

test("writeReports includes structured contrast evidence in JSON and Markdown", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-contrast-"));
  const contrast = {
    actualRatio: 2.32,
    requiredRatio: 4.5,
    foreground: "#aaaaaa",
    background: "#ffffff",
    fontSize: "12.0pt (16px)",
    fontWeight: "normal",
    suggestions: [
      { target: "foreground" as const, purpose: "minimum" as const, color: "#767676", contrastRatio: 4.54 },
      { target: "foreground" as const, purpose: "recommended" as const, color: "#6F6F6F", contrastRatio: 5.02 },
      { target: "foreground" as const, purpose: "enhanced" as const, color: "#595959", contrastRatio: 7 }
    ]
  };

  const report = await writeReports(outputDir, [{
    source: "axe",
    framework: "react",
    severity: "critical",
    ruleId: "color-contrast",
    wcag: ["1.4.3"],
    wcagCriteria: [],
    tags: [],
    selector: ".muted-copy",
    message: "Elements must meet minimum color contrast ratio thresholds",
    contrast
  }], { framework: "react" });
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.deepEqual(report.issues[0].contrast, contrast);
  assert.match(markdown, /Contrast: 2\.32:1; required: 4\.5:1/);
  assert.match(markdown, /Colors: text #aaaaaa; background #ffffff/);
  assert.match(markdown, /Suggested text colors on #ffffff/);
  assert.match(markdown, /minimum text #767676 \(4\.54:1\)/);
  assert.match(markdown, /recommended text #6F6F6F \(5\.02:1\)/);
});

test("writeReports summarizes rules without WCAG mappings", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-unmapped-"));

  const report = await writeReports(
    outputDir,
    [
      {
        source: "axe",
        severity: "warning",
        ruleId: "page-has-heading-one",
        wcag: [],
        wcagCriteria: [],
        tags: ["best-practice"],
        selector: "html",
        message: "Page should contain a level-one heading"
      },
      {
        source: "eslint",
        severity: "info",
        ruleId: "@angular-eslint/template/button-has-type",
        wcag: [],
        wcagCriteria: [],
        tags: [],
        file: "src/app/list/list.component.html",
        message: "Type for <button> is missing"
      }
    ],
    {
      framework: "angular",
      rawCount: 2,
      uniqueCount: 2,
      duplicateCount: 0
    }
  );

  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.deepEqual(report.summary.byUnmappedRule, {
    "page-has-heading-one": 1,
    "@angular-eslint/template/button-has-type": 1
  });
  assert.equal(report.summary.complianceEvidence.wcagMappedFindings, 0);
  assert.equal(report.summary.complianceEvidence.bestPracticeFindings, 1);
  assert.equal(report.summary.complianceEvidence.unmappedFindings, 1);
  assert.deepEqual(report.summary.byFindingType, {
    "best-practice": 1,
    unmapped: 1
  });
  assert.match(markdown, /Rules without WCAG mapping \| page-has-heading-one: 1/);
  assert.match(markdown, /Best-practice findings \| 1/);
  assert.match(markdown, /Unmapped findings \| 1/);
  assert.match(markdown, /type: best practice/);
  assert.match(markdown, /@angular-eslint\/template\/button-has-type: 1/);
});

test("writeReports adds fallback remediation to unknown findings", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-remediation-"));
  const report = await writeReports(outputDir, [{
    source: "axe",
    severity: "warning",
    ruleId: "custom-unmapped-rule",
    wcag: [],
    wcagCriteria: [],
    tags: [],
    selector: "#custom-control",
    helpUrl: "https://example.com/custom-rule",
    message: "Review this custom accessibility condition"
  }], { framework: "unknown" });
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.match(report.issues[0].remediation?.summary || "", /custom-unmapped-rule/);
  assert.deepEqual(report.issues[0].remediation?.docs, ["https://example.com/custom-rule"]);
  assert.match(markdown, /Step 1: Inspect the reported selector or source location/);
});

test("writeReports includes baseline comparison metadata", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-baseline-"));

  const report = await writeReports(
    outputDir,
    [
      {
        source: "axe",
        severity: "warning",
        ruleId: "button-name",
        wcag: [],
        wcagCriteria: [],
        tags: [],
        selector: "button",
        message: "Buttons must have discernible text",
        fingerprint: "button-name::selector=button::warning",
        duplicateCount: 0,
        baselineStatus: "new"
      }
    ],
    {
      framework: "react",
      rawCount: 1,
      uniqueCount: 1,
      duplicateCount: 0,
      baseline: {
        enabled: true,
        file: ".a11y-baseline.json",
        updated: false,
        baselineIssues: 4,
        currentIssues: 1,
        existingIssues: 0,
        newIssues: 1,
        resolvedIssues: 4,
        newCritical: 0,
        newWarning: 1,
        newInfo: 0
      }
    }
  );

  const csv = await fs.readFile(path.join(outputDir, "a11y-metrics.csv"), "utf8");
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.equal(report.summary.baseline.newIssues, 1);
  assert.match(csv, /baseline\.newIssues,1/);
  assert.match(csv, /baseline\.resolvedIssues,4/);
  assert.match(markdown, /Baseline file \| \.a11y-baseline\.json/);
  assert.match(markdown, /New findings \| 1/);
  assert.match(markdown, /baseline: new/);
});

test("writeReports includes retest comparison metadata", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-retest-"));

  const report = await writeReports(
    outputDir,
    [
      {
        source: "axe",
        severity: "warning",
        ruleId: "button-name",
        wcag: [],
        wcagCriteria: [],
        tags: [],
        selector: "button",
        message: "Buttons must have discernible text",
        fingerprint: "button-name::selector=button::warning",
        duplicateCount: 0,
        retestStatus: "new"
      }
    ],
    {
      framework: "react",
      rawCount: 1,
      uniqueCount: 1,
      duplicateCount: 0,
      retest: {
        enabled: true,
        file: "reports/before/a11y-report.json",
        previousIssues: 4,
        currentIssues: 1,
        remainingIssues: 0,
        newIssues: 1,
        fixedIssues: 4,
        newCritical: 0,
        newWarning: 1,
        newInfo: 0
      }
    }
  );

  const metricsCsv = await fs.readFile(path.join(outputDir, "a11y-metrics.csv"), "utf8");
  const findingsCsv = await fs.readFile(path.join(outputDir, "a11y-findings.csv"), "utf8");
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.equal(report.summary.retest?.fixedIssues, 4);
  assert.match(metricsCsv, /retest\.fixedIssues,4/);
  assert.match(findingsCsv, /retestStatus/);
  assert.match(findingsCsv, /new/);
  assert.match(markdown, /Fixed findings \| 4/);
  assert.match(markdown, /Remaining findings \| 0/);
  assert.match(markdown, /retest: new/);
});

test("writeReports includes remediation tracking without hiding findings", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-remediation-tracking-"));

  const report = await writeReports(
    outputDir,
    [
      {
        source: "axe",
        severity: "warning",
        ruleId: "button-name",
        wcag: [],
        wcagCriteria: [],
        tags: [],
        selector: "button",
        message: "Buttons must have discernible text",
        fingerprint: "button-name::selector=button::warning",
        duplicateCount: 0,
        remediationTracking: {
          fingerprint: "button-name::selector=button::warning",
          status: "in-progress",
          owner: "@frontend",
          reason: "Fix is assigned.",
          updatedAt: "2026-06-20",
          reviewBy: "2026-07-01"
        }
      }
    ],
    {
      framework: "react",
      remediationTracking: {
        enabled: true,
        file: "a11y-remediation.json",
        totalEntries: 2,
        validEntries: 2,
        invalidEntries: 0,
        matchedIssues: 1,
        staleEntries: 1,
        byStatus: { "in-progress": 1 }
      }
    }
  );

  const findingsCsv = await fs.readFile(path.join(outputDir, "a11y-findings.csv"), "utf8");
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.equal(report.summary.total, 1);
  assert.equal(report.summary.remediationTracking?.matchedIssues, 1);
  assert.match(findingsCsv, /remediationStatus/);
  assert.match(findingsCsv, /in-progress/);
  assert.match(markdown, /Tracked findings \| 1/);
  assert.match(markdown, /remediation: in-progress owner: @frontend review by: 2026-07-01/);
});

test("writeReports includes ignore metadata", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-ignore-"));

  const report = await writeReports(
    outputDir,
    [],
    {
      framework: "react",
      rawCount: 2,
      uniqueCount: 1,
      duplicateCount: 0,
      ignore: {
        enabled: true,
        file: "a11y-ignore.json",
        totalRules: 3,
        activeRules: 1,
        expiredRules: 1,
        invalidRules: 1,
        ignoredIssues: 1
      }
    }
  );

  const csv = await fs.readFile(path.join(outputDir, "a11y-metrics.csv"), "utf8");
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.equal(report.summary.ignore?.ignoredIssues, 1);
  assert.match(csv, /ignore\.ignoredIssues,1/);
  assert.match(csv, /ignore\.expiredRules,1/);
  assert.match(markdown, /Ignore file \| a11y-ignore\.json/);
  assert.match(markdown, /Ignored findings \| 1/);
  assert.match(markdown, /Invalid ignore rules \| 1/);
});

test("writeReports includes retention metadata", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-retention-"));
  const retentionSummary = {
    enabled: true,
    dryRun: true,
    rootDir: path.dirname(outputDir),
    currentOutputDir: outputDir,
    maxRuns: 5,
    maxAgeDays: 14,
    candidateRuns: 4,
    plannedDeletedRuns: 2,
    deletedRuns: 0,
    keptRuns: 2,
    plannedDeletedRunDirs: [path.join(path.dirname(outputDir), "old-run")],
    keptRunDirs: [path.join(path.dirname(outputDir), "fresh-run")]
  };

  const report = await writeReports(
    outputDir,
    [],
    {
      framework: "react",
      rawCount: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      retention: retentionSummary
    }
  );

  const csv = await fs.readFile(path.join(outputDir, "a11y-metrics.csv"), "utf8");
  const markdown = await fs.readFile(path.join(outputDir, "a11y-comment.md"), "utf8");

  assert.equal(report.summary.retention?.dryRun, true);
  assert.equal(report.summary.retention?.plannedDeletedRuns, 2);
  assert.equal(report.summary.retention?.deletedRuns, 0);
  assert.ok(report.summary.retention);
  assert.equal("rootDir" in report.summary.retention, false);
  assert.match(csv, /retention\.dryRun,true/);
  assert.match(csv, /retention\.plannedDeletedRuns,2/);
  assert.match(csv, /retention\.deletedRuns,0/);
  assert.match(csv, /retention\.keptRuns,2/);
  assert.doesNotMatch(csv, /rootDir/);
  assert.doesNotMatch(csv, /currentOutputDir/);
  assert.doesNotMatch(csv, /old-run/);
  assert.doesNotMatch(markdown, /old-run/);
  assert.match(markdown, /Retention mode \| dry-run preview/);
  assert.match(markdown, /Retention policy \| maxRuns 5, maxAgeDays 14/);
  assert.match(markdown, /Retention planned deleted runs \| 2/);
  assert.match(markdown, /Retention deleted runs \| 0/);
  assert.match(markdown, /Retention evidence \| dry-run/);
});

test("writeReports can limit output formats", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-format-"));

  await writeReports(
    outputDir,
    [],
    {
      rawCount: 0,
      uniqueCount: 0,
      duplicateCount: 0
    },
    {
      formats: ["json"]
    }
  );

  assert.equal(await exists(path.join(outputDir, "a11y-report.json")), true);
  assert.equal(await exists(path.join(outputDir, "a11y-metrics.csv")), false);
  assert.equal(await exists(path.join(outputDir, "a11y-findings.csv")), false);
  assert.equal(await exists(path.join(outputDir, "a11y-comment.md")), false);
});

test("writeReports can generate a semi-automated manual checklist", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "a11y-reports-semi-auto-"));

  await writeReports(
    outputDir,
    [],
    {
      framework: "react",
      urls: ["http://localhost:3000"],
      rawCount: 0,
      uniqueCount: 0,
      duplicateCount: 0
    },
    {
      formats: ["json"],
      semiAuto: true
    }
  );

  const checklist = await fs.readFile(
    path.join(outputDir, "a11y-manual-checklist.md"),
    "utf8"
  );
  const checklistJson = JSON.parse(await fs.readFile(
    path.join(outputDir, "a11y-manual-checklist.json"),
    "utf8"
  ));

  assert.match(checklist, /Semi-Automated Accessibility Review Checklist/);
  assert.match(checklist, /Framework: react/);
  assert.match(checklist, /Screen reader navigation and task smoke test/);
  assert.match(checklist, /Screen reader forms, dialogs, and dynamic updates/);
  assert.match(checklist, /Environment summary:/);
  assert.match(checklist, /Operating system:/);
  assert.match(checklist, /Assistive technology and version:/);
  assert.equal(checklistJson.items[0].review.status, "not-reviewed");
  assert.equal(checklistJson.items[0].review.environment, "");
  assert.equal(checklistJson.items[0].review.environmentDetails.viewportOrZoom, "");
  assert.equal(checklistJson.items[0].review.environmentDetails.colorMode, "");
});

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
