import type { DedupedIssue, PlannedEvaluationScope, SampleComparisonSummary } from "../types.js";

export function summarizeSampleComparison(
  issues: DedupedIssue[],
  scope: PlannedEvaluationScope | undefined
): SampleComparisonSummary | undefined {
  if (!scope || scope.randomSample.length === 0) return undefined;

  const structuredUrls = new Set([
    ...scope.target.urls,
    ...scope.representativeSample.map((page) => page.url),
    ...scope.criticalJourneys.flatMap((journey) => journey.urls)
  ].map(normalizeUrl).filter(Boolean));
  const randomUrls = new Set(scope.randomSample.map((page) => normalizeUrl(page.url)).filter(Boolean));
  const structuredIssues = issues.filter((issue) => structuredUrls.has(normalizeUrl(issue.url)));
  const randomIssues = issues.filter((issue) => randomUrls.has(normalizeUrl(issue.url)));
  const structuredRules = new Set(structuredIssues.map((issue) => issue.ruleId));
  const uniqueRandomRules = [...new Set(randomIssues
    .map((issue) => issue.ruleId)
    .filter((ruleId) => !structuredRules.has(ruleId))
  )].sort();

  return {
    enabled: true,
    representativeSampleSize: scope.representativeSample.length,
    randomSampleSize: scope.randomSample.length,
    structuredFindingCount: structuredIssues.length,
    randomFindingCount: randomIssues.length,
    uniqueRandomRules,
    recommendation: uniqueRandomRules.length > 0
      ? "Expand the representative sample because the random sample exposed issue types not seen in planned pages."
      : "No random-only issue types were detected in this run."
  };
}

function normalizeUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return value.trim().replace(/#.*$/, "").replace(/\/+$/, "");
  }
}
