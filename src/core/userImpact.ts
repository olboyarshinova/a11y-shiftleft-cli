import type { DedupedIssue, IssueCategory, UserImpactEvidence, UserImpactLevel } from "../types.js";

type ImpactRule = {
  level: UserImpactLevel;
  affectedUsers: string[];
  reason: string;
};

const CATEGORY_IMPACT: Partial<Record<IssueCategory, ImpactRule>> = {
  keyboard: {
    level: "blocker",
    affectedUsers: ["Keyboard users", "Screen reader users", "Switch-control users"],
    reason: "Keyboard or focus failures can prevent people from reaching or operating UI."
  },
  focus: {
    level: "significant",
    affectedUsers: ["Keyboard users", "Low-vision users", "Screen reader users"],
    reason: "Focus problems make navigation and current position harder to understand."
  },
  aria: {
    level: "significant",
    affectedUsers: ["Screen reader users", "Voice-control users"],
    reason: "Incorrect roles, names, or states can hide purpose or state from assistive technologies."
  },
  forms: {
    level: "significant",
    affectedUsers: ["Screen reader users", "Keyboard users", "Users under cognitive load"],
    reason: "Form labeling or validation gaps can make task completion difficult."
  },
  contrast: {
    level: "significant",
    affectedUsers: ["Low-vision users", "Users in bright environments"],
    reason: "Low contrast can make text or controls hard to perceive."
  },
  images: {
    level: "workaround",
    affectedUsers: ["Screen reader users", "Users with images disabled"],
    reason: "Missing or weak alternatives can remove meaning from non-text content."
  },
  media: {
    level: "workaround",
    affectedUsers: ["Deaf or hard-of-hearing users", "Users relying on captions"],
    reason: "Media issues often need human review for captions, transcripts, or motion effects."
  },
  layout: {
    level: "workaround",
    affectedUsers: ["Low-vision users", "Keyboard users", "Mobile users"],
    reason: "Layout and reflow issues can force extra scrolling or hide content at high zoom."
  },
  headings: {
    level: "workaround",
    affectedUsers: ["Screen reader users", "Keyboard users"],
    reason: "Weak headings make page structure and scanning less efficient."
  },
  landmarks: {
    level: "workaround",
    affectedUsers: ["Screen reader users", "Keyboard users"],
    reason: "Landmark gaps reduce navigation shortcuts and page orientation."
  },
  widgets: {
    level: "significant",
    affectedUsers: ["Keyboard users", "Screen reader users", "Voice-control users"],
    reason: "Custom widgets can block interaction when roles, states, names, or keyboard behavior are incomplete."
  },
  structure: {
    level: "workaround",
    affectedUsers: ["Screen reader users", "Users under cognitive load"],
    reason: "Structural issues can make relationships, language, or page purpose harder to understand."
  },
  adapter: {
    level: "minor",
    affectedUsers: ["Development team"],
    reason: "Adapter findings describe scan coverage or tooling health rather than a confirmed user-facing defect."
  },
  "best-practice": {
    level: "minor",
    affectedUsers: ["Development team"],
    reason: "Best-practice findings are useful triage signals but may not be direct user blockers."
  },
  other: {
    level: "minor",
    affectedUsers: ["Users who rely on assistive technology"],
    reason: "The finding needs manual review to determine practical user impact."
  }
};

const DEFAULT_IMPACT: ImpactRule = {
  level: "minor",
  affectedUsers: ["Users who rely on assistive technology"],
  reason: "The finding needs manual review to determine practical user impact."
};

const BLOCKING_RULE_HINTS = [
  "aria-hidden-focus",
  "focus-trap",
  "keyboard-trap",
  "keyboard-unreachable",
  "interactive-supports-focus",
  "modal-focus",
  "nested-interactive"
];

const NAME_RULE_HINTS = [
  "button-name",
  "link-name",
  "input-button-name",
  "aria-command-name"
];

export function applyUserImpact<T extends DedupedIssue>(issues: T[]): T[] {
  return issues.map((issue) => ({
    ...issue,
    userImpact: issue.userImpact || inferUserImpact(issue)
  }));
}

export function inferUserImpact(issue: DedupedIssue): UserImpactEvidence {
  const ruleId = issue.ruleId.toLowerCase();

  if (BLOCKING_RULE_HINTS.some((hint) => ruleId.includes(hint))) {
    return {
      level: "blocker",
      affectedUsers: ["Keyboard users", "Screen reader users"],
      reason: "The rule indicates focus or keyboard access may be blocked."
    };
  }

  if (NAME_RULE_HINTS.some((hint) => ruleId.includes(hint))) {
    return {
      level: issue.severity === "critical" ? "blocker" : "significant",
      affectedUsers: ["Screen reader users", "Voice-control users"],
      reason: "Controls without accessible names may be impossible to identify or activate by assistive technology."
    };
  }

  if (issue.findingType === "best-practice" || issue.severity === "info") {
    return {
      level: "minor",
      affectedUsers: ["Development team"],
      reason: "This finding is guidance or informational evidence rather than a confirmed blocking defect."
    };
  }

  const categoryImpact = CATEGORY_IMPACT[issue.category] || DEFAULT_IMPACT;
  if (issue.severity === "critical" && categoryImpact.level !== "blocker") {
    return {
      ...categoryImpact,
      level: categoryImpact.level === "minor" ? "significant" : categoryImpact.level
    };
  }

  return categoryImpact;
}

export function countUserImpact(issues: DedupedIssue[]): Record<string, number> {
  return issues.reduce<Record<string, number>>((acc, issue) => {
    const level = issue.userImpact?.level || inferUserImpact(issue).level;
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
}
