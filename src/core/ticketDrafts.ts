import type { A11yReport, DedupedIssue, Severity } from "../types.js";

export type TicketTracker = "generic" | "jira" | "linear";

export type TicketFormat = "markdown" | "json";

export interface TicketDraftOptions {
  tracker?: TicketTracker;
  minSeverity?: Severity;
  maxTickets?: number;
}

export interface TicketDraft {
  id: string;
  title: string;
  tracker: TicketTracker;
  severity: Severity;
  ruleId: string;
  category: string;
  page: string;
  target: string;
  count: number;
  wcag: string[];
  confidence: string;
  labels: string[];
  body: string;
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1
};

export function createTicketDrafts(
  report: A11yReport,
  options: TicketDraftOptions = {}
): TicketDraft[] {
  const tracker = options.tracker || "generic";
  const minSeverity = options.minSeverity || "warning";
  const groups = new Map<string, DedupedIssue[]>();

  for (const issue of report.issues) {
    if (SEVERITY_RANK[issue.severity] < SEVERITY_RANK[minSeverity]) continue;

    const key = [
      issue.severity,
      issue.ruleId,
      issuePage(issue),
      issueTarget(issue)
    ].join("|");
    groups.set(key, [...(groups.get(key) || []), issue]);
  }

  const drafts = [...groups.values()]
    .map((issues, index) => toTicketDraft(issues, tracker, index + 1))
    .sort(compareTicketDrafts);

  return typeof options.maxTickets === "number" && options.maxTickets > 0
    ? drafts.slice(0, options.maxTickets)
    : drafts;
}

export function ticketDraftsToMarkdown(drafts: TicketDraft[], report: A11yReport): string {
  const rows = drafts.map((draft) => (
    `| ${escapeTable(draft.severity.toUpperCase())} | ${escapeTable(draft.ruleId)} | ${escapeTable(draft.page)} | ${draft.count} |`
  ));

  return [
    "# Accessibility Ticket Drafts",
    "",
    `Generated from report: ${report.generatedAt}`,
    `Total drafts: ${drafts.length}`,
    "",
    "These are dry-run ticket drafts. Review them before creating Jira, Linear, or other tracker issues.",
    "",
    "| Severity | Rule | Page | Findings |",
    "|---|---|---|---:|",
    ...rows,
    "",
    ...drafts.flatMap((draft) => [
      `## ${draft.title}`,
      "",
      draft.body,
      ""
    ])
  ].join("\n");
}

function toTicketDraft(issues: DedupedIssue[], tracker: TicketTracker, index: number): TicketDraft {
  const primary = issues[0];
  const count = issues.reduce((sum, issue) => sum + 1 + issue.duplicateCount, 0);
  const page = issuePage(primary);
  const target = issueTarget(primary);
  const wcag = unique(issues.flatMap((issue) => issue.wcag));
  const confidence = highestConfidence(issues);
  const title = formatTitle(primary, count);
  const labels = trackerLabels(tracker, primary);

  return {
    id: `a11y-${String(index).padStart(3, "0")}`,
    title,
    tracker,
    severity: primary.severity,
    ruleId: primary.ruleId,
    category: primary.category,
    page,
    target,
    count,
    wcag,
    confidence,
    labels,
    body: formatTicketBody({
      issue: primary,
      count,
      page,
      target,
      wcag,
      confidence,
      labels
    })
  };
}

function formatTitle(issue: DedupedIssue, count: number): string {
  const countSuffix = count > 1 ? ` (${count} findings)` : "";
  return `[a11y][${issue.severity}] ${issue.ruleId}${countSuffix}`;
}

function formatTicketBody(options: {
  issue: DedupedIssue;
  count: number;
  page: string;
  target: string;
  wcag: string[];
  confidence: string;
  labels: string[];
}): string {
  const { issue, count, page, target, wcag, confidence, labels } = options;
  const criteria = issue.wcagCriteria.map((criterion) => (
    `- WCAG ${criterion.id} ${criterion.title} (${criterion.level}): ${criterion.url}`
  ));
  const remediation = issue.remediation
    ? [
      issue.remediation.summary,
      "",
      ...issue.remediation.howToFix.map((step) => `- ${step}`),
      "",
      ...issue.remediation.docs.map((url) => `- ${url}`)
    ]
    : ["Review the affected element and fix the accessibility issue reported by the rule."];

  return [
    "### Summary",
    "",
    issue.message,
    "",
    "### Evidence",
    "",
    `- Severity: ${issue.severity}`,
    `- Rule: ${issue.ruleId}`,
    `- Source: ${issue.source}`,
    `- Category: ${issue.category}`,
    `- Confidence: ${confidence}`,
    `- Page: ${page}`,
    `- Target: ${target}`,
    `- Findings in group: ${count}`,
    `- Labels: ${labels.join(", ")}`,
    "",
    "### WCAG",
    "",
    ...(criteria.length > 0 ? criteria : [`- ${wcag.length > 0 ? wcag.join(", ") : "No WCAG mapping available."}`]),
    "",
    "### Suggested Fix",
    "",
    ...remediation
  ].join("\n");
}

function trackerLabels(tracker: TicketTracker, issue: DedupedIssue): string[] {
  const base = ["accessibility", `severity:${issue.severity}`, `rule:${issue.ruleId}`];

  if (tracker === "jira") return ["a11y", ...base];
  if (tracker === "linear") return ["A11y", ...base];
  return base;
}

function issuePage(issue: DedupedIssue): string {
  return issue.url || issue.file || "unknown";
}

function issueTarget(issue: DedupedIssue): string {
  if (issue.selector) return issue.selector;
  if (issue.file && issue.line) return `${issue.file}:${issue.line}`;
  if (issue.file) return issue.file;
  return "unknown";
}

function highestConfidence(issues: DedupedIssue[]): string {
  const order = ["high", "medium", "low"];
  return [...issues]
    .sort((a, b) => order.indexOf(a.confidence) - order.indexOf(b.confidence))[0]?.confidence || "low";
}

function compareTicketDrafts(a: TicketDraft, b: TicketDraft): number {
  if (SEVERITY_RANK[b.severity] !== SEVERITY_RANK[a.severity]) {
    return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  }
  if (b.count !== a.count) return b.count - a.count;
  return a.ruleId.localeCompare(b.ruleId);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}
