import type {
  DedupedIssue,
  LighthouseAuditResult,
  LighthouseComparisonRule,
  LighthouseComparisonSummary,
  Severity
} from "../types.js";

export function compareLighthouseWithFindings(
  issues: DedupedIssue[],
  lighthouse: LighthouseAuditResult[] | undefined
): LighthouseComparisonSummary | undefined {
  if (!lighthouse || lighthouse.length === 0) return undefined;

  const failedAudits = lighthouse.flatMap((result) => result.failedAudits);
  const failedAuditById = new Map(failedAudits.map((audit) => [audit.id, audit]));
  const pipelineRules = summarizePipelineRules(issues.filter((issue) => issue.source !== "lighthouse"));
  const matchingRuleIds = [...pipelineRules.keys()]
    .filter((ruleId) => failedAuditById.has(ruleId))
    .sort();

  return {
    matchingRuleIds,
    lighthouseOnlyAudits: [...failedAuditById.values()]
      .filter((audit) => !pipelineRules.has(audit.id))
      .sort((left, right) => left.id.localeCompare(right.id)),
    pipelineOnlyRules: [...pipelineRules.values()]
      .filter((rule) => !failedAuditById.has(rule.ruleId))
      .sort((left, right) => severityRank(right.highestSeverity) - severityRank(left.highestSeverity) || right.count - left.count || left.ruleId.localeCompare(right.ruleId))
  };
}

function summarizePipelineRules(issues: DedupedIssue[]): Map<string, LighthouseComparisonRule> {
  const rules = new Map<string, LighthouseComparisonRule>();

  for (const issue of issues) {
    const existing = rules.get(issue.ruleId);
    if (!existing) {
      rules.set(issue.ruleId, {
        ruleId: issue.ruleId,
        count: 1,
        sources: [issue.source],
        highestSeverity: issue.severity,
        findingType: issue.findingType,
        category: issue.category
      });
      continue;
    }

    existing.count += 1;
    existing.sources = [...new Set([...existing.sources, issue.source])].sort();
    if (severityRank(issue.severity) > severityRank(existing.highestSeverity)) {
      existing.highestSeverity = issue.severity;
    }
  }

  return rules;
}

function severityRank(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}
