import { listWcagCriteria, matchesWcagVersion } from "./wcagMap.js";
import type {
  DedupedIssue,
  ExplorationGraph,
  KeyboardAuditResult,
  ManualChecklist,
  ReportAuditTrail,
  WcagCoverageCriterionSummary,
  WcagCoverageStatus,
  WcagCoverageSummary,
  WcagLevel,
  WcagVersion
} from "../types.js";

interface WcagCoverageOptions {
  issues: DedupedIssue[];
  targetVersion?: WcagVersion;
  targetLevel?: WcagLevel;
  auditTrail?: ReportAuditTrail;
  exploration?: ExplorationGraph;
  keyboard?: KeyboardAuditResult;
  manualChecklist?: ManualChecklist;
}

const LEVEL_RANK: Record<WcagLevel, number> = {
  A: 1,
  AA: 2,
  AAA: 3
};

const BROWSER_AUTOMATION_CRITERIA = [
  "1.1.1",
  "1.3.1",
  "1.3.4",
  "1.3.5",
  "1.4.1",
  "1.4.2",
  "1.4.3",
  "1.4.4",
  "2.2.1",
  "2.2.2",
  "2.4.1",
  "2.4.2",
  "2.4.4",
  "2.5.3",
  "3.1.1",
  "3.1.2",
  "4.1.2"
];

const STATIC_SOURCE_CRITERIA = [
  "1.1.1",
  "1.3.1",
  "2.1.1",
  "2.4.3",
  "3.3.2",
  "4.1.2"
];

const KEYBOARD_CRITERIA = [
  "2.1.1",
  "2.1.2",
  "2.4.3",
  "2.4.7",
  "2.4.11"
];

export function summarizeWcagCoverage(options: WcagCoverageOptions): WcagCoverageSummary {
  const targetVersion = options.targetVersion || "2.2";
  const targetLevel = options.targetLevel || "AA";
  const targetCriteria = listWcagCriteria()
    .filter((criterion) => matchesWcagVersion(criterion, targetVersion))
    .filter((criterion) => LEVEL_RANK[criterion.level] <= LEVEL_RANK[targetLevel]);
  const findingCounts = countFindingsByCriterion(options.issues);
  const automatedEvidence = collectAutomatedEvidence(options);
  const heuristicEvidence = collectHeuristicEvidence(options);
  const manualEvidence = collectManualEvidence(options);
  const criteria = targetCriteria.map((criterion): WcagCoverageCriterionSummary => {
    const id = criterion.id;
    const automated = automatedEvidence.get(id) || [];
    const heuristic = heuristicEvidence.get(id) || [];
    const manual = manualEvidence.get(id) || [];
    const status = coverageStatus(automated, heuristic, manual);

    return {
      id,
      title: criterion.title,
      level: criterion.level,
      principle: criterion.principle,
      url: criterion.url,
      status,
      evidenceSources: [...new Set([...automated, ...heuristic, ...manual])],
      findingCount: findingCounts.get(id) || 0,
      nextStep: nextStepForStatus(status)
    };
  });
  const automatedCriteria = criteria.filter((criterion) => criterion.status === "automated").length;
  const heuristicCriteria = criteria.filter((criterion) => criterion.status === "heuristic").length;
  const manualCriteria = criteria.filter((criterion) => criterion.status === "manual-required").length;
  const notCoveredCriteria = criteria.filter((criterion) => criterion.status === "not-covered").length;
  const totalCriteria = criteria.length;

  return {
    label: "Tracked WCAG evidence coverage",
    targetVersion,
    targetLevel,
    totalCriteria,
    automatedCriteria,
    heuristicCriteria,
    manualCriteria,
    notCoveredCriteria,
    automatedCoverage: percentage(automatedCriteria, totalCriteria),
    assistedCoverage: percentage(automatedCriteria + heuristicCriteria + manualCriteria, totalCriteria),
    criteria
  };
}

