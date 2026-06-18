import type { WcagCriterion, WcagLevel, WcagVersion } from "../types.js";

const RULE_TO_WCAG: Record<string, string[]> = {
  "audio-caption": ["1.2.1"],
  "aria-allowed-attr": ["4.1.2"],
  "aria-valid-attr": ["4.1.2"],
  "aria-valid-attr-value": ["4.1.2"],
  "autocomplete-valid": ["1.3.5"],
  "avoid-inline-spacing": ["1.4.12"],
  "blink": ["2.2.2"],
  "bypass": ["2.4.1"],
  "color-contrast": ["1.4.3"],
  "css-orientation-lock": ["1.3.4"],
  "document-title": ["2.4.2"],
  "page-title-duplicate": ["2.4.2"],
  "page-title-placeholder": ["2.4.2"],
  "form-field-multiple-labels": ["1.3.1", "3.3.2"],
  "html-has-lang": ["3.1.1"],
  "html-lang-valid": ["3.1.1"],
  "image-alt": ["1.1.1"],
  "input-button-name": ["4.1.2"],
  "input-image-alt": ["1.1.1"],
  "list": ["1.3.1"],
  "listitem": ["1.3.1"],
  "select-name": ["4.1.2"],
  "valid-lang": ["3.1.2"],
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
  "label-content-name-mismatch": ["2.5.3"],
  "link-in-text-block": ["1.4.1"],
  "link-name": ["2.4.4", "4.1.2"],
  "marquee": ["2.2.2"],
  "meta-refresh": ["2.2.1"],
  "meta-viewport": ["1.4.4"],
  "no-autoplay-audio": ["1.4.2"],
  "keyboard": ["2.1.1"],
  "keyboard-focus-not-reached": ["2.1.1"],
  "keyboard-focus-stuck": ["2.1.2"],
  "keyboard-focus-cycle": ["2.1.2", "2.4.3"],
  "keyboard-positive-tabindex": ["2.4.3"],
  "keyboard-focus-indicator-missing": ["2.4.7"],
  "keyboard-focus-not-visible": ["2.4.7", "2.4.11"],
  "keyboard-focus-obscured": ["2.4.11"],
  "focus-order-semantics": ["2.4.3"],
  "target-size": ["2.5.8"],
  "dragging-movements": ["2.5.7"],
  "accessible-authentication": ["3.3.8"],
  "video-caption": ["1.2.2"]
};

const WCAG_CRITERIA: Record<string, WcagCriterion> = {
  "1.1.1": {
    id: "1.1.1",
    title: "Non-text Content",
    level: "A",
    principle: "perceivable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html"
  },
  "1.2.1": {
    id: "1.2.1",
    title: "Audio-only and Video-only (Prerecorded)",
    level: "A",
    principle: "perceivable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded.html"
  },
  "1.2.2": {
    id: "1.2.2",
    title: "Captions (Prerecorded)",
    level: "A",
    principle: "perceivable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html"
  },
  "1.3.1": {
    id: "1.3.1",
    title: "Info and Relationships",
    level: "A",
    principle: "perceivable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
  },
  "1.3.4": {
    id: "1.3.4",
    title: "Orientation",
    level: "AA",
    principle: "perceivable",
    introducedIn: "2.1",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/orientation.html"
  },
  "1.3.5": {
    id: "1.3.5",
    title: "Identify Input Purpose",
    level: "AA",
    principle: "perceivable",
    introducedIn: "2.1",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html"
  },
  "1.4.1": {
    id: "1.4.1",
    title: "Use of Color",
    level: "A",
    principle: "perceivable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html"
  },
  "1.4.2": {
    id: "1.4.2",
    title: "Audio Control",
    level: "A",
    principle: "perceivable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html"
  },
  "1.4.3": {
    id: "1.4.3",
    title: "Contrast (Minimum)",
    level: "AA",
    principle: "perceivable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
  },
  "1.4.4": {
    id: "1.4.4",
    title: "Resize Text",
    level: "AA",
    principle: "perceivable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html"
  },
  "1.4.12": {
    id: "1.4.12",
    title: "Text Spacing",
    level: "AA",
    principle: "perceivable",
    introducedIn: "2.1",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html"
  },
  "2.1.1": {
    id: "2.1.1",
    title: "Keyboard",
    level: "A",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"
  },
  "2.1.2": {
    id: "2.1.2",
    title: "No Keyboard Trap",
    level: "A",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html"
  },
  "2.2.1": {
    id: "2.2.1",
    title: "Timing Adjustable",
    level: "A",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html"
  },
  "2.2.2": {
    id: "2.2.2",
    title: "Pause, Stop, Hide",
    level: "A",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html"
  },
  "2.4.1": {
    id: "2.4.1",
    title: "Bypass Blocks",
    level: "A",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html"
  },
  "2.4.3": {
    id: "2.4.3",
    title: "Focus Order",
    level: "A",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html"
  },
  "2.4.4": {
    id: "2.4.4",
    title: "Link Purpose (In Context)",
    level: "A",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html"
  },
  "2.4.7": {
    id: "2.4.7",
    title: "Focus Visible",
    level: "AA",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html"
  },
  "2.4.2": {
    id: "2.4.2",
    title: "Page Titled",
    level: "A",
    principle: "operable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html"
  },
  "2.5.3": {
    id: "2.5.3",
    title: "Label in Name",
    level: "A",
    principle: "operable",
    introducedIn: "2.1",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html"
  },
  "2.4.11": {
    id: "2.4.11",
    title: "Focus Not Obscured (Minimum)",
    level: "AA",
    principle: "operable",
    introducedIn: "2.2",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html"
  },
  "3.1.1": {
    id: "3.1.1",
    title: "Language of Page",
    level: "A",
    principle: "understandable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html"
  },
  "3.1.2": {
    id: "3.1.2",
    title: "Language of Parts",
    level: "AA",
    principle: "understandable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html"
  },
  "3.3.2": {
    id: "3.3.2",
    title: "Labels or Instructions",
    level: "A",
    principle: "understandable",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html"
  },
  "4.1.2": {
    id: "4.1.2",
    title: "Name, Role, Value",
    level: "A",
    principle: "robust",
    introducedIn: "2.0",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
  },
  "2.5.7": {
    id: "2.5.7",
    title: "Dragging Movements",
    level: "AA",
    principle: "operable",
    introducedIn: "2.2",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html"
  },
  "2.5.8": {
    id: "2.5.8",
    title: "Target Size (Minimum)",
    level: "AA",
    principle: "operable",
    introducedIn: "2.2",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html"
  },
  "3.3.8": {
    id: "3.3.8",
    title: "Accessible Authentication (Minimum)",
    level: "AA",
    principle: "understandable",
    introducedIn: "2.2",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html"
  }
};

const WCAG_LEVEL_RANK: Record<WcagLevel, number> = {
  A: 1,
  AA: 2,
  AAA: 3
};

const WCAG_VERSION_RANK: Record<WcagVersion, number> = {
  "2.0": 20,
  "2.1": 21,
  "2.2": 22
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

export function matchesWcagVersion(criterion: WcagCriterion, version: WcagVersion): boolean {
  return WCAG_VERSION_RANK[criterion.introducedIn] <= WCAG_VERSION_RANK[version];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
