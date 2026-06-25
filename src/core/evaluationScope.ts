import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { A11yReport, ComplianceStandardMetadata, ExplorationGraph, Framework } from "../types.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

export interface EvaluationScopeManifest {
  version: 1;
  generatedAt: string;
  methodology: {
    name: "WCAG-EM-inspired evaluation scope";
    conformanceClaim: false;
    note: string;
  };
  tool: {
    name: "a11y-shiftleft-cli";
    version: string;
    nodeVersion: string;
  };
  target: {
    standard?: Pick<ComplianceStandardMetadata, "id" | "label" | "wcagVersion" | "wcagLevel" | "automatedCoverage" | "requiresManualReview">;
    framework: Framework | string;
    urlsRequested: string[];
  };
  sample: {
    strategy: "configured-urls" | "browser-exploration" | "static-source";
    includedUrls: string[];
    discoveredUrls: string[];
    statesVisited: number;
    maxDepth?: number;
    maxStates?: number;
    representativeStates: Array<{
      id: string;
      label: string;
      url: string;
      depth?: number;
      title?: string;
      findingCount: number;
    }>;
  };
  evidence: {
    automatedSources: string[];
    visualExploration: boolean;
    keyboardTraversal: boolean;
    lighthouseComparison: boolean;
    manualChecklist: boolean;
  };
  reviewStatus: {
    automatedFindings: number;
    manualReviewItems: number;
    manualReviewCompleted: number;
    needsHumanEvaluation: true;
  };
  limitations: string[];
}

export function createEvaluationScopeManifest(report: A11yReport): EvaluationScopeManifest {
  const graph = report.exploration;
  const requestedUrls = report.summary.urls || [];
  const discoveredUrls = graph
    ? unique(graph.states.map((state) => state.url))
    : requestedUrls;
  const manualItems = report.manualChecklist?.items || [];
  const standard = report.summary.standard;

  return {
    version: 1,
    generatedAt: report.generatedAt,
    methodology: {
      name: "WCAG-EM-inspired evaluation scope",
      conformanceClaim: false,
      note: "This manifest records what was included in the automated and assisted review. It is evidence for reproducibility, not a WCAG conformance statement."
    },
    tool: {
      name: "a11y-shiftleft-cli",
      version,
      nodeVersion: process.version
    },
    target: {
      ...(standard ? { standard: toStandardScope(standard) } : {}),
      framework: report.summary.framework,
      urlsRequested: requestedUrls
    },
    sample: {
      strategy: sampleStrategy(graph, requestedUrls),
      includedUrls: discoveredUrls,
      discoveredUrls,
      statesVisited: graph?.summary.statesVisited || 0,
      ...(graph ? {
        maxDepth: graph.summary.maxDepth,
        maxStates: graph.summary.maxStates
      } : {}),
      representativeStates: representativeStates(graph, report)
    },
    evidence: {
      automatedSources: Object.keys(report.summary.bySource || {}).sort(),
      visualExploration: Boolean(graph),
      keyboardTraversal: Boolean(report.keyboard),
      lighthouseComparison: Boolean(report.lighthouse?.length),
      manualChecklist: Boolean(report.manualChecklist)
    },
    reviewStatus: {
      automatedFindings: report.issues.length,
      manualReviewItems: manualItems.length,
      manualReviewCompleted: manualItems.filter((item) => item.review.status === "pass" || item.review.status === "fail" || item.review.status === "not-applicable").length,
      needsHumanEvaluation: true
    },
    limitations: [
      "Automated findings do not prove full WCAG conformance.",
      "Manual review is required for criteria involving meaning, task completion, assistive-technology announcements, media quality, cognitive clarity, and product-specific context.",
      "Only configured URLs and safely discovered same-origin states are included.",
      "Destructive, account, payment, permission, cookie-changing, upload, camera, and microphone actions are blocked or skipped by default."
    ]
  };
}

export async function writeEvaluationScopeManifest(outputDir: string, report: A11yReport): Promise<string> {
  const filePath = path.join(outputDir, "evaluation-scope.json");
  await fs.writeFile(filePath, `${JSON.stringify(createEvaluationScopeManifest(report), null, 2)}\n`);
  return filePath;
}

function toStandardScope(standard: ComplianceStandardMetadata): EvaluationScopeManifest["target"]["standard"] {
  return {
    id: standard.id,
    label: standard.label,
    wcagVersion: standard.wcagVersion,
    wcagLevel: standard.wcagLevel,
    automatedCoverage: standard.automatedCoverage,
    requiresManualReview: standard.requiresManualReview
  };
}

function sampleStrategy(graph: ExplorationGraph | undefined, requestedUrls: string[]): EvaluationScopeManifest["sample"]["strategy"] {
  if (graph) return "browser-exploration";
  return requestedUrls.length > 0 ? "configured-urls" : "static-source";
}

function representativeStates(graph: ExplorationGraph | undefined, report: A11yReport): EvaluationScopeManifest["sample"]["representativeStates"] {
  if (!graph) return [];
  const issueCountByState = new Map<string, number>();
  for (const issue of report.issues) {
    if (!issue.stateId) continue;
    issueCountByState.set(issue.stateId, (issueCountByState.get(issue.stateId) || 0) + 1);
  }

  return [...graph.states]
    .sort((left, right) => (issueCountByState.get(right.id) || 0) - (issueCountByState.get(left.id) || 0))
    .slice(0, 10)
    .map((state) => ({
      id: state.id,
      label: state.actionLabel,
      url: state.url,
      depth: state.depth,
      title: state.title,
      findingCount: issueCountByState.get(state.id) || 0
    }));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
