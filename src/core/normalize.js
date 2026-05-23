import { mapRuleToWcag } from "./wcagMap.js";

export function normalizeIssue(issue) {
  const wcag = issue.wcag?.length ? issue.wcag : mapRuleToWcag(issue.ruleId);

  return {
    source: issue.source || "unknown",
    framework: issue.framework || "unknown",
    ruleId: issue.ruleId || "unknown-rule",
    wcag,
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
