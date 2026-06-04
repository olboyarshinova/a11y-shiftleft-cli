import type { DedupedIssue, Framework, ManualCheckItem, ManualChecklist } from "../types.js";

const MANUAL_CHECKS: ManualCheckItem[] = [
  {
    id: "plain-language",
    title: "Readable and understandable content",
    principle: "understandable",
    wcag: ["3.1.5", "3.3.2"],
    whyManual: "Automated tools cannot reliably judge whether content is clear for the intended audience.",
    steps: [
      "Review primary page copy, form instructions, validation messages, and error states.",
      "Confirm labels and instructions use familiar terms and avoid unnecessary jargon.",
      "Check that required actions are described before the user submits a form."
    ],
    evidence: [
      "Notes from content review",
      "Screenshots of revised copy or form instructions"
    ]
  },
  {
    id: "logical-navigation",
    title: "Logical navigation and reading order",
    principle: "operable",
    wcag: ["1.3.2", "2.4.3", "2.4.6"],
    whyManual: "Static and dynamic scanners can detect some structural issues, but they cannot fully judge task flow.",
    steps: [
      "Navigate the page using only the keyboard.",
      "Confirm focus follows the visual and task order.",
      "Confirm headings, landmarks, and links help users predict where they are going."
    ],
    evidence: [
      "Keyboard walkthrough notes",
      "List of confusing focus or heading order issues"
    ]
  },
  {
    id: "form-label-quality",
    title: "Meaningful form labels and instructions",
    principle: "understandable",
    wcag: ["1.3.1", "3.3.2"],
    whyManual: "Tools can detect missing labels, but not whether the label is specific enough for a real task.",
    steps: [
      "Review every form control with visible text, accessible name, helper text, and error text.",
      "Confirm labels are unique when repeated fields appear.",
      "Confirm error messages explain how to fix the issue."
    ],
    evidence: [
      "Form field inventory",
      "Examples of unclear labels or corrected messages"
    ]
  },
  {
    id: "complex-widget-focus",
    title: "Focus behavior for complex widgets",
    principle: "operable",
    wcag: ["2.1.1", "2.4.3", "4.1.2"],
    whyManual: "Rendered-widget behavior depends on state transitions that automated scans may not exercise.",
    steps: [
      "Test menus, dialogs, tabs, date pickers, comboboxes, and custom controls with keyboard only.",
      "Confirm focus moves into opened dialogs and returns to the trigger when closed.",
      "Confirm Escape, Enter, Space, arrow keys, and Tab follow expected widget behavior."
    ],
    evidence: [
      "Keyboard interaction notes",
      "Screenshots or recordings of focus states"
    ]
  },
  {
    id: "screen-reader-smoke",
    title: "Screen reader smoke test",
    principle: "robust",
    wcag: ["4.1.2"],
    whyManual: "Automated tools cannot verify the complete assistive technology experience.",
    steps: [
      "Run a short screen reader walkthrough on the main user path.",
      "Confirm page title, headings, buttons, links, forms, and live updates are announced meaningfully.",
      "Record confusing announcements or missing state changes."
    ],
    evidence: [
      "Screen reader/browser combination used",
      "Observed announcement issues"
    ]
  }
];

export function createManualChecklist(options: {
  framework: Framework | string;
  urls?: string[];
  issues?: DedupedIssue[];
  generatedAt?: string;
}): ManualChecklist {
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    framework: options.framework,
    urls: options.urls || [],
    items: prioritizeManualChecks(MANUAL_CHECKS, options.issues || [])
  };
}

export function toManualChecklistMarkdown(checklist: ManualChecklist): string {
  const target = checklist.urls.length > 0 ? checklist.urls.join(", ") : "static review target";
  const items = checklist.items.map((item) => `### ${item.title}

- Principle: ${item.principle}
- WCAG: ${item.wcag.join(", ")}
- Why manual: ${item.whyManual}

Steps:
${item.steps.map((step) => `- [ ] ${step}`).join("\n")}

Evidence to capture:
${item.evidence.map((evidence) => `- [ ] ${evidence}`).join("\n")}
`).join("\n");

  return `# Semi-Automated Accessibility Review Checklist

Generated: ${checklist.generatedAt}
Framework: ${checklist.framework}
Target: ${target}

Automated accessibility tools do not prove full WCAG conformance. Use this
checklist to review issues that require human judgment, keyboard walkthroughs,
and assistive technology checks.

${items}`;
}

function prioritizeManualChecks(items: ManualCheckItem[], issues: DedupedIssue[]): ManualCheckItem[] {
  const hasForms = issues.some((issue) => issue.ruleId.includes("label") || issue.ruleId.includes("form"));
  const hasKeyboard = issues.some((issue) => issue.ruleId.includes("keyboard") || issue.ruleId.includes("focus"));

  return [...items].sort((a, b) => score(b, hasForms, hasKeyboard) - score(a, hasForms, hasKeyboard));
}

function score(item: ManualCheckItem, hasForms: boolean, hasKeyboard: boolean): number {
  if (hasForms && item.id === "form-label-quality") return 2;
  if (hasKeyboard && item.id === "complex-widget-focus") return 2;
  return 1;
}
