import type { Framework, InteractiveControlEvidence, Issue } from "../types.js";

export interface CrossPageStateObservation {
  id?: string;
  url: string;
  actionLabel?: string;
  interactiveControls?: InteractiveControlEvidence[];
}

interface ControlObservation {
  state: CrossPageStateObservation;
  control: InteractiveControlEvidence;
  name: string;
  purposeKey: string;
}

const STABLE_SELECTOR_PATTERN = /^\[(?:id|data-testid|data-test)=/;

export function analyzeControlNameConsistency(
  states: CrossPageStateObservation[],
  framework: Framework | string
): Issue[] {
  const observations = collectControlObservations(states);
  const byPurpose = new Map<string, ControlObservation[]>();

  for (const observation of observations) {
    const matching = byPurpose.get(observation.purposeKey) || [];
    matching.push(observation);
    byPurpose.set(observation.purposeKey, matching);
  }

  const issues: Issue[] = [];

  for (const group of byPurpose.values()) {
    const distinctUrls = [...new Set(group.map((item) => normalizeObservedUrl(item.state.url)))];
    if (distinctUrls.length < 2) continue;

    const distinctNames = [...new Set(group.map((item) => normalizeControlName(item.name)))];
    if (distinctNames.length < 2) continue;

    for (const observation of firstObservationPerUrl(group)) {
      issues.push({
        source: "orchestrator",
        framework,
        ruleId: "control-name-inconsistent",
        wcag: ["3.2.4"],
        tags: ["needs-review"],
        severity: "warning",
        confidence: "medium",
        confidenceScore: 70,
        confidenceReason: "The same link destination or stable control selector was found with different accessible names across distinct pages. Confirm whether the controls have the same purpose before treating this as a defect.",
        category: "structure",
        selector: observation.control.selector || "body",
        url: observation.state.url,
        stateId: observation.state.id,
        stateLabel: observation.state.actionLabel,
        message: `Potential inconsistent accessible name for the same-purpose ${observation.control.role || "control"}. Observed names: ${distinctNames.map((name) => `"${name}"`).join(", ")}.`
      });
    }
  }

  return issues;
}

function collectControlObservations(states: CrossPageStateObservation[]): ControlObservation[] {
  const observations: ControlObservation[] = [];

  for (const state of states) {
    const pageUrl = normalizeObservedUrl(state.url);
    for (const control of state.interactiveControls || []) {
      const name = cleanText(control.name || control.text);
      if (!name) continue;

      const purposeKey = controlPurposeKey(control, pageUrl);
      if (!purposeKey) continue;

      observations.push({ state, control, name, purposeKey });
    }
  }

  return observations;
}

function controlPurposeKey(control: InteractiveControlEvidence, pageUrl: string): string | undefined {
  const role = cleanText(control.role).toLowerCase();
  const href = normalizeHref(control.href, pageUrl);
  if (role === "link" && href) return `link:${href}`;

  if (STABLE_SELECTOR_PATTERN.test(control.selector || "")) {
    return `${role || "control"}:${control.selector}`;
  }

  return undefined;
}

function firstObservationPerUrl(group: ControlObservation[]): ControlObservation[] {
  const seen = new Set<string>();
  const result: ControlObservation[] = [];

  for (const observation of group) {
    const url = normalizeObservedUrl(observation.state.url);
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(observation);
  }

  return result;
}

function normalizeHref(value: string | undefined, pageUrl: string): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value, pageUrl);
    url.hash = "";
    return url.href;
  } catch {
    return cleanText(value);
  }
}

function normalizeObservedUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

function normalizeControlName(value: string): string {
  return cleanText(value).toLocaleLowerCase();
}

function cleanText(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}
