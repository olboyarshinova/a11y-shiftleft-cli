import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type { A11yReport, DedupedIssue, WcagCriterion } from "../types.js";

export type EvidenceExportFormat = "json" | "jsonl" | "jsonld";

export interface EvidenceExportRecord {
  id: string;
  fingerprint: string;
  ruleId: string;
  severity: string;
  findingType: string;
  category: string;
  source: string;
  url?: string;
  stateId?: string;
  selector?: string;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  duplicateCount: number;
  baselineStatus?: "new" | "existing";
  retestStatus?: "new" | "remaining";
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

export interface EvidenceExportProvenance {
  tool?: {
    name: string;
    version: string;
    nodeVersion: string;
  };
  command?: {
    name: string;
    profile: string;
  };
  requestedUrls: string[];
  includedUrls: string[];
  outputFormats: string[];
  browsers?: Array<{
    engine: string;
    name: string;
    version?: string;
    source: string;
  }>;
  automation?: {
    staticAnalysis: boolean;
    browserAutomation: boolean;
    keyboardTraversal: boolean;
    lighthouseComparison: boolean;
    manualChecklist: boolean;
  };
  limits?: {
    maxDepth?: number;
    maxStates?: number;
    maxTabs?: number;
  };
  standard?: {
    id: string;
    label: string;
    wcagVersion: string;
    wcagLevel: string;
    automatedCoverage: string;
    requiresManualReview: boolean;
  };
}

export interface EvidenceExport {
  version: 1;
  generatedAt: string;
  sourceReportGeneratedAt: string;
  localOnly: true;
  provenance: EvidenceExportProvenance;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    wcagMapped: number;
    needsReview: number;
    bestPractice: number;
    duplicateOccurrences: number;
    baselineNew: number;
    baselineExisting: number;
    retestNew: number;
    retestRemaining: number;
    bySource: Record<string, number>;
    byCategory: Record<string, number>;
    byConfidence: Record<string, number>;
    byFindingType: Record<string, number>;
    byUrl: Record<string, number>;
    byWcagCriterion: Record<string, number>;
    byWcagLevel: Record<string, number>;
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
    provenance: toEvidenceProvenance(report),
    summary: {
      total: records.length,
      critical: records.filter((record) => record.severity === "critical").length,
      warning: records.filter((record) => record.severity === "warning").length,
      info: records.filter((record) => record.severity === "info").length,
      wcagMapped: records.filter((record) => record.wcag.length > 0).length,
      needsReview: records.filter((record) => record.findingType === "needs-review").length,
      bestPractice: records.filter((record) => record.findingType === "best-practice").length,
      duplicateOccurrences: records.reduce((sum, record) => sum + Math.max(0, record.duplicateCount - 1), 0),
      baselineNew: records.filter((record) => record.baselineStatus === "new").length,
      baselineExisting: records.filter((record) => record.baselineStatus === "existing").length,
      retestNew: records.filter((record) => record.retestStatus === "new").length,
      retestRemaining: records.filter((record) => record.retestStatus === "remaining").length,
      bySource: countBy(records, (record) => record.source),
      byCategory: countBy(records, (record) => record.category),
      byConfidence: countBy(records, (record) => record.confidence?.level),
      byFindingType: countBy(records, (record) => record.findingType),
      byUrl: countBy(records, (record) => record.url),
      byWcagCriterion: countWcag(records, (criterion) => criterion.id),
      byWcagLevel: countWcag(records, (criterion) => criterion.level)
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
      provenance: evidence.provenance,
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
    "schema:identifier": `a11y-shiftleft-evidence-v${evidence.version}`,
    "schema:dateCreated": evidence.generatedAt,
    "a11y:sourceReportGeneratedAt": evidence.sourceReportGeneratedAt,
    "a11y:localOnly": evidence.localOnly,
    "a11y:provenance": evidence.provenance,
    "a11y:summary": evidence.summary,
    "earl:assertions": evidence.records.map((record) => ({
      "@id": `a11y:${record.id}`,
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
        "a11y:duplicateCount": record.duplicateCount,
        "a11y:baselineStatus": record.baselineStatus,
        "a11y:retestStatus": record.retestStatus,
        "a11y:confidence": record.confidence,
        "schema:description": record.message
      },
      "a11y:ownership": record.ownership,
      "a11y:remediation": record.remediation
    }))
  };
}

function toEvidenceProvenance(report: A11yReport): EvidenceExportProvenance {
  const trail = report.summary.auditTrail;
  const standard = report.summary.standard;

  return {
    tool: trail?.tool,
    command: trail?.command,
    requestedUrls: trail?.requestedUrls || report.summary.urls || [],
    includedUrls: trail?.includedUrls || report.summary.urls || [],
    outputFormats: trail?.outputFormats || [],
    browsers: trail?.browsers,
    automation: trail?.automation,
    limits: trail?.limits,
    standard: standard ? {
      id: standard.id,
      label: standard.label,
      wcagVersion: standard.wcagVersion,
      wcagLevel: standard.wcagLevel,
      automatedCoverage: standard.automatedCoverage,
      requiresManualReview: standard.requiresManualReview
    } : undefined
  };
}

function jsonLdOutcome(record: EvidenceExportRecord): string {
  if (record.findingType === "needs-review") return "earl:cantTell";
  return "earl:failed";
}

function toEvidenceRecord(issue: DedupedIssue): EvidenceExportRecord {
  return {
    id: stableEvidenceRecordId(issue),
    fingerprint: issue.fingerprint,
    ruleId: issue.ruleId,
    severity: issue.severity,
    findingType: issue.findingType,
    category: issue.category,
    source: issue.source,
    url: issue.url,
    stateId: issue.stateId,
    selector: issue.selector,
    file: issue.file,
    line: issue.line,
    column: issue.column,
    message: issue.message,
    duplicateCount: issue.duplicateCount,
    baselineStatus: issue.baselineStatus,
    retestStatus: issue.retestStatus,
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

function stableEvidenceRecordId(issue: DedupedIssue): string {
  return `finding-${createHash("sha256").update(issue.fingerprint).digest("hex").slice(0, 16)}`;
}

function countBy(records: EvidenceExportRecord[], getKey: (record: EvidenceExportRecord) => string | undefined): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    const key = getKey(record);
    if (!key) return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function countWcag(records: EvidenceExportRecord[], getKey: (criterion: EvidenceExportRecord["wcag"][number]) => string | undefined): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    for (const criterion of record.wcag) {
      const key = getKey(criterion);
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, {});
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
