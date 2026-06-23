import type { DedupedIssue, TriagedIssue } from "../types.js";

export function dedupeIssues(issues: TriagedIssue[]): DedupedIssue[] {
  const seen = new Map<string, DedupedIssue>();

  for (const issue of issues) {
    const fingerprint = createFingerprint(issue);

    if (!seen.has(fingerprint)) {
      seen.set(fingerprint, {
        ...issue,
        fingerprint,
        duplicateCount: 0
      });
      continue;
    }

    const existing = seen.get(fingerprint);
    if (!existing) continue;

    existing.duplicateCount += 1;
    existing.sources = unique([existing.source, issue.source, ...(existing.sources || [])]);
    preserveVisualEvidence(existing, issue);
  }

  return [...seen.values()];
}

function preserveVisualEvidence(existing: DedupedIssue, duplicate: TriagedIssue): void {
  if (!existing.stateId && duplicate.stateId) existing.stateId = duplicate.stateId;
  if (!existing.stateLabel && duplicate.stateLabel) existing.stateLabel = duplicate.stateLabel;
  if (!existing.screenshot && duplicate.screenshot) existing.screenshot = duplicate.screenshot;
  if (!existing.elementBounds && duplicate.elementBounds) existing.elementBounds = duplicate.elementBounds;
  if (!existing.contrast && duplicate.contrast) existing.contrast = duplicate.contrast;
  if (!existing.selector && duplicate.selector) existing.selector = duplicate.selector;
  if (!existing.url && duplicate.url) existing.url = duplicate.url;
  if (!existing.helpUrl && duplicate.helpUrl) existing.helpUrl = duplicate.helpUrl;
}

function createFingerprint(issue: TriagedIssue): string {
  const target = [
    issue.url ? `url=${issue.url}` : "",
    issue.colorScheme ? `color-scheme=${issue.colorScheme}` : "",
    issue.selector ? `selector=${issue.selector}` : "",
    issue.file ? `file=${issue.file}` : "",
    Number.isFinite(issue.line) ? `line=${issue.line}` : "",
    Number.isFinite(issue.column) ? `column=${issue.column}` : ""
  ].filter(Boolean).join("|") || "target=unknown";

  return [
    issue.ruleId,
    target,
    issue.severity || "unknown-severity"
  ].join("::");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
