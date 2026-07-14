import type { DedupedIssue, ExplorationGraph, ExplorationState, Framework, ManualCheckItem, ManualChecklist, ManualChecklistEntry, ManualReviewEnvironment, ManualReviewTarget } from "../types.js";

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
    title: "Screen reader navigation and task smoke test",
    principle: "robust",
    wcag: ["1.3.1", "2.4.1", "2.4.6", "4.1.2"],
    whyManual: "Automated tools cannot verify announcements, navigation efficiency, or complete task usability with assistive technology.",
    steps: [
      "Choose a representative supported combination: NVDA with Chrome or Firefox on Windows, JAWS with Chrome or Edge on Windows, or VoiceOver with Safari on macOS.",
      "Navigate the primary page by landmarks, headings, links, buttons, and form controls before completing one representative task.",
      "Confirm the page title, heading hierarchy, control names, roles, states, instructions, and validation errors are announced meaningfully.",
      "Repeat the highest-risk task with a second screen reader/browser combination when the product audience or procurement requirements justify it."
    ],
    evidence: [
      "Operating system, browser, screen reader, and version",
      "Task attempted and completion outcome",
      "Observed announcement or navigation issues"
    ]
  },
  {
    id: "voiceover-smoke",
    title: "VoiceOver smoke test for Safari",
    principle: "robust",
    wcag: ["1.3.1", "2.4.1", "2.4.6", "4.1.2"],
    whyManual: "VoiceOver announcements and rotor navigation are platform behavior that cannot be fully verified from DOM, axe, or Playwright evidence alone.",
    steps: [
      "Open a representative route in Safari on macOS and start VoiceOver.",
      "Use the VoiceOver rotor to inspect headings, landmarks, links, buttons, and form controls.",
      "Confirm page title, current region, primary navigation, control names, roles, states, and validation errors are announced meaningfully.",
      "Open one dialog, menu, or dynamic widget and confirm VoiceOver announces the name, state, focus movement, and close or return behavior.",
      "Repeat on iOS Safari with VoiceOver when the product has meaningful mobile usage or touch-specific interactions."
    ],
    evidence: [
      "macOS or iOS version, Safari version, and VoiceOver version or OS build",
      "Rotor headings, landmarks, and controls notes",
      "Task outcome and announcement issues"
    ]
  },
  {
    id: "screen-reader-dynamic-content",
    title: "Screen reader forms, dialogs, and dynamic updates",
    principle: "robust",
    wcag: ["3.3.1", "3.3.2", "4.1.2", "4.1.3"],
    whyManual: "A scanner can inspect markup but cannot reliably confirm the timing, usefulness, and focus behavior of announcements during real interaction.",
    steps: [
      "Submit one representative form with an error and confirm the error summary or field error is announced and associated with the affected control.",
      "Open and close a dialog, menu, or disclosure and confirm its name and state are announced, focus enters appropriately, and focus returns to the trigger.",
      "Trigger loading, success, error, cart, search-result, or other important asynchronous updates and confirm meaningful status messages are announced without moving focus unexpectedly.",
      "Confirm repeated announcements are not noisy and hidden or background content is not read as active dialog content."
    ],
    evidence: [
      "Screen reader/browser combination used",
      "Form, dialog, and live-region scenarios tested",
      "Announcement transcript or concise observed-result notes"
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
  exploration?: ExplorationGraph;
  generatedAt?: string;
}): ManualChecklist {
  const targets = collectManualReviewTargets(options.exploration);
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    framework: options.framework,
    urls: options.urls || [],
    items: prioritizeManualChecks(MANUAL_CHECKS, options.issues || [], targets)
      .map((item) => toChecklistEntry(item, targets.get(item.id) || []))
  };
}

export function toManualChecklistMarkdown(checklist: ManualChecklist): string {
  const target = checklist.urls.length > 0 ? checklist.urls.join(", ") : "static review target";
  const summary = summarizeManualReviewRecords(checklist);
  const items = checklist.items.map((item) => `### ${item.title}

- Principle: ${item.principle}
- WCAG: ${item.wcag.join(", ")}
- Why manual: ${item.whyManual}

Steps:
${item.steps.map((step) => `- [ ] ${step}`).join("\n")}

Evidence to capture:
${item.evidence.map((evidence) => `- [ ] ${evidence}`).join("\n")}

${formatObservedTargets(item.targets)}

Review record:
- Status: \`${item.review.status}\` (pass, fail, or not-applicable)
- Tester:
- Tested at:
- Environment summary:
${formatEnvironmentDetailsMarkdown(item.review.environmentDetails)}
- Remediation owner:
- Notes:
- Evidence links:
`).join("\n");

  return `# Semi-Automated Accessibility Review Checklist

Generated: ${checklist.generatedAt}
Framework: ${checklist.framework}
Target: ${target}

Automated accessibility tools do not prove full WCAG conformance. Use this
checklist to review issues that require human judgment, keyboard walkthroughs,
and assistive technology checks.

## Review Status

| Status | Count |
|---|---:|
| Not reviewed | ${summary.notReviewed} |
| Pass | ${summary.pass} |
| Fail | ${summary.fail} |
| Not applicable | ${summary.notApplicable} |

${items}`;
}

