import { getWcagCriteria, mapRuleToWcag, normalizeWcagReferences } from "./wcagMap.js";
import { getRemediationHint } from "./remediation.js";
import type { Issue, NormalizedIssue } from "../types.js";

export function normalizeIssue(issue: Issue): NormalizedIssue {
  const wcag = normalizeWcagReferences(issue.wcag?.length ? issue.wcag : mapRuleToWcag(issue.ruleId));
  const wcagCriteria = issue.wcagCriteria?.length ? issue.wcagCriteria : getWcagCriteria(wcag);
  const ruleId = issue.ruleId || "unknown-rule";
  const framework = issue.framework || "unknown";

  return {
    source: issue.source || "unknown",
    framework,
    ruleId,
    wcag,
    wcagCriteria,
    tags: issue.tags || [],
    confidence: issue.confidence,
    confidenceScore: issue.confidenceScore,
    confidenceReason: issue.confidenceReason,
    category: issue.category,
    remediation: issue.remediation || getRemediationHint(ruleId, wcagCriteria, framework),
    severity: issue.severity,
    impact: issue.impact,
    selector: issue.selector,
    file: issue.file,
    line: issue.line,
    column: issue.column,
    url: issue.url,
    stateId: issue.stateId,
    stateLabel: issue.stateLabel,
    screenshot: issue.screenshot,
    message: issue.message || "Accessibility issue detected."
  };
}
