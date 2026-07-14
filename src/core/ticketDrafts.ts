import { createHash } from "node:crypto";
import type { A11yReport, DedupedIssue, Severity } from "../types.js";

export type TicketTracker = "generic" | "jira" | "linear" | "github";

export type TicketFormat = "markdown" | "json" | "payloads";

export interface TicketDraftOptions {
  tracker?: TicketTracker;
  minSeverity?: Severity;
  maxTickets?: number;
}

export interface TicketDraft {
  id: string;
  fingerprint: string;
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
  ownerHint: string;
  labels: string[];
  redactedFields: string[];
  body: string;
}

export interface TicketPayloadPreview {
  tracker: TicketTracker;
  dryRun: true;
  draftId: string;
  fingerprint: string;
  endpointHint: string;
  payload: Record<string, unknown>;
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
    .map((issues) => toTicketDraft(issues, tracker))
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

export function createTicketPayloadPreviews(drafts: TicketDraft[]): TicketPayloadPreview[] {
  return drafts.map((draft) => ({
    tracker: draft.tracker,
    dryRun: true,
    draftId: draft.id,
    fingerprint: draft.fingerprint,
    endpointHint: trackerEndpointHint(draft.tracker),
    payload: trackerPayload(draft)
  }));
}

function toTicketDraft(issues: DedupedIssue[], tracker: TicketTracker): TicketDraft {
  const primary = issues[0];
  const count = issues.reduce((sum, issue) => sum + 1 + issue.duplicateCount, 0);
  const rawPage = issuePage(primary);
  const rawTarget = issueTarget(primary);
  const pageRedaction = redactSensitiveText(rawPage, "page");
  const targetRedaction = redactSensitiveText(rawTarget, "target");
  const messageRedaction = redactSensitiveText(primary.message, "message");
  const page = pageRedaction.value;
  const target = targetRedaction.value;
  const wcag = unique(issues.flatMap((issue) => issue.wcag));
  const confidence = highestConfidence(issues);
  const ownerHint = inferOwnerHint(issues);
  const title = formatTitle(primary, count);
  const labels = trackerLabels(tracker, primary, ownerHint);
  const fingerprint = ticketFingerprint(issues, rawPage, rawTarget);
  const redactedFields = unique([
    ...pageRedaction.fields,
    ...targetRedaction.fields,
    ...messageRedaction.fields
  ]);

  return {
    id: `a11y-${fingerprint.slice(0, 10)}`,
    fingerprint,
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
    ownerHint,
    labels,
    redactedFields,
    body: formatTicketBody({
      issue: primary,
      message: messageRedaction.value,
      count,
      page,
      target,
      wcag,
      confidence,
      ownerHint,
      labels,
      fingerprint,
      redactedFields
    })
  };
}

function formatTitle(issue: DedupedIssue, count: number): string {
  const countSuffix = count > 1 ? ` (${count} findings)` : "";
  return `[a11y][${issue.severity}] ${issue.ruleId}${countSuffix}`;
}

function formatTicketBody(options: {
  issue: DedupedIssue;
  message: string;
  count: number;
  page: string;
  target: string;
  wcag: string[];
  confidence: string;
  ownerHint: string;
  labels: string[];
  fingerprint: string;
  redactedFields: string[];
}): string {
  const { issue, message, count, page, target, wcag, confidence, ownerHint, labels, fingerprint, redactedFields } = options;
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
    message,
    "",
    "### Evidence",
    "",
    `- Ticket fingerprint: ${fingerprint}`,
    `- Severity: ${issue.severity}`,
    `- Rule: ${issue.ruleId}`,
    `- Source: ${issue.source}`,
    `- Category: ${issue.category}`,
    `- Confidence: ${confidence}`,
    `- Owner hint: ${ownerHint}`,
    `- Page: ${page}`,
    `- Target: ${target}`,
    `- Findings in group: ${count}`,
    `- Labels: ${labels.join(", ")}`,
    redactedFields.length > 0 ? `- Redacted fields: ${redactedFields.join(", ")}` : "- Redacted fields: none detected",
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

function trackerLabels(tracker: TicketTracker, issue: DedupedIssue, ownerHint: string): string[] {
  const base = [
    "accessibility",
    `severity:${issue.severity}`,
    `rule:${issue.ruleId}`,
    `owner:${ownerSlug(ownerHint)}`
  ];

  if (tracker === "jira") return ["a11y", ...base];
  if (tracker === "linear") return ["A11y", ...base];
  if (tracker === "github") return ["a11y", ...base];
  return base;
}

function trackerEndpointHint(tracker: TicketTracker): string {
  if (tracker === "jira") return "POST /rest/api/3/issue";
  if (tracker === "linear") return "IssueCreate mutation";
  if (tracker === "github") return "POST /repos/{owner}/{repo}/issues";
  return "Copy into your issue tracker";
}

function trackerPayload(draft: TicketDraft): Record<string, unknown> {
  if (draft.tracker === "jira") {
    return {
      ownerHint: draft.ownerHint,
      fields: {
        summary: draft.title,
        description: draft.body,
        labels: draft.labels,
        issuetype: { name: "Bug" }
      }
    };
  }

  if (draft.tracker === "linear") {
    return {
      title: draft.title,
      description: draft.body,
      labelNames: draft.labels,
      ownerHint: draft.ownerHint,
      priority: linearPriority(draft.severity)
    };
  }

  if (draft.tracker === "github") {
    return {
      title: draft.title,
      body: draft.body,
      labels: draft.labels,
      ownerHint: draft.ownerHint
    };
  }

  return {
    title: draft.title,
    body: draft.body,
    labels: draft.labels,
    ownerHint: draft.ownerHint
  };
}

function linearPriority(severity: Severity): number {
  if (severity === "critical") return 1;
  if (severity === "warning") return 2;
  return 4;
}

function inferOwnerHint(issues: DedupedIssue[]): string {
  if (issues.some((issue) => issue.ownership?.kind === "third-party-embed")) {
    return "Third-party embed owner";
  }

  const categories = new Set(issues.map((issue) => issue.category));
  const ruleIds = new Set(issues.map((issue) => issue.ruleId));

  if (categories.has("contrast") || ruleIds.has("color-contrast")) {
    return "Design system or visual design";
  }

  if (categories.has("forms")) {
    return "Forms or product UI";
  }

  if (categories.has("keyboard") || categories.has("focus") || categories.has("widgets")) {
    return "Frontend interaction";
  }

  if (categories.has("images") || categories.has("media")) {
    return "Content or media";
  }

  if (categories.has("headings") || categories.has("landmarks") || categories.has("structure")) {
    return "Content structure";
  }

  if (issues.some((issue) => issue.source === "eslint")) {
    return "Source code owner";
  }

  return "Frontend UI owner";
}

function ownerSlug(ownerHint: string): string {
  return ownerHint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

function ticketFingerprint(issues: DedupedIssue[], page: string, target: string): string {
  const source = [
    issues[0].severity,
    issues[0].ruleId,
    page,
    target,
    ...unique(issues.map((issue) => issue.fingerprint).filter(Boolean))
  ].join("|");

  return createHash("sha256").update(source).digest("hex");
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}

function redactSensitiveText(value: string, field: string): { value: string; fields: string[] } {
  let redacted = redactSensitiveUrl(value);
  redacted = redacted
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\[(value|data-(?:token|secret|email|phone))=["'][^"']+["']\]/gi, "[$1=\"[redacted]\"]");
  if (!isAbsoluteUrl(value)) {
    redacted = redacted.replace(/\b(password|passwd|pwd|token|secret|api[_-]?key|session|auth|otp)=([^&\s"')\]]+)/gi, "$1=[redacted]");
  }

  return {
    value: redacted,
    fields: redacted === value ? [] : [field]
  };
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function redactSensitiveUrl(value: string): string {
  try {
    const url = new URL(value);
    let changed = false;
    for (const [key, parameterValue] of url.searchParams.entries()) {
      if (isSensitiveParameter(key) || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(parameterValue)) {
        url.searchParams.set(key, "[redacted]");
        changed = true;
      }
    }
    return changed ? url.toString() : value;
  } catch {
    return value;
  }
}

function isSensitiveParameter(key: string): boolean {
  return /(?:password|passwd|pwd|token|secret|api[_-]?key|session|auth|otp|email|phone|card|payment)/i.test(key);
}