export function summarizeManualReviewRecords(checklist: ManualChecklist): {
  total: number;
  notReviewed: number;
  pass: number;
  fail: number;
  notApplicable: number;
} {
  return checklist.items.reduce((summary, item) => {
    summary.total += 1;
    if (item.review.status === "pass") summary.pass += 1;
    else if (item.review.status === "fail") summary.fail += 1;
    else if (item.review.status === "not-applicable") summary.notApplicable += 1;
    else summary.notReviewed += 1;
    return summary;
  }, {
    total: 0,
    notReviewed: 0,
    pass: 0,
    fail: 0,
    notApplicable: 0
  });
}

function toChecklistEntry(item: ManualCheckItem, targets: ManualReviewTarget[]): ManualChecklistEntry {
  return {
    ...item,
    ...(targets.length > 0 ? { targets } : {}),
    review: {
      status: "not-reviewed",
      tester: "",
      testedAt: "",
      environment: "",
      environmentDetails: createEmptyManualReviewEnvironment(),
      notes: "",
      evidenceLinks: [],
      remediationOwner: ""
    }
  };
}

function createEmptyManualReviewEnvironment(): ManualReviewEnvironment {
  return {
    operatingSystem: "",
    browser: "",
    assistiveTechnology: "",
    inputMethod: "",
    viewportOrZoom: "",
    colorMode: ""
  };
}

function formatEnvironmentDetailsMarkdown(environment: ManualReviewEnvironment | undefined): string {
  const details = environment || createEmptyManualReviewEnvironment();
  return [
    `  - Operating system: ${details.operatingSystem}`,
    `  - Browser: ${details.browser}`,
    `  - Assistive technology and version: ${details.assistiveTechnology}`,
    `  - Input method: ${details.inputMethod}`,
    `  - Viewport or zoom level: ${details.viewportOrZoom}`,
    `  - Color mode: ${details.colorMode}`
  ].join("\n");
}

function prioritizeManualChecks(
  items: ManualCheckItem[],
  issues: DedupedIssue[],
  targets: Map<string, ManualReviewTarget[]>
): ManualCheckItem[] {
  const hasForms = issues.some((issue) => issue.ruleId.includes("label") || issue.ruleId.includes("form"));
  const hasKeyboard = issues.some((issue) => issue.ruleId.includes("keyboard") || issue.ruleId.includes("focus"));

  return [...items].sort((a, b) => (
    score(b, hasForms, hasKeyboard, targets.get(b.id)?.length || 0)
      - score(a, hasForms, hasKeyboard, targets.get(a.id)?.length || 0)
  ));
}

function score(item: ManualCheckItem, hasForms: boolean, hasKeyboard: boolean, targetCount: number): number {
  let result = targetCount > 0 ? 10 + Math.min(targetCount, 5) : 1;
  if (hasForms && item.id === "form-label-quality") result += 2;
  if (hasKeyboard && item.id === "complex-widget-focus") result += 2;
  return result;
}

function collectManualReviewTargets(graph?: ExplorationGraph): Map<string, ManualReviewTarget[]> {
  const targets = new Map<string, ManualReviewTarget[]>();
  if (!graph) return targets;

  for (const state of graph.states) {
    addFormTargets(targets, state);
    addModalTargets(targets, state);
    addAnnouncementTargets(targets, state);
    addImageTargets(targets, state);
    addMediaTargets(targets, state);
    addLandmarkTargets(targets, state);
    addReflowTargets(targets, state);
  }

  return targets;
}

function addFormTargets(targets: Map<string, ManualReviewTarget[]>, state: ExplorationState): void {
  const evidence = state.formErrors;
  if (!evidence || evidence.formCount === 0) return;
  const fields = evidence.invalidFields.length > 0
    ? evidence.invalidFields
    : [{ selector: "form", accessibleName: undefined }];
  for (const field of fields) {
    const target = targetFor(state, "form", field.accessibleName || field.selector, field.selector,
      `${evidence.formCount} form(s), ${evidence.invalidFieldCount} invalid field(s), ${evidence.unassociatedInvalidCount} without an exposed associated error`);
    addTarget(targets, "form-label-quality", target);
    addTarget(targets, "screen-reader-dynamic-content", target);
  }
}

