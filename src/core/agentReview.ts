import type { A11yReport, DedupedIssue, Severity } from "../types.js";

export interface AgentReviewOptions {
  report: A11yReport;
  previousReport?: A11yReport;
  reportPath: string;
  previousReportPath?: string;
  previousReportSource?: "explicit" | "history";
  maxItems?: number;
}

export interface AgentReviewChangeSummary {
  enabled: boolean;
  previousIssues: number;
  currentIssues: number;
  fixedIssues: number;
  newIssues: number;
  remainingIssues: number;
  newCritical: number;
  newWarning: number;
  newInfo: number;
}

export interface AgentReview {
  reportPath: string;
  visualReportPath: string;
  previousReportPath?: string;
  previousReportSource?: "explicit" | "history";
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  changes: AgentReviewChangeSummary;
  focus: DedupedIssue[];
  nextCommands: string[];
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2
};

export function createAgentReview(options: AgentReviewOptions): AgentReview {
  const maxItems = options.maxItems && options.maxItems > 0 ? options.maxItems : 5;
  const focus = [...options.report.issues]
    .sort(compareAgentFocusIssues)
    .slice(0, maxItems);

  return {
    reportPath: options.reportPath,
    visualReportPath: visualReportPathFor(options.reportPath),
    previousReportPath: options.previousReportPath,
    previousReportSource: options.previousReportPath ? options.previousReportSource || "explicit" : undefined,
    summary: {
      total: options.report.summary.total,
      critical: options.report.summary.critical,
      warning: options.report.summary.warning,
      info: options.report.summary.info
    },
    changes: summarizeAgentChanges(options.previousReport, options.report),
    focus,
    nextCommands: recommendAgentNextCommands(options.report, Boolean(options.previousReport))
  };
}

export function formatAgentReview(review: AgentReview): string {
  const lines = [
    "a11y-shiftleft agent review",
    `Report: ${review.reportPath}`,
    `Visual report: ${review.visualReportPath}`,
    `Findings: total ${review.summary.total} | critical ${review.summary.critical} | warning ${review.summary.warning} | info ${review.summary.info}`
  ];

  if (review.changes.enabled) {
    lines.push(
      `Compared with${review.previousReportSource ? ` (${review.previousReportSource})` : ""}: ${review.previousReportPath || "previous report"}`,
      `Change: fixed ${review.changes.fixedIssues}, new ${review.changes.newIssues}, remaining ${review.changes.remainingIssues}`,
      `New by severity: critical ${review.changes.newCritical}, warning ${review.changes.newWarning}, info ${review.changes.newInfo}`
    );
  } else {
    lines.push("Change: no previous report provided");
  }

  if (review.focus.length > 0) {
    lines.push("", "Fix first:");
    lines.push(...review.focus.map((issue, index) => formatFocusIssue(issue, index + 1)));
  } else {
    lines.push("", "Fix first: no automated findings in this report");
  }

  lines.push("", "Suggested next commands:");
  lines.push(...review.nextCommands.map((command) => `- ${command}`));

  return `${lines.join("\n")}\n`;
}

function summarizeAgentChanges(previousReport: A11yReport | undefined, currentReport: A11yReport): AgentReviewChangeSummary {
  if (!previousReport) {
    return {
      enabled: false,
      previousIssues: 0,
      currentIssues: currentReport.issues.length,
      fixedIssues: 0,
      newIssues: 0,
      remainingIssues: currentReport.issues.length,
      newCritical: 0,
      newWarning: 0,
      newInfo: 0
    };
  }

  const previousFingerprints = new Set(previousReport.issues.map((issue) => issue.fingerprint));
  const currentFingerprints = new Set(currentReport.issues.map((issue) => issue.fingerprint));
  const newIssues = currentReport.issues.filter((issue) => !previousFingerprints.has(issue.fingerprint));

  return {
    enabled: true,
    previousIssues: previousReport.issues.length,
    currentIssues: currentReport.issues.length,
    fixedIssues: previousReport.issues.filter((issue) => !currentFingerprints.has(issue.fingerprint)).length,
    newIssues: newIssues.length,
    remainingIssues: currentReport.issues.filter((issue) => previousFingerprints.has(issue.fingerprint)).length,
    newCritical: newIssues.filter((issue) => issue.severity === "critical").length,
    newWarning: newIssues.filter((issue) => issue.severity === "warning").length,
    newInfo: newIssues.filter((issue) => issue.severity === "info").length
  };
}

function recommendAgentNextCommands(report: A11yReport, hasPreviousReport: boolean): string[] {
  const commands: string[] = [];
  const hasCritical = report.summary.critical > 0;
  const hasWarnings = report.summary.warning > 0;
  const hasNeedsReview = report.issues.some((issue) => issue.findingType === "needs-review");
  const hasKeyboardFindings = Boolean(report.keyboard) ||
    report.issues.some((issue) => issue.source === "keyboard" || issue.category === "keyboard" || issue.category === "focus");
  const hasLighthouse = Array.isArray(report.lighthouse) && report.lighthouse.length > 0;

  if (hasCritical) {
    commands.push("Fix critical findings first, then rerun: npx a11y-shiftleft-cli audit --url <app-url> --out reports --open");
  } else if (hasWarnings) {
    commands.push("Review warnings and needs-review items, then rerun the same audit command.");
  } else {
    commands.push("Run a manual screen-reader and task review before treating the page as complete.");
  }

  commands.push("Export grouped ticket drafts: npx a11y-shiftleft-cli ticket export --report reports/a11y-report.json --tracker github");

  if (hasKeyboardFindings) {
    commands.push("Review the visual Keyboard Audit section; rerun with --activation if you need safe key-activation evidence.");
  }

  if (hasNeedsReview) {
    commands.push("Complete the manual review checklist in the visual report for needs-review items.");
  }

  if (!hasLighthouse) {
    commands.push("Optional comparison: npx a11y-shiftleft-cli audit --url <app-url> --out reports --with-lighthouse --open");
  }

  if (!hasPreviousReport) {
    commands.push("Next time, compare progress with: npx a11y-shiftleft-cli agent review --report reports/a11y-report.json --previous <previous-report-dir>");
  }

  return commands;
}

function visualReportPathFor(reportPath: string): string {
  return reportPath.endsWith("a11y-report.json")
    ? reportPath.replace(/a11y-report\.json$/u, "a11y-report.html")
    : "a11y-report.html";
}

function formatFocusIssue(issue: DedupedIssue, index: number): string {
  const wcag = issue.wcagCriteria[0]
    ? ` | WCAG ${issue.wcagCriteria[0].id} ${issue.wcagCriteria[0].title || ""}`.trimEnd()
    : "";
  const target = issue.selector || issue.file || issue.url || "reported target";

  return `${index}. ${issue.severity} ${issue.ruleId}${wcag} - ${issue.message} (${target})`;
}

function compareAgentFocusIssues(left: DedupedIssue, right: DedupedIssue): number {
  const severity = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
  if (severity !== 0) return severity;

  const leftWcag = left.findingType === "wcag" ? 0 : 1;
  const rightWcag = right.findingType === "wcag" ? 0 : 1;
  if (leftWcag !== rightWcag) return leftWcag - rightWcag;

  return left.ruleId.localeCompare(right.ruleId);
}
