import fs from "node:fs/promises";
import path from "node:path";

export type ScreenReaderProfile = "voiceover" | "nvda" | "jaws" | "talkback";

export interface ScreenReaderChecklistTask {
  id: string;
  title: string;
  steps: string[];
  evidence: string[];
}

export interface ScreenReaderChecklist {
  generatedAt: string;
  profile: ScreenReaderProfile;
  profileLabel: string;
  recommendedEnvironment: string;
  urls: string[];
  tasks: ScreenReaderChecklistTask[];
}

const PROFILE_LABELS: Record<ScreenReaderProfile, string> = {
  voiceover: "VoiceOver smoke test",
  nvda: "NVDA smoke test",
  jaws: "JAWS smoke test",
  talkback: "TalkBack smoke test"
};

const PROFILE_ENVIRONMENTS: Record<ScreenReaderProfile, string> = {
  voiceover: "macOS Safari with VoiceOver, or iOS Safari with VoiceOver for mobile checks",
  nvda: "Windows with NVDA and Chrome or Firefox",
  jaws: "Windows with JAWS and Chrome or Edge",
  talkback: "Android Chrome with TalkBack"
};

export function toScreenReaderProfile(value: string | undefined): ScreenReaderProfile {
  const normalized = (value || "voiceover").trim().toLowerCase();
  if (normalized === "voiceover" || normalized === "nvda" || normalized === "jaws" || normalized === "talkback") {
    return normalized;
  }
  throw new Error(`Unsupported screen reader profile: ${value}. Use voiceover, nvda, jaws, or talkback.`);
}

export function createScreenReaderChecklist(options: {
  profile?: ScreenReaderProfile | string;
  urls?: string[];
  generatedAt?: string;
}): ScreenReaderChecklist {
  const profile = typeof options.profile === "string"
    ? toScreenReaderProfile(options.profile)
    : options.profile || "voiceover";

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    profile,
    profileLabel: PROFILE_LABELS[profile],
    recommendedEnvironment: PROFILE_ENVIRONMENTS[profile],
    urls: options.urls?.length ? options.urls : [],
    tasks: createTasks(profile)
  };
}

export async function writeScreenReaderChecklist(outputDir: string, checklist: ScreenReaderChecklist): Promise<{
  jsonPath: string;
  markdownPath: string;
}> {
  await fs.mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "screen-reader-checklist.json");
  const markdownPath = path.join(outputDir, "screen-reader-checklist.md");
  await Promise.all([
    fs.writeFile(jsonPath, JSON.stringify(checklist, null, 2)),
    fs.writeFile(markdownPath, toScreenReaderChecklistMarkdown(checklist))
  ]);
  return { jsonPath, markdownPath };
}

export function toScreenReaderChecklistMarkdown(checklist: ScreenReaderChecklist): string {
  const target = checklist.urls.length > 0 ? checklist.urls.join(", ") : "Choose one representative page or task flow.";
  const tasks = checklist.tasks.map((task) => `## ${task.title}

Steps:
${task.steps.map((step) => `- [ ] ${step}`).join("\n")}

Evidence to record:
${task.evidence.map((item) => `- [ ] ${item}`).join("\n")}

Review record:
- Status: \`not-reviewed\` (pass, fail, or not-applicable)
- Tester:
- Tested at:
- Environment:
- Notes:
- Evidence links:
`).join("\n");

  return `# ${checklist.profileLabel}

Generated: ${checklist.generatedAt}
Recommended environment: ${checklist.recommendedEnvironment}
Target: ${target}

This is a human assistive-technology smoke test. It complements automated axe,
keyboard, and accessibility-tree evidence; it does not claim full screen-reader
coverage or WCAG conformance by itself.

${tasks}`;
}

function createTasks(profile: ScreenReaderProfile): ScreenReaderChecklistTask[] {
  const navigationSteps = profile === "voiceover"
    ? [
      "Open the first target URL in Safari and start VoiceOver.",
      "Use the VoiceOver rotor to review headings, landmarks, links, buttons, and form controls.",
      "Confirm the page title, main heading, current region, and primary navigation are announced with useful names.",
      "Complete one representative task without relying on visual-only information."
    ]
    : [
      "Open the first target URL with the recommended browser and screen reader.",
      "Review headings, landmarks, links, buttons, and form controls with the screen reader's navigation shortcuts.",
      "Confirm the page title, main heading, current region, and primary navigation are announced with useful names.",
      "Complete one representative task without relying on visual-only information."
    ];

  return [
    {
      id: "navigation-structure",
      title: "Navigation structure and page orientation",
      steps: navigationSteps,
      evidence: [
        "Screen reader, browser, operating system, and versions used",
        "Whether headings, landmarks, and primary controls were discoverable",
        "Any confusing, duplicate, missing, or filename-like announcements"
      ]
    },
    {
      id: "forms-errors",
      title: "Forms, instructions, and error announcements",
      steps: [
        "Move through representative form fields with the screen reader.",
        "Confirm each field announces a useful label, role, required state, hint, and current value where applicable.",
        "Submit an invalid form state and confirm the error summary or field error is announced and associated with the affected field.",
        "Confirm the user can understand how to fix the error without visual-only cues."
      ],
      evidence: [
        "Fields tested",
        "Error announcement notes",
        "Missing or unclear label, hint, required-state, or error association"
      ]
    },
    {
      id: "dialogs-dynamic-updates",
      title: "Dialogs, menus, and dynamic updates",
      steps: [
        "Open a dialog, menu, disclosure, tab panel, or other stateful widget.",
        "Confirm its name, role, expanded or selected state, and close behavior are announced.",
        "Trigger a loading, success, error, cart, search, or status update and listen for a useful announcement.",
        "Confirm background content is not announced as active dialog content."
      ],
      evidence: [
        "Widgets and dynamic updates tested",
        "Announcement transcript or concise notes",
        "Focus movement and close/return behavior"
      ]
    },
    {
      id: "images-media",
      title: "Images, media, and non-text content",
      steps: [
        "Navigate informative images, linked logos, icons, charts, and media controls.",
        "Confirm alternatives describe purpose in context and decorative content is skipped or not noisy.",
        "Confirm media controls, captions, transcripts, or text alternatives are discoverable where relevant."
      ],
      evidence: [
        "Images, logos, charts, or media checked",
        "Problematic announcements or missing alternatives",
        "Caption, transcript, or media-control notes"
      ]
    }
  ];
}
