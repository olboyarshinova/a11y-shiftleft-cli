import type { ConfidenceLevel, FindingType, IssueCategory, NormalizedIssue } from "../types.js";

interface ConfidenceResult {
  confidence: ConfidenceLevel;
  confidenceScore: number;
  confidenceReason: string;
}

const CATEGORY_HINTS: Array<{
  category: IssueCategory;
  hints: string[];
}> = [
  {
    category: "adapter",
    hints: ["adapter/", "scan-error", "eslint-error"]
  },
  {
    category: "keyboard",
    hints: ["keyboard", "key-events", "mouse-events", "click-events", "interactive-supports-focus"]
  },
  {
    category: "focus",
    hints: ["focus", "tabindex", "tab-order", "no-autofocus"]
  },
  {
    category: "forms",
    hints: ["label", "form", "input", "button-has-type"]
  },
  {
    category: "images",
    hints: ["alt", "image", "img", "non-text"]
  },
  {
    category: "headings",
    hints: ["heading", "h1"]
  },
  {
    category: "landmarks",
    hints: ["landmark", "region", "main"]
  },
  {
    category: "contrast",
    hints: ["contrast", "color"]
  },
  {
    category: "aria",
    hints: ["aria", "role", "name-role-value"]
  },
  {
    category: "widgets",
    hints: ["combobox", "dialog", "menu", "tab", "tree", "grid", "slider"]
  },
  {
    category: "structure",
    hints: ["html", "list", "table", "scope", "language", "document"]
  },
  {
    category: "best-practice",
    hints: ["best-practice"]
  }
];

const WCAG_CATEGORY_MAP: Record<string, IssueCategory> = {
  "1.1.1": "images",
  "1.3.1": "structure",
  "1.4.3": "contrast",
  "2.1.1": "keyboard",
  "2.4.1": "landmarks",
  "2.4.2": "structure",
  "2.4.3": "focus",
  "2.4.6": "headings",
  "2.4.7": "focus",
  "2.5.8": "widgets",
  "3.3.2": "forms",
  "4.1.2": "aria"
};

export function enrichIssueEvidence<T extends NormalizedIssue>(issue: T): T & ConfidenceResult & { category: IssueCategory; findingType: FindingType } {
  const confidence = inferConfidence(issue);

  return {
    ...issue,
    category: issue.category || inferIssueCategory(issue),
    findingType: issue.findingType || inferFindingType(issue),
    confidence: issue.confidence || confidence.confidence,
    confidenceScore: issue.confidenceScore || confidence.confidenceScore,
    confidenceReason: issue.confidenceReason || confidence.confidenceReason
  };
}

export function inferFindingType(issue: NormalizedIssue): FindingType {
  if ((issue.wcagCriteria || []).length > 0) return "wcag";
  if ((issue.tags || []).some((tag) => tag.toLowerCase() === "best-practice")) {
    return "best-practice";
  }
  return "unmapped";
}

export function inferIssueCategory(issue: NormalizedIssue): IssueCategory {
  if (issue.category) return issue.category;

  const searchable = [
    issue.ruleId,
    issue.message,
    ...(issue.tags || []),
    ...(issue.wcag || []),
    ...(issue.wcagCriteria || []).map((criterion) => `${criterion.id} ${criterion.title} ${criterion.principle}`)
  ].join(" ").toLowerCase();

  for (const criterion of issue.wcagCriteria || []) {
    const mapped = WCAG_CATEGORY_MAP[criterion.id];
    if (mapped) return mapped;
  }

  for (const { category, hints } of CATEGORY_HINTS) {
    if (hints.some((hint) => searchable.includes(hint))) {
      return category;
    }
  }

  return "other";
}

export function inferConfidence(issue: NormalizedIssue): ConfidenceResult {
  if (issue.confidence && issue.confidenceScore && issue.confidenceReason) {
    return {
      confidence: issue.confidence,
      confidenceScore: issue.confidenceScore,
      confidenceReason: issue.confidenceReason
    };
  }

  if (issue.ruleId.startsWith("adapter/")) {
    return {
      confidence: "low",
      confidenceScore: 40,
      confidenceReason: "Adapter failure finding describes scan health, not a validated accessibility violation."
    };
  }

  if (issue.source === "axe") {
    if (inferFindingType(issue) === "best-practice" && issue.selector) {
      return {
        confidence: "medium",
        confidenceScore: 75,
        confidenceReason: "Detected by an axe best-practice rule on the rendered DOM; review as guidance rather than a confirmed WCAG violation."
      };
    }

    if (issue.selector && (issue.wcagCriteria || []).length > 0) {
      return {
        confidence: "high",
        confidenceScore: 95,
        confidenceReason: "Detected by axe on the rendered DOM with a concrete selector and WCAG mapping."
      };
    }

    if (issue.selector) {
      return {
        confidence: "medium",
        confidenceScore: 75,
        confidenceReason: "Detected by axe on the rendered DOM with a concrete selector, but without a WCAG mapping."
      };
    }

    return {
      confidence: "medium",
      confidenceScore: 65,
      confidenceReason: "Detected by axe, but without element-level evidence."
    };
  }

  if (issue.source === "eslint") {
    if (issue.file && Number.isFinite(issue.line) && (issue.wcagCriteria || []).length > 0) {
      return {
        confidence: "medium",
        confidenceScore: 80,
        confidenceReason: "Detected by an accessibility lint rule with source location and WCAG mapping."
      };
    }

    if (issue.file && Number.isFinite(issue.line)) {
      return {
        confidence: "medium",
        confidenceScore: 70,
        confidenceReason: "Detected by an accessibility lint rule with source location, but without a WCAG mapping."
      };
    }

    return {
      confidence: "low",
      confidenceScore: 55,
      confidenceReason: "Detected by static analysis without precise source-location evidence."
    };
  }

  return {
    confidence: "low",
    confidenceScore: 50,
    confidenceReason: "Detected by an unknown source; review manually before treating as a confirmed violation."
  };
}