function addModalTargets(targets: Map<string, ManualReviewTarget[]>, state: ExplorationState): void {
  const evidence = state.modalFocus;
  if (!evidence || evidence.dialogCount === 0) return;
  const target = targetFor(state, "dialog", evidence.accessibleName || "Opened dialog", evidence.dialogSelector,
    `Name ${evidence.hasAccessibleName ? "detected" : "missing"}; initial focus ${evidence.initialFocusInside ? "inside" : "outside"}; Escape ${evidence.escapeClosed ? "closed it" : "needs review"}`);
  addTarget(targets, "complex-widget-focus", target);
  addTarget(targets, "screen-reader-dynamic-content", target);
}

function addAnnouncementTargets(targets: Map<string, ManualReviewTarget[]>, state: ExplorationState): void {
  const evidence = state.dynamicAnnouncements;
  if (!evidence || evidence.updates.length === 0) return;
  for (const update of evidence.updates) {
    addTarget(targets, "screen-reader-dynamic-content", targetFor(state, "live-region",
      update.text || `${update.role || "live"} region`, update.selector,
      `${update.politeness} update after ${evidence.actionLabel}`));
  }
}

function addImageTargets(targets: Map<string, ManualReviewTarget[]>, state: ExplorationState): void {
  for (const image of state.imageAlternatives?.samples || []) {
    addTarget(targets, "alternative-text-quality", targetFor(state, "image", image.alt || "Image without useful alternative", image.selector,
      `Review concerns: ${image.concerns.join(", ") || "contextual quality"}`));
  }
}

function addMediaTargets(targets: Map<string, ManualReviewTarget[]>, state: ExplorationState): void {
  const evidence = state.media;
  if (!evidence) return;
  for (const media of evidence.elements) {
    addTarget(targets, "media-motion", targetFor(state, "media", `${media.kind} element`, media.selector,
      `${media.captionTrackCount} caption track(s); controls ${media.controls ? "present" : "missing"}; autoplay ${media.autoplay ? "enabled" : "disabled"}`));
  }
  if (evidence.activeAnimationCount > 0 && evidence.elements.length === 0) {
    addTarget(targets, "media-motion", targetFor(state, "media", "Animated content", undefined,
      `${evidence.activeAnimationCount} active animation(s); reduced-motion query ${evidence.reducedMotionQueryDetected ? "detected" : "not detected"}`));
  }
}

function addLandmarkTargets(targets: Map<string, ManualReviewTarget[]>, state: ExplorationState): void {
  const landmarks = state.accessibilityTree?.landmarks || [];
  if (landmarks.length === 0) return;
  addTarget(targets, "landmarks-bypass", targetFor(state, "landmark", `${landmarks.length} landmark(s)`, undefined,
    landmarks.map((item) => `${item.role}${item.name ? `: ${item.name}` : ""}`).join(", ")));
}

function addReflowTargets(targets: Map<string, ManualReviewTarget[]>, state: ExplorationState): void {
  const evidence = state.reflow;
  if (!evidence) return;
  const label = evidence.horizontalOverflowPx > 0 || evidence.clippedTextCount > 0
    ? "Reflow findings require review"
    : "Reflow sample";
  addTarget(targets, "zoom-reflow", targetFor(state, "reflow", label, undefined,
    `${evidence.horizontalOverflowPx}px horizontal overflow; ${evidence.clippedTextCount} clipped-text candidate(s)`));
}

function targetFor(
  state: ExplorationState,
  kind: ManualReviewTarget["kind"],
  label: string,
  selector: string | undefined,
  evidence: string
): ManualReviewTarget {
  return {
    id: `${state.id}:${kind}:${selector || label}`,
    kind,
    label,
    url: state.url,
    stateId: state.id,
    ...(selector ? { selector } : {}),
    evidence
  };
}

function addTarget(targets: Map<string, ManualReviewTarget[]>, itemId: string, target: ManualReviewTarget): void {
  const current = targets.get(itemId) || [];
  if (current.length >= 6 || current.some((item) => item.id === target.id)) return;
  current.push(target);
  targets.set(itemId, current);
}

function formatObservedTargets(targets: ManualReviewTarget[] | undefined): string {
  if (!targets?.length) return "Observed targets: none collected automatically; choose a representative instance manually.";
  return `Observed targets:\n${targets.map((target) => (
    `- [ ] ${target.kind}: ${target.label} — ${target.url} (${target.stateId}${target.selector ? `, ${target.selector}` : ""}); ${target.evidence}`
  )).join("\n")}`;
}
