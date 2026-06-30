import type { AuditGoal, AuditGoalMetadata } from "../types.js";

const GOALS: Record<AuditGoal, AuditGoalMetadata> = {
  risk: {
    id: "risk",
    label: "Risk audit",
    description: "Prioritize high-impact blockers and owner-fixable risks before broader manual review."
  },
  validation: {
    id: "validation",
    label: "Validation audit",
    description: "Retest fixes and compare resolved, remaining, new, or worsened findings."
  },
  "level-of-effort": {
    id: "level-of-effort",
    label: "Level-of-effort audit",
    description: "Estimate remediation scope by grouping findings, repeated components, and manual-review gaps."
  },
  full: {
    id: "full",
    label: "Full evidence audit",
    description: "Collect a broader evidence package for automated findings, visual states, keyboard checks, and manual review."
  }
};

export function resolveAuditGoal(value: string | undefined): AuditGoalMetadata | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (isAuditGoal(normalized)) return GOALS[normalized];
  throw new Error(`Unsupported audit goal: ${value}. Use risk, validation, level-of-effort, or full.`);
}

export function formatAuditGoal(goal: AuditGoalMetadata | undefined): string {
  if (!goal) return "not specified";
  return `${goal.label} (${goal.id})`;
}

function isAuditGoal(value: string): value is AuditGoal {
  return value === "risk"
    || value === "validation"
    || value === "level-of-effort"
    || value === "full";
}
