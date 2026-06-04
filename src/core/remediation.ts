import type { Framework, RemediationHint, WcagCriterion } from "../types.js";

const RULE_HINTS: Record<string, RemediationHint> = {
  "color-contrast": {
    summary: "Increase foreground/background contrast until the text meets the required WCAG ratio.",
    howToFix: [
      "Use a darker foreground color or lighter background color for normal text.",
      "Keep contrast at least 4.5:1 for normal text and 3:1 for large text."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    ]
  },
  "image-alt": {
    summary: "Provide useful alternative text for meaningful images, or mark decorative images as decorative.",
    howToFix: [
      "Add an alt attribute that describes the image purpose in context.",
      "Use an empty alt attribute only when the image is decorative."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://www.w3.org/WAI/tutorials/images/"
    ],
    frameworkExamples: {
      react: "<img src={avatarUrl} alt=\"Customer profile photo\" />",
      vue: "<img :src=\"avatarUrl\" alt=\"Customer profile photo\">"
    }
  },
  "jsx-a11y/alt-text": {
    summary: "Provide useful alternative text for meaningful images, or mark decorative images as decorative.",
    howToFix: [
      "Add an alt prop that describes the image purpose in context.",
      "Use alt=\"\" only when the image is decorative."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://www.w3.org/WAI/tutorials/images/"
    ],
    frameworkExamples: {
      react: "<img src={avatarUrl} alt=\"Customer profile photo\" />"
    }
  },
  "@angular-eslint/template/alt-text": {
    summary: "Provide useful alternative text for meaningful images in Angular templates.",
    howToFix: [
      "Add an alt attribute that describes the image purpose in context.",
      "Use alt=\"\" only when the image is decorative."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
      "https://www.w3.org/WAI/tutorials/images/"
    ],
    frameworkExamples: {
      angular: "<img [src]=\"avatarUrl\" alt=\"Customer profile photo\">"
    }
  },
  "button-name": {
    summary: "Give every button an accessible name.",
    howToFix: [
      "Use visible button text when possible.",
      "For icon-only buttons, add aria-label or aria-labelledby."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ],
    frameworkExamples: {
      react: "<button type=\"button\" aria-label=\"Open menu\"><MenuIcon /></button>",
      vue: "<button type=\"button\" aria-label=\"Open menu\"><MenuIcon /></button>",
      angular: "<button type=\"button\" aria-label=\"Open menu\"><app-menu-icon /></button>"
    }
  },
  "link-name": {
    summary: "Give every link text or an accessible name that explains its purpose.",
    howToFix: [
      "Use descriptive link text instead of generic labels like 'click here'.",
      "For icon-only links, add aria-label or aria-labelledby."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ]
  },
  "label": {
    summary: "Associate every form control with a visible label or accessible name.",
    howToFix: [
      "Connect label and control with htmlFor/id, for/id, or an equivalent framework binding.",
      "Use aria-label only when a visible label is not practical."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    ],
    frameworkExamples: {
      react: "<label htmlFor=\"email\">Email</label><input id=\"email\" name=\"email\" />",
      vue: "<label for=\"email\">Email</label><input id=\"email\" name=\"email\">",
      angular: "<label for=\"email\">Email</label><input id=\"email\" name=\"email\">"
    }
  },
  "jsx-a11y/label-has-associated-control": {
    summary: "Associate every form label with its control.",
    howToFix: [
      "Use htmlFor on the label and a matching id on the input.",
      "Keep visible label text near the input so users understand the required action."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    ],
    frameworkExamples: {
      react: "<label htmlFor=\"email\">Email</label><input id=\"email\" name=\"email\" />"
    }
  },
  "@angular-eslint/template/label-has-associated-control": {
    summary: "Associate every form label with its Angular template control.",
    howToFix: [
      "Use for on the label and a matching id on the input.",
      "Keep visible label text near the input so users understand the required action."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html"
    ],
    frameworkExamples: {
      angular: "<label for=\"email\">Email</label><input id=\"email\" name=\"email\">"
    }
  },
  "keyboard": {
    summary: "Ensure interactive behavior is available from the keyboard.",
    howToFix: [
      "Prefer native controls such as button, a, input, and select.",
      "If a custom widget is unavoidable, implement keyboard handlers and focus management."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"
    ]
  },
  "@angular-eslint/template/click-events-have-key-events": {
    summary: "Pair click behavior with keyboard interaction, or use a native control.",
    howToFix: [
      "Replace clickable non-interactive elements with button or a where possible.",
      "If custom behavior remains, add keyboard event support and a valid focus target."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"
    ],
    frameworkExamples: {
      angular: "<button type=\"button\" (click)=\"save()\">Save</button>"
    }
  },
  "@angular-eslint/template/interactive-supports-focus": {
    summary: "Make custom interactive elements focusable, or use native interactive elements.",
    howToFix: [
      "Prefer native button or link elements.",
      "If a custom element is necessary, add an appropriate tabindex and keyboard behavior."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html"
    ]
  },
  "@angular-eslint/template/no-positive-tabindex": {
    summary: "Avoid positive tabindex values because they create confusing focus order.",
    howToFix: [
      "Remove positive tabindex values.",
      "Use DOM order and tabindex=\"0\" only when a custom focus target is necessary."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html"
    ]
  },
  "aria-required-attr": {
    summary: "Provide required ARIA attributes for the element role.",
    howToFix: [
      "Check the role requirements and add the missing aria-* attribute.",
      "Prefer native semantic elements when they provide the same behavior."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ]
  },
  "aria-roles": {
    summary: "Use valid ARIA roles and avoid overriding native semantics unnecessarily.",
    howToFix: [
      "Replace invalid role values with valid WAI-ARIA roles.",
      "Remove redundant roles when a native HTML element already exposes the right semantics."
    ],
    docs: [
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html"
    ]
  },
  "landmark-one-main": {
    summary: "Add exactly one main landmark so users can jump to the primary page content.",
    howToFix: [
      "Wrap the page's primary content in one main element.",
      "Do not create multiple main landmarks on the same page."
    ],
    docs: [
      "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/main"
    ],
    frameworkExamples: {
      react: "<main><h1>Favorite items</h1>{children}</main>",
      vue: "<main><h1>Favorite items</h1><slot /></main>",
      angular: "<main><h1>Favorite items</h1><app-list /></main>"
    }
  },
  "page-has-heading-one": {
    summary: "Add a clear h1 that names the current page or route.",
    howToFix: [
      "Use one h1 near the start of the main content.",
      "If the visual design cannot show it, keep an h1 available to screen readers with a visually-hidden utility class."
    ],
    docs: [
      "https://www.w3.org/WAI/tutorials/page-structure/headings/",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements"
    ],
    frameworkExamples: {
      react: "<main><h1>Favorite items</h1></main>",
      vue: "<main><h1>Favorite items</h1></main>",
      angular: "<main><h1>Favorite items</h1></main>"
    }
  },
  "region": {
    summary: "Place visible page content inside semantic landmarks.",
    howToFix: [
      "Wrap primary content in main and repeated navigation in nav.",
      "Use header, footer, aside, or section with an accessible name where they match the content purpose."
    ],
    docs: [
      "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/",
      "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/landmark_role"
    ],
    frameworkExamples: {
      react: "<main><h1>Favorite items</h1><ItemList /></main>",
      vue: "<main><h1>Favorite items</h1><ItemList /></main>",
      angular: "<main><h1>Favorite items</h1><app-list /></main>"
    }
  },
  "@angular-eslint/template/button-has-type": {
    summary: "Add an explicit type to every button in Angular templates.",
    howToFix: [
      "Use type=\"button\" for normal UI actions.",
      "Use type=\"submit\" only for buttons that intentionally submit a form."
    ],
    docs: [
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#type"
    ],
    frameworkExamples: {
      angular: "<button type=\"button\" (click)=\"toggleFavorite(item)\">Favorite</button>"
    }
  }
};

