import type { A11yReport, DedupedIssue, Severity } from "../types.js";
import type { AgentHistorySummary } from "./agentHistory.js";

export interface AgentReviewOptions {
  report: A11yReport;
  previousReport?: A11yReport;
  reportPath: string;
  previousReportPath?: string;
  previousReportSource?: "explicit" | "history";
  history?: AgentHistorySummary;
  dashboardHistory?: AgentDashboardHistorySummary;
  historyRoot?: string;
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

export interface AgentRiskFocusItem {
  id: string;
  label: string;
  count: number;
  action: string;
}

export interface AgentDashboardHistorySummary {
  totalRuns: number;
  latestRunId?: string;
  previousRunId?: string;
  totalChange?: number | null;
  criticalChange?: number | null;
  lighthouseScoreChange?: number | null;
  ruleRegressions: Array<{
    id: string;
    change: number;
  }>;
  ruleResolved: Array<{
    id: string;
    resolved: number;
  }>;
}

export interface AgentReview {
  reportPath: string;
  visualReportPath: string;
  previousReportPath?: string;
  previousReportSource?: "explicit" | "history";
  history?: AgentHistorySummary;
  dashboardHistory?: AgentDashboardHistorySummary;
  historyRoot?: string;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  changes: AgentReviewChangeSummary;
  riskFocus: AgentRiskFocusItem[];
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
  const changes = summarizeAgentChanges(options.previousReport, options.report);

