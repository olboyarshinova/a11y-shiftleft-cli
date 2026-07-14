import fs from "node:fs/promises";
import type { A11yReport, DedupedIssue, WcagCriterion } from "../types.js";

export type EvidenceExportFormat = "json" | "jsonl";

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

  return `${JSON.stringify(evidence, null, 2)}\n`;
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
