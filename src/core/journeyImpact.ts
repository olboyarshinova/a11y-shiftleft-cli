import type { DedupedIssue, JourneyImpactSummary, PlannedEvaluationScope, Severity } from "../types.js";

export function annotateIssuesWithJourneys<T extends DedupedIssue>(
  issues: T[],
  scope: PlannedEvaluationScope | undefined
): T[] {
  if (!scope || scope.criticalJourneys.length === 0) return issues;
  return issues.map((issue) => {
    const journeys = matchingJourneys(issue.url, scope);
    return journeys.length > 0 ? { ...issue, journeys } : issue;
  });
}

export function summarizeJourneyImpact(
  issues: DedupedIssue[],
  scope: PlannedEvaluationScope | undefined
): JourneyImpactSummary[] {
  if (!scope || scope.criticalJourneys.length === 0) return [];

  return scope.criticalJourneys.map((journey) => {
    const journeyIssues = issues.filter((issue) => issue.journeys?.includes(journey.name));
    return {
      name: journey.name,
      urls: journey.urls,
      findingCount: journeyIssues.length,
      critical: countSeverity(journeyIssues, "critical"),
      warning: countSeverity(journeyIssues, "warning"),
      info: countSeverity(journeyIssues, "info")
    };
  });
}

function matchingJourneys(url: string | undefined, scope: PlannedEvaluationScope): string[] {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return [];

  return scope.criticalJourneys
    .filter((journey) => journey.urls.some((journeyUrl) => normalizedUrl === normalizeUrl(journeyUrl)))
    .map((journey) => journey.name);
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.hash = "";
    const path = url.pathname.replace(/\/+$/, "") || "/";
    url.pathname = path;
    return url.toString();
  } catch {
    return value.trim().replace(/#.*$/, "").replace(/\/+$/, "");
  }
}

function countSeverity(issues: DedupedIssue[], severity: Severity): number {
  return issues.filter((issue) => issue.severity === severity).length;
}
