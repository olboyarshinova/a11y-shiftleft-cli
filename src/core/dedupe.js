export function dedupeIssues(issues) {
  const seen = new Map();

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
    existing.duplicateCount += 1;
    existing.sources = unique([existing.source, issue.source, ...(existing.sources || [])]);
  }

  return [...seen.values()];
}

function createFingerprint(issue) {
  return [
    issue.ruleId,
    issue.selector || issue.file || issue.url || "unknown-target",
    issue.severity || "unknown-severity"
  ].join("::");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
