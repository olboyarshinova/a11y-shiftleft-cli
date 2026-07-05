import { extractContrastEvidence } from "./contrast.js";
import { inferIssueOwnership } from "./ownership.js";
import type { ColorScheme, Framework, Issue } from "../types.js";

interface AxeNodeLike {
  target: unknown[];
  any?: unknown[];
  all?: unknown[];
  none?: unknown[];
}

interface AxeRuleResultLike {
  id: string;
  impact?: string | null;
  tags: string[];
  nodes: AxeNodeLike[];
  help: string;
  helpUrl?: string;
}

interface AxeResultsLike {
  violations: AxeRuleResultLike[];
  incomplete?: AxeRuleResultLike[];
}

export interface AxeIssueContext {
  framework: Framework | string;
  url: string;
  frames?: Array<{ url: string }>;
  colorScheme?: ColorScheme;
  stateId?: string;
  stateLabel?: string;
}

export function createIssuesFromAxeResults(
  results: AxeResultsLike,
  context: AxeIssueContext
): Issue[] {
  return [
    ...createAxeViolationIssues(results.violations, context),
    ...createAxeNeedsReviewIssues(results.incomplete || [], context)
  ];
}

export function createAxeViolationIssues(
  violations: AxeRuleResultLike[],
  context: AxeIssueContext
): Issue[] {
  const issues: Issue[] = [];

  for (const violation of violations) {
    for (const node of violation.nodes) {
      const selector = selectorFromAxeTarget(node.target);
      issues.push({
        source: "axe",
        framework: context.framework,
        ruleId: violation.id,
        impact: violation.impact || undefined,
        wcag: violation.tags.filter((tag: string) => tag.startsWith("wcag")),
        tags: violation.tags,
        selector,
        contrast: extractContrastEvidence(violation.id, node as Parameters<typeof extractContrastEvidence>[1]),
        helpUrl: violation.helpUrl,
        colorScheme: context.colorScheme,
        ownership: inferIssueOwnership(selector, context.url, context.frames || []),
        message: violation.help,
        url: context.url,
        stateId: context.stateId,
        stateLabel: context.stateLabel
      });
    }
  }

  return issues;
}

export function createAxeNeedsReviewIssues(
  incomplete: AxeRuleResultLike[],
  context: AxeIssueContext
): Issue[] {
  const issues: Issue[] = [];

  for (const result of incomplete) {
    if (!shouldReportIncompleteResult(result)) continue;

    for (const node of result.nodes) {
      const selector = selectorFromAxeTarget(node.target);
      issues.push({
        source: "axe",
        framework: context.framework,
        ruleId: result.id,
        impact: result.impact || undefined,
        wcag: result.tags.filter((tag: string) => tag.startsWith("wcag")),
        tags: [...new Set([...result.tags, "needs-review", "axe-incomplete"])],
        selector,
        contrast: extractContrastEvidence(result.id, node as Parameters<typeof extractContrastEvidence>[1]),
        helpUrl: result.helpUrl,
        colorScheme: context.colorScheme,
        ownership: inferIssueOwnership(selector, context.url, context.frames || []),
        findingType: "needs-review",
        category: result.id === "color-contrast" ? "contrast" : undefined,
        severity: "warning",
        confidence: "low",
        confidenceScore: 55,
        confidenceReason: "Axe could not complete this rule automatically; treat it as manual-review evidence, not a confirmed violation.",
        message: needsReviewMessage(result),
        url: context.url,
        stateId: context.stateId,
        stateLabel: context.stateLabel
      });
    }
  }

  return issues;
}

function selectorFromAxeTarget(target: unknown[]): string {
  return target
    .map((part) => typeof part === "string" ? part : JSON.stringify(part))
    .filter(Boolean)
    .join(" ");
}

function shouldReportIncompleteResult(result: AxeRuleResultLike): boolean {
  return result.id === "color-contrast";
}

function needsReviewMessage(result: AxeRuleResultLike): string {
  if (result.id === "color-contrast") {
    return "Potential color contrast issue needs manual review because the rendered background may include an image, gradient, video, overlay, or other complex visual treatment.";
  }

  return `${result.help} needs manual review because axe could not complete this rule automatically.`;
}
