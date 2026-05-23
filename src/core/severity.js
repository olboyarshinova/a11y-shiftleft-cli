const AXE_IMPACT_TO_SEVERITY = {
  critical: "critical",
  serious: "critical",
  moderate: "warning",
  minor: "info"
};

const CRITICAL_RULE_HINTS = [
  "color-contrast",
  "label",
  "aria-required",
  "keyboard",
  "focus",
  "name-role-value"
];

const WARNING_RULE_HINTS = [
  "alt",
  "heading",
  "landmark",
  "tabindex"
];

export function triageIssues(issues) {
  return issues.map((issue) => ({
    ...issue,
    severity: issue.severity || inferSeverity(issue)
  }));
}

function inferSeverity(issue) {
  if (issue.impact && AXE_IMPACT_TO_SEVERITY[issue.impact]) {
    return AXE_IMPACT_TO_SEVERITY[issue.impact];
  }

  const ruleId = issue.ruleId.toLowerCase();

  if (CRITICAL_RULE_HINTS.some((hint) => ruleId.includes(hint))) return "critical";
  if (WARNING_RULE_HINTS.some((hint) => ruleId.includes(hint))) return "warning";

  return "info";
}
