import fs from "node:fs/promises";
import path from "node:path";
import type { KeyboardAuditResult } from "../types.js";

export async function writeKeyboardReport(outputDir: string, result: KeyboardAuditResult): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(outputDir, "keyboard-report.json"), JSON.stringify(result, null, 2)),
    fs.writeFile(path.join(outputDir, "keyboard-path.md"), toKeyboardMarkdown(result))
  ]);
}

export function toKeyboardMarkdown(result: KeyboardAuditResult): string {
  const forwardRows = focusRows(result.steps, "No forward focus path recorded");
  const backwardRows = focusRows(result.backwardSteps, "Reverse path was not run because the forward path was incomplete");

  return `# Keyboard Focus Path

Generated: ${result.generatedAt}

| Metric | Value |
|---|---:|
| URL | ${escapeCell(result.url)} |
| Focusable controls detected | ${result.focusableCount} |
| Unique focus steps recorded | ${new Set(result.steps.map((step) => step.selector)).size} |
| Tab limit | ${result.maxTabs} |
| Completed focus cycle | ${result.completedCycle ? "yes" : "no"} |
| Reverse order matches | ${result.reverseOrderMatches === null ? "not tested" : yesNo(result.reverseOrderMatches)} |
| Keyboard findings | ${result.issues.length} |
| Duration | ${result.durationMs}ms |

## Focus Path

| Step | Selector | Role | Accessible name | Visible | Indicator | Obscured |
|---:|---|---|---|---:|---:|---:|
${forwardRows}

## Reverse Focus Path

| Step | Selector | Role | Accessible name | Visible | Indicator | Obscured |
|---:|---|---|---|---:|---:|---:|
${backwardRows}

## Findings And Recommendations

${formatKeyboardFindings(result)}

## Interpretation

This is a bounded automated Tab and Shift+Tab traversal. It can detect common focus problems,
but it does not prove that every task or complex widget is keyboard accessible.
Confirm activation keys, modal escape behavior, logical order, and custom focus
treatments manually.
`;
}

function formatKeyboardFindings(result: KeyboardAuditResult): string {
  if (result.issues.length === 0) return "No keyboard findings detected.";

  return result.issues.map((issue, index) => {
    const remediation = issue.remediation;
    const steps = remediation?.howToFix.length
      ? remediation.howToFix.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n")
      : "1. Review the affected focus target and verify the expected keyboard behavior manually.";
    const docs = remediation?.docs.length
      ? `\n\nGuidance: ${remediation.docs.join(", ")}`
      : "";
    const examples = Object.entries(remediation?.frameworkExamples || {})
      .map(([framework, example]) => `\n\n${framework} example: \`${example}\``)
      .join("");

    return `### ${index + 1}. ${(issue.severity || "info").toUpperCase()} - ${issue.ruleId || "keyboard-review"}

${issue.message || "Review the recorded keyboard behavior."}

Target: \`${issue.selector || issue.file || "unknown"}\`

Suggested fix: ${remediation?.summary || "Review the affected focus target and correct its keyboard behavior."}

${steps}${docs}${examples}`;
  }).join("\n\n");
}

function focusRows(steps: KeyboardAuditResult["steps"], fallback: string): string {
  if (steps.length === 0) return `| - | ${fallback} | - | - | - | - | - |`;
  return steps.map((step) => `| ${step.index} | ${escapeCell(step.selector)} | ${escapeCell(step.role || step.tagName)} | ${escapeCell(step.accessibleName || "none")} | ${yesNo(step.visible)} | ${yesNo(step.indicatorVisible)} | ${yesNo(step.obscured)} |`).join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}
