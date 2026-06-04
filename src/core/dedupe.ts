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
  }

  return [...seen.values()];
}

function createFingerprint(issue: TriagedIssue): string {
  return [
    issue.ruleId,
    issue.selector || issue.file || issue.url || "unknown-target",
    issue.severity || "unknown-severity"
  ].join("::");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