function collectAutomatedEvidence(options: WcagCoverageOptions): Map<string, string[]> {
  const evidence = new Map<string, string[]>();

  if (options.auditTrail?.automation.browserAutomation) {
    addEvidence(evidence, BROWSER_AUTOMATION_CRITERIA, "browser automation");
  }

  if (options.auditTrail?.automation.staticAnalysis) {
    addEvidence(evidence, STATIC_SOURCE_CRITERIA, "static source analysis");
  }

  if (options.keyboard || options.auditTrail?.automation.keyboardTraversal) {
    addEvidence(evidence, KEYBOARD_CRITERIA, "keyboard traversal");
  }

  for (const issue of options.issues) {
    const source = issue.source || "";
    if (!["axe", "eslint", "keyboard"].includes(source)) continue;
    addEvidence(evidence, issue.wcagCriteria.map((criterion) => criterion.id), source);
  }

  return evidence;
}

function collectHeuristicEvidence(options: WcagCoverageOptions): Map<string, string[]> {
  const evidence = new Map<string, string[]>();
  const states = options.exploration?.states || [];

  if (states.some((state) => state.reflow)) addEvidence(evidence, ["1.4.10"], "400% reflow heuristic");
  if (states.some((state) => state.forcedColors)) {
    addEvidence(evidence, ["1.4.1", "1.4.11", "2.4.7", "2.4.11"], "forced-colors heuristic");
  }
  if (states.some((state) => state.modalFocus)) {
    addEvidence(evidence, ["2.4.3", "4.1.2"], "modal focus heuristic");
  }
  if (states.some((state) => state.dynamicAnnouncements)) {
    addEvidence(evidence, ["4.1.3"], "dynamic announcement heuristic");
  }
  if (states.some((state) => state.formErrors)) {
    addEvidence(evidence, ["3.3.1", "3.3.2"], "form error-state heuristic");
  }
  if (states.some((state) => state.imageAlternatives)) {
    addEvidence(evidence, ["1.1.1"], "image alternative heuristic");
  }
  if (states.some((state) => state.media)) {
    addEvidence(evidence, ["1.2.1", "1.2.2", "1.4.2", "2.2.2"], "media and motion heuristic");
  }
  if (states.some((state) => state.embeddedContent)) {
    addEvidence(evidence, ["1.1.1", "4.1.2"], "embedded content heuristic");
  }

  for (const issue of options.issues) {
    const source = issue.source || "";
    if (["axe", "eslint", "keyboard"].includes(source)) continue;
    addEvidence(evidence, issue.wcagCriteria.map((criterion) => criterion.id), source);
  }

  return evidence;
}

function collectManualEvidence(options: WcagCoverageOptions): Map<string, string[]> {
  const evidence = new Map<string, string[]>();

  for (const item of options.manualChecklist?.items || []) {
    addEvidence(evidence, item.wcag, "manual checklist");
  }

  return evidence;
}

function countFindingsByCriterion(issues: DedupedIssue[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const issue of issues) {
    for (const criterion of issue.wcagCriteria || []) {
      counts.set(criterion.id, (counts.get(criterion.id) || 0) + 1);
    }
  }

  return counts;
}

function coverageStatus(
  automated: string[],
  heuristic: string[],
  manual: string[]
): WcagCoverageStatus {
  if (automated.length > 0) return "automated";
  if (heuristic.length > 0) return "heuristic";
  if (manual.length > 0) return "manual-required";
  return "not-covered";
}

function addEvidence(target: Map<string, string[]>, criteria: string[], source: string): void {
  for (const criterion of criteria) {
    const sources = target.get(criterion) || [];
    if (!sources.includes(source)) sources.push(source);
    target.set(criterion, sources);
  }
}

function nextStepForStatus(status: WcagCoverageStatus): string {
  if (status === "automated") return "Review findings and confirm representative states.";
  if (status === "heuristic") return "Review heuristic evidence and confirm manually.";
  if (status === "manual-required") return "Complete the manual checklist item.";
  return "Add automated evidence or record manual review.";
}

function percentage(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}