  return {
    reportPath: options.reportPath,
    visualReportPath: visualReportPathFor(options.reportPath),
    previousReportPath: options.previousReportPath,
    previousReportSource: options.previousReportPath ? options.previousReportSource || "explicit" : undefined,
    history: options.history,
    dashboardHistory: options.dashboardHistory,
    historyRoot: options.historyRoot,
    summary: {
      total: options.report.summary.total,
      critical: options.report.summary.critical,
      warning: options.report.summary.warning,
      info: options.report.summary.info
    },
    changes,
    riskFocus: createRiskFocus(options.report, changes),
    focus,
    nextCommands: recommendAgentNextCommands(options.report, options.reportPath, Boolean(options.previousReport), options.historyRoot)
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

  if (review.history) {
    lines.push(formatHistorySummary(review.history));
    lines.push(...formatHistoryRuleChanges(review.history));
    lines.push(...formatHistoryPageChanges(review.history));
  }

  if (review.dashboardHistory) {
    lines.push(...formatDashboardHistorySummary(review.dashboardHistory));
  }

  if (review.riskFocus.length > 0) {
    lines.push("", "Review focus:");
    lines.push(...review.riskFocus.map((item) => `- ${item.label}: ${item.count} - ${item.action}`));
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

function createRiskFocus(report: A11yReport, changes: AgentReviewChangeSummary): AgentRiskFocusItem[] {
  const focus: AgentRiskFocusItem[] = [];
  const criticalCount = changes.enabled ? changes.newCritical : report.summary.critical;
  const keyboardCount = countKeyboardFindings(report);
  const needsReviewCount = report.issues.filter((issue) => issue.findingType === "needs-review").length;
  const thirdPartyCount = report.summary.byOwnership?.["third-party-embed"] ||
    report.issues.filter((issue) => issue.ownership?.kind === "third-party-embed").length;
  const humanVerificationCount = report.summary.blockedByHumanVerification || 0;
  const lighthouseFailedCount = report.summary.lighthouse?.failedAuditCount || 0;

  if (criticalCount > 0) {
    focus.push({
      id: "critical",
      label: changes.enabled ? "New critical findings" : "Critical findings",
      count: criticalCount,
      action: "fix before tightening CI gates or sharing the report"
    });
  }

  if (keyboardCount > 0) {
    focus.push({
      id: "keyboard-focus",
      label: "Keyboard and focus evidence",
      count: keyboardCount,
      action: "review the visual Keyboard Audit section and rerun with --activation when needed"
    });
  }

  if (needsReviewCount > 0) {
    focus.push({
      id: "needs-review",
      label: "Needs manual review",
      count: needsReviewCount,
      action: "complete the manual checklist before claiming the flow is clear"
    });
  }

  if (thirdPartyCount > 0) {
    focus.push({
      id: "third-party",
      label: "Third-party embedded content",
      count: thirdPartyCount,
      action: "separate vendor-owned issues from first-party fixes"
    });
  }

  if (humanVerificationCount > 0) {
    focus.push({
      id: "human-verification",
      label: "Human verification blocked states",
      count: humanVerificationCount,
      action: "rerun with --pause-on-human-verification or use a test environment"
    });
  }

  if (lighthouseFailedCount > 0) {
    focus.push({
      id: "lighthouse",
      label: "Lighthouse failed audits",
      count: lighthouseFailedCount,
      action: "compare Lighthouse suggestions with visual findings"
    });
  }

  return focus.slice(0, 5);
}

function countKeyboardFindings(report: A11yReport): number {
  return report.issues.filter((issue) => (
    issue.source === "keyboard" ||
    issue.category === "keyboard" ||
    issue.category === "focus"
  )).length;
}

function formatHistorySummary(history: AgentHistorySummary): string {
  return [
    `History: ${history.totalRuns} runs indexed`,
    `total ${formatSignedNumber(history.totalDeltaFromFirst)}`,
    `critical ${formatSignedNumber(history.criticalDeltaFromFirst)}`,
    `warning ${formatSignedNumber(history.warningDeltaFromFirst)}`,
    `info ${formatSignedNumber(history.infoDeltaFromFirst)}`
  ].join(" | ");
}

function formatHistoryRuleChanges(history: AgentHistorySummary): string[] {
  const lines: string[] = [];
  if (history.ruleRegressions.length > 0) {
    lines.push(`Rules increased: ${history.ruleRegressions.map(formatRuleChange).join("; ")}`);
  }

  if (history.ruleImprovements.length > 0) {
    lines.push(`Rules improved: ${history.ruleImprovements.map(formatRuleChange).join("; ")}`);
  }

  return lines;
}

function formatRuleChange(change: AgentHistorySummary["ruleRegressions"][number]): string {
  return `${change.ruleId} ${formatSignedNumber(change.change)} (${change.first} -> ${change.current})`;
}

function formatHistoryPageChanges(history: AgentHistorySummary): string[] {
  const lines: string[] = [];
  if (history.pageRegressions.length > 0) {
    lines.push(`Pages increased: ${history.pageRegressions.map(formatPageChange).join("; ")}`);
  }

  if (history.pageImprovements.length > 0) {
    lines.push(`Pages improved: ${history.pageImprovements.map(formatPageChange).join("; ")}`);
  }

  return lines;
}

function formatPageChange(change: AgentHistorySummary["pageRegressions"][number]): string {
  return `${compactUrl(change.url)} ${formatSignedNumber(change.change)} (${change.first} -> ${change.current})`;
}

function formatDashboardHistorySummary(history: AgentDashboardHistorySummary): string[] {
  const lines = [
    [
      `Dashboard history: ${history.totalRuns} runs`,
      history.previousRunId && history.latestRunId ? `${history.previousRunId} -> ${history.latestRunId}` : "",
      `total ${formatNullableSignedNumber(history.totalChange)}`,
      `critical ${formatNullableSignedNumber(history.criticalChange)}`,
      `Lighthouse ${formatNullableSignedNumber(history.lighthouseScoreChange)}`
    ].filter(Boolean).join(" | ")
  ];

  if (history.ruleRegressions.length > 0) {
    lines.push(`Dashboard rule regressions: ${history.ruleRegressions.map((item) => `${item.id} ${formatSignedNumber(item.change)}`).join("; ")}`);
  }

  if (history.ruleResolved.length > 0) {
    lines.push(`Dashboard rule resolved: ${history.ruleResolved.map((item) => `${item.id} -${item.resolved}`).join("; ")}`);
  }

  return lines;
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

function recommendAgentNextCommands(
  report: A11yReport,
  reportPath: string,
  hasPreviousReport: boolean,
  historyRoot: string | undefined
): string[] {
  const commands: string[] = [];
  const reportDir = reportDirectoryForCommand(reportPath);
  const reportJson = `${reportDir}/a11y-report.json`;
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

  commands.push(`Export grouped ticket drafts: npx a11y-shiftleft-cli ticket export --report ${commandPath(reportJson)} --tracker github --out ${commandPath(`${reportDir}/a11y-tickets.md`)}`);
  commands.push(`Refresh and package a local share copy: npx a11y-shiftleft-cli agent refresh-html --report ${commandPath(reportDir)} --share-out a11y-share --share-include-html`);

  const ignoreCleanupCommand = recommendedIgnoreCleanupCommand(report);
  if (ignoreCleanupCommand) {
    commands.push(ignoreCleanupCommand);
  }

  if (hasKeyboardFindings) {
    commands.push("Review the visual Keyboard Audit section; rerun with --activation if you need safe key-activation evidence.");
  }

  if (hasNeedsReview) {
    commands.push("Complete the manual review checklist in the visual report for needs-review items.");
  }

  if (!hasLighthouse) {
    commands.push("Optional comparison: npx a11y-shiftleft-cli audit --url <app-url> --out reports --with-lighthouse --open");
  }

  if (historyRoot) {
    commands.push(`Continue local history: npx a11y-shiftleft-cli agent run --url <app-url> --out ${historyRoot}/run-<date> --history ${historyRoot} --open`);
  } else if (!hasPreviousReport) {
    commands.push("Next time, compare progress with: npx a11y-shiftleft-cli agent review --report reports/a11y-report.json --previous <previous-report-dir>");
  }

  return commands;
}

function recommendedIgnoreCleanupCommand(report: A11yReport): string | null {
  const ignore = report.summary.ignore;
  if (!ignore?.enabled) return null;

  const needsCleanup = ignore.expiredRules > 0 || ignore.invalidRules > 0 || ignore.expiringSoonRules > 0;
  if (!needsCleanup) return null;

  return `Review stale ignore entries: npx a11y-shiftleft-cli ignore cleanup-plan${ignore.file && ignore.file !== "a11y-ignore.json" ? ` --ignore-file ${commandPath(ignore.file)}` : ""}`;
}

function visualReportPathFor(reportPath: string): string {
  return reportPath.endsWith("a11y-report.json")
    ? reportPath.replace(/a11y-report\.json$/u, "a11y-report.html")
    : "a11y-report.html";
}

function reportDirectoryForCommand(reportPath: string): string {
  if (reportPath.endsWith("a11y-report.json")) {
    const directory = reportPath.replace(/\/?a11y-report\.json$/u, "");
    return directory || ".";
  }

  return reportPath.replace(/\/$/u, "") || ".";
}

function commandPath(value: string): string {
  return /^[A-Za-z0-9_./:-]+$/u.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatNullableSignedNumber(value: number | null | undefined): string {
  return typeof value === "number" ? formatSignedNumber(value) : "n/a";
}

function compactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.pathname || "/"}${url.search}`;
  } catch {
    return value.length > 64 ? `${value.slice(0, 61)}...` : value;
  }
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
