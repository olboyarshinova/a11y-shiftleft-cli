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
  },
  {
    id: "zoom-reflow",
    title: "Zoom, reflow, and responsive layout",
    principle: "perceivable",
    wcag: ["1.4.4", "1.4.10"],
    whyManual: "Automated scans cannot reliably judge whether zoomed content overlaps, clips, or remains usable across a complete task.",
    steps: [
      "Zoom the browser to 200% and repeat the primary task without resetting the zoom.",
      "Check a narrow 320 CSS pixel viewport for unexpected horizontal scrolling, clipped text, and overlapping controls.",
      "Confirm dialogs, sticky content, navigation, and validation messages remain visible and operable."
    ],
    evidence: [
      "Screenshots at default and 200% zoom",
      "List of clipped, overlapping, or horizontally scrolling content"
    ]
  },
  {
    id: "alternative-text-quality",
    title: "Alternative text quality",
    principle: "perceivable",
    wcag: ["1.1.1"],
    whyManual: "Tools can detect missing alternatives, but cannot determine whether an alternative communicates the image's purpose in context.",
    steps: [
      "Review informative image alternatives in the surrounding content and task context.",
      "Confirm decorative images use an empty alternative and do not create redundant announcements.",
      "Confirm charts, diagrams, and maps have an equivalent detailed description when a short alternative is insufficient."
    ],
    evidence: [
      "Image inventory with purpose and approved alternative",
      "Examples of complex-image descriptions"
    ]
  },
  {
    id: "brand-logo-accessibility",
    title: "Logo purpose and accessible name",
    principle: "perceivable",
    wcag: ["1.1.1", "2.4.4", "4.1.2"],
    whyManual: "Tools can detect missing alternatives, but cannot reliably decide whether a logo is informative, decorative, duplicated by nearby text, or a clearly named home link.",
    steps: [
      "Review logos in headers, footers, authentication screens, and branded content across the tested routes.",
      "Give a standalone informative logo a concise organization or product name; use an empty alternative when adjacent visible text already provides the same name.",
      "When a logo links to the home page, confirm the link has a clear accessible name and keyboard focus indicator without duplicate or filename-based announcements.",
      "For inline SVG logos, confirm decorative paths are hidden and the containing image or link exposes one meaningful accessible name.",
      "Check that the logo and its linked focus state remain recognizable at 200% zoom and in forced-colors or high-contrast mode."
    ],
    evidence: [
      "Logo inventory with purpose, destination, and expected accessible name",
      "Screen reader announcement and keyboard-focus notes for linked logos"
    ]
  },
  {
    id: "media-motion",
    title: "Media alternatives, autoplay, and motion",
    principle: "perceivable",
    wcag: ["1.2.1", "1.2.2", "2.2.2", "2.3.1"],
    whyManual: "Metadata checks cannot confirm caption accuracy, transcript completeness, unexpected audio, or harmful flashing.",
    steps: [
      "Confirm prerecorded audio has a transcript and prerecorded video has accurate synchronized captions.",
      "Confirm audio or motion does not start unexpectedly and that users can pause, stop, or hide moving content.",
      "Review flashing and rapid animation, and verify the experience with reduced-motion preferences enabled."
    ],
    evidence: [
      "Caption and transcript review notes",
      "Media control and reduced-motion test results"
    ]
  },
  {
    id: "landmarks-bypass",
    title: "Landmarks and repeated-content bypass",
    principle: "operable",
    wcag: ["1.3.1", "2.4.1", "2.4.6"],
    whyManual: "Tools can inspect landmarks, but cannot fully confirm that page regions and bypass links support efficient navigation.",
    steps: [
      "Review header, navigation, main, complementary, and footer landmarks with a screen reader landmark list.",
      "Activate the skip link and confirm it moves focus to the intended main content target.",
      "Confirm repeated navigation regions have clear names and page headings describe the current content."
    ],
    evidence: [
      "Landmark inventory",
      "Skip-link keyboard test result"
    ]
  },
  {
    id: "representative-user-test",
    title: "Representative assistive-technology usability test",
    principle: "understandable",
    wcag: ["2.1.1", "2.4.3", "3.3.1", "3.3.3"],
    whyManual: "Only representative users can reveal task barriers caused by real assistive technology, personal settings, and product context.",
    steps: [
      "Run one key task with a representative keyboard or screen reader user on their familiar setup when possible.",
      "Record device, browser, assistive technology, zoom, motion, and color settings used during the session.",
      "Capture where the user becomes blocked, confused, or needs excessive focus steps, then assign remediation owners."
    ],
    evidence: [
      "Consented session notes without unnecessary personal data",
      "Task completion, blocker, and follow-up issue summary"
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
