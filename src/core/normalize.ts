import { getWcagCriteria, mapRuleToWcag, normalizeWcagReferences } from "./wcagMap.js";
import type { Issue, NormalizedIssue } from "../types.js";

export function normalizeIssue(issue: Issue): NormalizedIssue {
  const wcag = normalizeWcagReferences(issue.wcag?.length ? issue.wcag : mapRuleToWcag(issue.ruleId));
  const wcagCriteria = issue.wcagCriteria?.length ? issue.wcagCriteria : getWcagCriteria(wcag);

  return {
    source: issue.source || "unknown",
    framework: issue.framework || "unknown",
    ruleId: issue.ruleId || "unknown-rule",
    wcag,
    wcagCriteria,
    severity: issue.severity,
    impact: issue.impact,
    selector: issue.selector,
    file: issue.file,
    line: issue.line,
    column: issue.column,
    url: issue.url,
    message: issue.message || "Accessibility issue detected."
  };
}
