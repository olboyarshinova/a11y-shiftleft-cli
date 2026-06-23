import type { FindingType } from "../types.js";

interface ClassifiedFinding {
  findingType: FindingType;
}

export function filterReportFindings<T extends ClassifiedFinding>(
  findings: T[],
  options: { wcagOnly?: boolean } = {}
): T[] {
  if (!options.wcagOnly) return findings;
  return findings.filter((finding) => finding.findingType === "wcag");
}
