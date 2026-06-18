import crypto from "node:crypto";
import type { DedupedIssue, RootCauseGroup, Severity } from "../types.js";

const SEMANTIC_STATE_CLASS = /^(is|has)-|selected|active|current|invalid|error|disabled|expanded|open/i;

export function summarizeRootCauses(issues: DedupedIssue[]): RootCauseGroup[] {
  const groups = new Map<string, RootCauseAccumulator>();

  for (const issue of issues) {
    const targetPattern = createTargetPattern(issue);
    const key = [issue.ruleId, issue.findingType, targetPattern].join("::");
    const group = groups.get(key) || {
      id: hash(key),
      ruleId: issue.ruleId,
      findingType: issue.findingType,
      severity: issue.severity,
      targetPattern,
      occurrenceCount: 0,
      affectedPages: new Set<string>(),
      affectedStates: new Set<string>(),
      affectedColorSchemes: new Set<NonNullable<DedupedIssue["colorScheme"]>>(),
      representativeSelector: issue.selector,
      representativeFile: issue.file
    };

    group.occurrenceCount += 1 + issue.duplicateCount;
    group.severity = higherSeverity(group.severity, issue.severity);
    if (issue.url) group.affectedPages.add(issue.url);
    if (issue.stateId) group.affectedStates.add(issue.stateId);
    if (issue.colorScheme) group.affectedColorSchemes.add(issue.colorScheme);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      affectedPages: [...group.affectedPages].sort(),
      affectedStates: [...group.affectedStates].sort(),
      affectedColorSchemes: [...group.affectedColorSchemes].sort()
    }))
    .sort((a, b) => {
      if (b.occurrenceCount !== a.occurrenceCount) {
        return b.occurrenceCount - a.occurrenceCount;
      }
      const severityDifference = severityWeight(b.severity) - severityWeight(a.severity);
      if (severityDifference !== 0) return severityDifference;
      return a.ruleId.localeCompare(b.ruleId);
    });
}

interface RootCauseAccumulator extends Omit<RootCauseGroup, "affectedPages" | "affectedStates" | "affectedColorSchemes"> {
  affectedPages: Set<string>;
  affectedStates: Set<string>;
  affectedColorSchemes: Set<NonNullable<DedupedIssue["colorScheme"]>>;
}

function createTargetPattern(issue: DedupedIssue): string {
  if (issue.selector) {
    const semanticClasses = extractClassNames(issue.selector)
      .filter((className) => SEMANTIC_STATE_CLASS.test(className));

    if (semanticClasses.length > 0) {
      return `state-class:${[...new Set(semanticClasses)].sort().join("+")}`;
    }

    return `selector:${normalizeSelector(issue.selector)}`;
  }

  if (issue.file) return `file:${issue.file}`;
  return issue.url ? "page-level" : "unknown-target";
}

function extractClassNames(selector: string): string[] {
  return [...selector.matchAll(/\.((?:\\.|[\w&-])+)/g)]
    .map((match) => match[1].replace(/\\(.)/g, "$1"));
}

function normalizeSelector(selector: string): string {
  return selector
    .replace(/:nth-(child|of-type)\(\d+\)/gi, "")
    .replace(/\[([\w:-]+)(?:[^\]]*)\]/g, "[$1]")
    .replace(/\s+/g, " ")
    .trim();
}

function higherSeverity(left: Severity, right: Severity): Severity {
  return severityWeight(right) > severityWeight(left) ? right : left;
}

function severityWeight(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function hash(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}
