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

export function analyzeNavigationOrderConsistency(
  states: CrossPageStateObservation[],
  framework: Framework | string
): Issue[] {
  const pageSequences = uniquePageStates(states)
    .map((state) => ({
      state,
      links: navigationLinkSequence(state)
    }))
    .filter((item) => item.links.length >= 2);

  if (pageSequences.length < 2) return [];

  const reference = pageSequences[0];
  const issues: Issue[] = [];

  for (const candidate of pageSequences.slice(1)) {
    const sharedLinks = candidate.links.filter((href) => reference.links.includes(href));
    if (sharedLinks.length < 2) continue;

    const referenceOrder = reference.links.filter((href) => sharedLinks.includes(href));
    const candidateOrder = candidate.links.filter((href) => sharedLinks.includes(href));
    if (referenceOrder.join("\u0000") === candidateOrder.join("\u0000")) continue;

    issues.push(createCrossPageIssue({
      framework,
      ruleId: "navigation-order-inconsistent",
      wcag: ["3.2.3"],
      url: candidate.state.url,
      stateId: candidate.state.id,
      stateLabel: candidate.state.actionLabel,
      selector: "nav",
      confidenceScore: 65,
      confidenceReason: "The same navigation link destinations appeared in a different relative order across scanned pages. Confirm whether these are repeated navigation mechanisms before treating this as a defect.",
      message: `Potential inconsistent navigation order. Reference order: ${formatHrefList(referenceOrder)}. Observed order: ${formatHrefList(candidateOrder)}.`
    }));
  }

  return issues;
}

export function analyzeHelpMechanismConsistency(
  states: CrossPageStateObservation[],
  framework: Framework | string
): Issue[] {
  const pages = uniquePageStates(states);
  if (pages.length < 3) return [];

  const pagesWithHelp = pages.filter((state) => (
    (state.interactiveControls || []).some((control) => control.helpCandidate)
  ));
  if (pagesWithHelp.length === 0 || pagesWithHelp.length === pages.length) return [];

  const knownHelpNames = [...new Set(pagesWithHelp.flatMap((state) => (
    (state.interactiveControls || [])
      .filter((control) => control.helpCandidate)
      .map((control) => cleanText(control.name || control.text).toLocaleLowerCase())
      .filter(Boolean)
  )))].slice(0, 5);

  return pages
    .filter((state) => !pagesWithHelp.includes(state))
    .map((state) => createCrossPageIssue({
      framework,
      ruleId: "help-mechanism-inconsistent",
      wcag: ["3.2.6"],
      url: state.url,
      stateId: state.id,
      stateLabel: state.actionLabel,
      selector: "body",
      confidenceScore: 60,
      confidenceReason: "A help, contact, support, chat, or FAQ mechanism was found on some scanned pages but not this page. Confirm whether the scanned pages are in the same set where consistent help is expected.",
      message: `Potential inconsistent help mechanism. Help candidates appeared on ${pagesWithHelp.length} of ${pages.length} scanned pages${knownHelpNames.length ? `, including: ${knownHelpNames.map((name) => `"${name}"`).join(", ")}` : ""}.`
    }));
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

function navigationLinkSequence(state: CrossPageStateObservation): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  const controls = [...(state.interactiveControls || [])]
    .filter((control) => control.inNavigation && cleanText(control.role).toLowerCase() === "link")
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

  for (const control of controls) {
    const href = normalizeHref(control.href, state.url);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    links.push(href);
  }

  return links;
}

function uniquePageStates(states: CrossPageStateObservation[]): CrossPageStateObservation[] {
  const seen = new Set<string>();
  const result: CrossPageStateObservation[] = [];

  for (const state of states) {
    const url = normalizeObservedUrl(state.url);
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(state);
  }

  return result;
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

function createCrossPageIssue(options: {
  framework: Framework | string;
  ruleId: "navigation-order-inconsistent" | "help-mechanism-inconsistent";
  wcag: string[];
  url: string;
  stateId?: string;
  stateLabel?: string;
  selector: string;
  confidenceScore: number;
  confidenceReason: string;
  message: string;
}): Issue {
  return {
    source: "orchestrator",
    framework: options.framework,
    ruleId: options.ruleId,
    wcag: options.wcag,
    tags: ["needs-review"],
    severity: "warning",
    confidence: "medium",
    confidenceScore: options.confidenceScore,
    confidenceReason: options.confidenceReason,
    category: "structure",
    selector: options.selector,
    url: options.url,
    stateId: options.stateId,
    stateLabel: options.stateLabel,
    message: options.message
  };
}

function formatHrefList(values: string[]): string {
  return values.map((value) => {
    try {
      const url = new URL(value);
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  }).join(" -> ");
}
