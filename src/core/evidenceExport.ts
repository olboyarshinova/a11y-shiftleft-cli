import fs from "node:fs/promises";
import type { A11yReport, DedupedIssue, WcagCriterion } from "../types.js";

export type EvidenceExportFormat = "json" | "jsonl" | "jsonld";

export interface EvidenceExportRecord {
  fingerprint: string;
  ruleId: string;
  severity: string;
  findingType: string;
  source: string;
  url?: string;
  stateId?: string;
  selector?: string;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  wcag: Array<{
    id: string;
    title?: string;
    level?: string;
    principle?: string;
    url?: string;
  }>;
  ownership?: {
    kind: string;
    label: string;
    source?: string;
  };
  confidence?: {
    level?: string;
    score?: number;
    reason?: string;
  };
  remediation?: {
    summary?: string;
    howToFix: string[];
    docs: string[];
  };
}

export interface EvidenceExport {
  version: 1;
  generatedAt: string;
  sourceReportGeneratedAt: string;
  localOnly: true;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    wcagMapped: number;
    needsReview: number;
    bestPractice: number;
  };
  records: EvidenceExportRecord[];
}

export async function readA11yReport(reportPath: string): Promise<A11yReport> {
  const parsed = JSON.parse(await fs.readFile(reportPath, "utf8")) as Partial<A11yReport>;
  if (!parsed.generatedAt || !parsed.summary || !Array.isArray(parsed.issues)) {
    throw new Error(`Invalid accessibility report: ${reportPath}`);
  }
  return parsed as A11yReport;
}

export function createEvidenceExport(report: A11yReport, generatedAt = new Date().toISOString()): EvidenceExport {
  const records = report.issues.map(toEvidenceRecord);

  return {
    version: 1,
    generatedAt,
    sourceReportGeneratedAt: report.generatedAt,
    localOnly: true,
    summary: {
      total: records.length,
      critical: records.filter((record) => record.severity === "critical").length,
      warning: records.filter((record) => record.severity === "warning").length,
      info: records.filter((record) => record.severity === "info").length,
      wcagMapped: records.filter((record) => record.wcag.length > 0).length,
      needsReview: records.filter((record) => record.findingType === "needs-review").length,
      bestPractice: records.filter((record) => record.findingType === "best-practice").length
    },
    records
  };
}

export function serializeEvidenceExport(evidence: EvidenceExport, format: EvidenceExportFormat): string {
  if (format === "jsonl") {
    return `${evidence.records.map((record) => JSON.stringify({
      generatedAt: evidence.generatedAt,
      sourceReportGeneratedAt: evidence.sourceReportGeneratedAt,
      localOnly: evidence.localOnly,
      ...record
    })).join("\n")}\n`;
  }

  if (format === "jsonld") {
    return `${JSON.stringify(toJsonLdEvidenceExport(evidence), null, 2)}\n`;
  }

  return `${JSON.stringify(evidence, null, 2)}\n`;
}

function toJsonLdEvidenceExport(evidence: EvidenceExport) {
  return {
    "@context": {
      "schema": "https://schema.org/",
      "earl": "https://www.w3.org/ns/earl#",
      "wcag": "https://www.w3.org/WAI/WCAG22/Understanding/",
      "a11y": "https://github.com/olboyarshinova/a11y-shiftleft-cli#"
    },
    "@type": "schema:Dataset",
    "schema:name": "a11y-shiftleft accessibility evidence export",
    "schema:dateCreated": evidence.generatedAt,
    "a11y:sourceReportGeneratedAt": evidence.sourceReportGeneratedAt,
    "a11y:localOnly": evidence.localOnly,
    "a11y:summary": evidence.summary,
    "earl:assertions": evidence.records.map((record) => ({
      "@type": "earl:Assertion",
      "a11y:fingerprint": record.fingerprint,
      "earl:assertedBy": {
        "@type": "earl:Software",
        "schema:name": "a11y-shiftleft-cli"
      },
      "earl:subject": {
        "@type": "schema:WebPageElement",
        "schema:url": record.url,
        "a11y:stateId": record.stateId,
        "a11y:selector": record.selector,
        "a11y:file": record.file,
        "a11y:line": record.line,
        "a11y:column": record.column
      },
      "earl:test": {
        "@type": "earl:TestCase",
        "schema:identifier": record.ruleId,
        "schema:name": record.ruleId,
        "a11y:wcag": record.wcag.map((criterion) => ({
          "@type": "a11y:WcagCriterion",
          "schema:identifier": criterion.id,
          "schema:name": criterion.title,
          "a11y:level": criterion.level,
          "a11y:principle": criterion.principle,
          "schema:url": criterion.url
        }))
      },
      "earl:result": {
        "@type": "earl:TestResult",
        "earl:outcome": jsonLdOutcome(record),
        "a11y:severity": record.severity,
        "a11y:findingType": record.findingType,
        "a11y:confidence": record.confidence,
        "schema:description": record.message
      },
      "a11y:ownership": record.ownership,
      "a11y:remediation": record.remediation
    }))
  };
}

function jsonLdOutcome(record: EvidenceExportRecord): string {
  if (record.findingType === "needs-review") return "earl:cantTell";
  return "earl:failed";
}

function toEvidenceRecord(issue: DedupedIssue): EvidenceExportRecord {
  return {
    fingerprint: issue.fingerprint,
    ruleId: issue.ruleId,
    severity: issue.severity,
    findingType: issue.findingType,
    source: issue.source,
    url: issue.url,
    stateId: issue.stateId,
    selector: issue.selector,
    file: issue.file,
    line: issue.line,
    column: issue.column,
    message: issue.message,
    wcag: issue.wcagCriteria.length > 0
      ? issue.wcagCriteria.map(toWcagEvidence)
      : issue.wcag.map((id) => ({ id })),
    ownership: issue.ownership ? {
      kind: issue.ownership.kind,
      label: issue.ownership.label,
      source: issue.ownership.source
    } : undefined,
    confidence: issue.confidence || Number.isFinite(issue.confidenceScore) || issue.confidenceReason
      ? {
        level: issue.confidence,
        score: Number.isFinite(issue.confidenceScore) ? issue.confidenceScore : undefined,
        reason: issue.confidenceReason
      }
      : undefined,
    remediation: issue.remediation ? {
      summary: issue.remediation.summary,
      howToFix: issue.remediation.howToFix,
      docs: issue.remediation.docs
    } : undefined
  };
}

function toWcagEvidence(criterion: WcagCriterion): EvidenceExportRecord["wcag"][number] {
  return {
    id: criterion.id,
    title: criterion.title,
    level: criterion.level,
    principle: criterion.principle,
    url: criterion.url
  };
}
