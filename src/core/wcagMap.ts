import type { WcagCriterion, WcagLevel } from "../types.js";

const RULE_TO_WCAG: Record<string, string[]> = {
  "color-contrast": ["1.4.3"],
  "image-alt": ["1.1.1"],
  "@angular-eslint/template/alt-text": ["1.1.1"],
  "@angular-eslint/template/click-events-have-key-events": ["2.1.1"],
  "@angular-eslint/template/interactive-supports-focus": ["2.1.1", "2.4.3"],
  "@angular-eslint/template/label-has-associated-control": ["1.3.1", "3.3.2"],
  "@angular-eslint/template/mouse-events-have-key-events": ["2.1.1"],
  "@angular-eslint/template/no-positive-tabindex": ["2.4.3"],
  "@angular-eslint/template/role-has-required-aria": ["4.1.2"],
  "@angular-eslint/template/valid-aria": ["4.1.2"],
  "jsx-a11y/alt-text": ["1.1.1"],
  "jsx-a11y/label-has-associated-control": ["1.3.1", "3.3.2"],
  "label": ["1.3.1", "3.3.2"],
  "aria-required-attr": ["4.1.2"],
  "aria-roles": ["4.1.2"],
  "button-name": ["4.1.2"],
  "link-name": ["2.4.4", "4.1.2"],
  "keyboard": ["2.1.1"],
  "focus-order-semantics": ["2.4.3"]
};

const WCAG_CRITERIA: Record<string, WcagCriterion> = {
  "1.1.1": {
    id: "1.1.1",
    title: "Non-text Content",
    level: "A",
    principle: "perceivable",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html"
  },
  "1.3.1": {
    id: "1.3.1",
    title: "Info and Relationships",
    level: "A",
    principle: "perceivable",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
  },
  "1.4.3": {
    id: "1.4.3",
    title: "Contrast (Minimum)",
    level: "AA",
    principle: "perceivable",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
  },
  "2.1.1": {
    id: "2.1.1",
    title: "Keyboard",
    level: "A",
    principle: "operable",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"
  },
  "2.4.3": {
    id: "2.4.3",
    title: "Focus Order",
    level: "A",
    principle: "operable",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html"
  },
  "2.4.4": {
    id: "2.4.4",
    title: "Link Purpose (In Context)",
    level: "A",
    principle: "operable",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html"
  },
  "3.3.2": {
    id: "3.3.2",
    title: "Labels or Instructions",
    level: "A",
    principle: "understandable",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html"
  },
  "4.1.2": {
    id: "4.1.2",
    title: "Name, Role, Value",
    level: "A",
    principle: "robust",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
  }
};

const WCAG_LEVEL_RANK: Record<WcagLevel, number> = {
  A: 1,
  AA: 2,
  AAA: 3
};

export function mapRuleToWcag(ruleId = ""): string[] {
  if (RULE_TO_WCAG[ruleId]) return RULE_TO_WCAG[ruleId];

  const lowerRuleId = ruleId.toLowerCase();
  const match = Object.entries(RULE_TO_WCAG)
    .find(([rule]) => lowerRuleId.includes(rule));

  return match ? match[1] : [];
}

export function getWcagCriterion(id: string): WcagCriterion | undefined {
  return WCAG_CRITERIA[id];
}

export function getWcagCriteria(ids: string[]): WcagCriterion[] {
  return unique(ids).flatMap((id) => {
    const criterion = getWcagCriterion(id);
    return criterion ? [criterion] : [];
  });
}

export function normalizeWcagReferences(references: string[] = []): string[] {
  return unique(references.flatMap((reference) => {
    if (/^\d\.\d\.\d+$/.test(reference)) return [reference];

    const compactMatch = reference.toLowerCase().match(/^wcag(\d)(\d)(\d+)$/);
    if (!compactMatch) return [];

    return [`${compactMatch[1]}.${compactMatch[2]}.${compactMatch[3]}`];
  }));
}

export function matchesWcagLevel(criteria: WcagCriterion[], level: WcagLevel): boolean {
  return criteria.some((criterion) => WCAG_LEVEL_RANK[criterion.level] <= WCAG_LEVEL_RANK[level]);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