export function getRemediationHint(
  ruleId: string,
  wcagCriteria: WcagCriterion[] = [],
  framework: Framework | string = "unknown"
): RemediationHint | undefined {
  const directHint = findRuleHint(ruleId);
  if (directHint) return filterFrameworkExamples(directHint, framework);

  if (wcagCriteria.length === 0) return undefined;

  return {
    summary: "Review the mapped WCAG success criteria and fix the underlying accessibility requirement.",
    howToFix: wcagCriteria.map((criterion) => `Address WCAG ${criterion.id} ${criterion.title}.`),
    docs: unique(wcagCriteria.map((criterion) => criterion.url))
  };
}

function findRuleHint(ruleId: string): RemediationHint | undefined {
  if (RULE_HINTS[ruleId]) return RULE_HINTS[ruleId];

  const lowerRuleId = ruleId.toLowerCase();
  const match = Object.entries(RULE_HINTS)
    .find(([rule]) => lowerRuleId.includes(rule));

  return match ? match[1] : undefined;
}

function filterFrameworkExamples(hint: RemediationHint, framework: Framework | string): RemediationHint {
  if (!hint.frameworkExamples || framework === "auto" || framework === "unknown") return hint;
  if (framework !== "react" && framework !== "vue" && framework !== "angular") return hint;

  const example = hint.frameworkExamples[framework];
  if (!example) return hint;

  return {
    ...hint,
    frameworkExamples: {
      [framework]: example
    }
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
