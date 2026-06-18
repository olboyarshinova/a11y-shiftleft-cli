import fs from "node:fs/promises";
import path from "node:path";
import type { DedupedIssue, ExplorationGraph, ExplorationState, Severity } from "../types.js";

interface StateViewModel extends ExplorationState {
  issues: DedupedIssue[];
}

export async function writeExplorationHtml(
  outputDir: string,
  graph: ExplorationGraph,
  issues: DedupedIssue[]
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "exploration.html"),
    renderExplorationHtml(graph, issues)
  );
}

export function renderExplorationHtml(
  graph: ExplorationGraph,
  issues: DedupedIssue[]
): string {
  const states = graph.states.map((state) => ({
    ...state,
    issues: issues.filter((issue) => issue.stateId === state.id)
  }));
  const totals = summarizeIssues(issues);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>a11y-shiftleft exploration report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #1e2430;
      --muted: #5d6675;
      --line: #d9dde5;
      --critical: #b42318;
      --warning: #b54708;
      --warning-marker: #f97316;
      --info: #175cd3;
      --ok: #067647;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    header {
      background: var(--panel);
      border-bottom: 1px solid var(--line);
      padding: 24px;
    }

    h1,
    h2,
    h3,
    p {
      margin-top: 0;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 4px;
    }

    h2 {
      font-size: 16px;
      margin-bottom: 12px;
    }

    main {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(0, 1fr);
      padding: 16px;
    }

    .summary {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .metric,
    .panel,
    .state {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .metric {
      padding: 14px;
    }

    .metric strong {
      display: block;
      font-size: 22px;
      line-height: 1.1;
    }

    .metric span,
    .muted {
      color: var(--muted);
    }

    .panel {
      padding: 16px;
      overflow: hidden;
    }

    .triage-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }

    .triage-list {
      display: grid;
      gap: 10px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .triage-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      display: grid;
      gap: 6px;
      padding: 10px;
    }

    .triage-title {
      align-items: start;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }

    .triage-title a,
    .edge a {
      color: inherit;
    }

    .states {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
    }

    .state {
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 340px;
      overflow: hidden;
    }

    .state-critical {
      border-color: #e59a92;
      box-shadow: inset 4px 0 0 var(--critical);
    }

    .state-critical .state-body {
      background: #fff7f6;
    }

    .state-warning {
      border-color: #f7a45a;
      box-shadow: inset 4px 0 0 var(--warning-marker);
    }

    .state-warning .state-body {
      background: #fff8f1;
    }

    .state-info {
      border-color: #9fc3f5;
      box-shadow: inset 4px 0 0 var(--info);
    }

    .state-info .state-body {
      background: #f7faff;
    }

    .state-ok {
      border-color: #a6d8c3;
      box-shadow: inset 4px 0 0 var(--ok);
    }

    .state img {
      aspect-ratio: 16 / 10;
      background: #eef1f5;
      display: block;
      object-fit: contain;
      width: 100%;
    }

    .screenshot-frame {
      background: #eef1f5;
      border-bottom: 1px solid var(--line);
      position: relative;
    }

    .screenshot-open {
      background: rgb(255 255 255 / 92%);
      border: 1px solid var(--line);
      border-radius: 4px;
      bottom: 8px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      padding: 5px 7px;
      position: absolute;
      right: 8px;
      text-decoration: none;
    }

    .screenshot-lightbox {
      align-items: center;
      background: rgb(30 36 48 / 82%);
      display: none;
      inset: 0;
      padding: 24px;
      position: fixed;
      z-index: 20;
    }

    .screenshot-lightbox:target {
      display: grid;
    }

    .screenshot-lightbox-inner {
      background: var(--panel);
      border-radius: 8px;
      display: grid;
      gap: 12px;
      margin: 0 auto;
      max-height: calc(100vh - 48px);
      max-width: min(1200px, 100%);
      overflow: auto;
      padding: 14px;
      width: 100%;
    }

    .screenshot-lightbox-frame {
      background: #eef1f5;
      position: relative;
    }

    .screenshot-lightbox-frame img {
      max-height: calc(100vh - 150px);
      object-fit: contain;
    }

    .lightbox-header {
      align-items: start;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }

    .lightbox-close {
      color: var(--ink);
      font-weight: 700;
    }

    .annotation {
      border: 2px solid var(--warning-marker);
      border-radius: 4px;
      background: rgb(249 115 22 / 10%);
      box-shadow: 0 0 0 1px rgb(249 115 22 / 28%);
      min-height: 10px;
      min-width: 10px;
      pointer-events: none;
      position: absolute;
    }

    .annotation-critical {
      background: rgb(180 35 24 / 10%);
      border-color: var(--critical);
      box-shadow: 0 0 0 1px rgb(180 35 24 / 30%);
    }

    .annotation-warning {
      background: rgb(249 115 22 / 10%);
      border-color: var(--warning-marker);
      box-shadow: 0 0 0 1px rgb(249 115 22 / 28%);
    }

    .annotation-info {
      background: rgb(23 92 211 / 8%);
      border-color: var(--info);
      box-shadow: 0 0 0 1px rgb(23 92 211 / 22%);
    }

    .state-body {
      display: grid;
      gap: 10px;
      padding: 12px;
    }

    .state-title {
      align-items: start;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }

    .state-title h3 {
      font-size: 14px;
      margin-bottom: 2px;
      word-break: break-word;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
    }

    .badge {
      color: var(--muted);
      display: inline-flex;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.35;
      white-space: nowrap;
    }

    .badge + .badge::before {
      color: var(--muted);
      content: "•";
      font-weight: 400;
      margin-right: 10px;
    }

    .badge-critical {
      color: var(--critical);
    }

    .badge-warning {
      color: var(--warning);
    }

    .badge-info {
      color: var(--info);
    }

    .badge-ok {
      color: var(--ok);
    }

    .issue-list,
    .edge-list {
      display: grid;
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .issue,
    .edge {
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }

    .issue code,
    .edge code {
      background: #eef1f5;
      border-radius: 4px;
      padding: 2px 4px;
      word-break: break-word;
    }

    details {
      border-top: 1px solid var(--line);
      padding-top: 10px;
    }

    details + details {
      margin-top: 12px;
    }

    summary {
      cursor: pointer;
      font-weight: 700;
      list-style-position: outside;
    }

    summary + .muted,
    summary + .edge-list {
      margin-top: 10px;
    }

    .url {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .placeholder {
      align-items: center;
      aspect-ratio: 16 / 10;
      background: #eef1f5;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      display: flex;
      justify-content: center;
    }

    @media (min-width: 1100px) {
      main {
        grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
      }

      .summary,
      .triage,
      .states {
        grid-column: 1 / -1;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>a11y-shiftleft exploration report</h1>
    <p class="muted">Generated ${escapeHtml(graph.generatedAt)} from ${escapeHtml(graph.startUrl)}</p>
  </header>
  <main>
    <section class="summary" aria-label="Exploration summary">
      ${metric("States visited", graph.summary.statesVisited)}
      ${metric("Actions tried", graph.summary.actionsTried)}
      ${metric("Actions skipped", graph.summary.skippedActions || 0)}
      ${metric("Screenshots", graph.summary.screenshots)}
      ${metric("Critical", totals.critical, "critical")}
      ${metric("Warning", totals.warning, "warning")}
      ${metric("Info", totals.info, "info")}
    </section>

    <section class="panel triage" aria-label="Triage overview">
      ${renderTriageOverview(states, issues)}
    </section>

    <section class="panel states" aria-label="Checked states">
      ${states.map(renderState).join("\n")}
    </section>

    <section class="panel" aria-label="Exploration details">
      <h2>Exploration Details</h2>
      <p class="muted">Use this section for debugging how the page was explored. Start with Triage Overview and Checked States when deciding what to fix.</p>
      ${renderEdges(graph)}
      ${renderSkippedActions(graph)}
    </section>

    <section class="panel" aria-label="Manual review note">
      <h2>Coverage Note</h2>
      <p class="muted">This report shows automated exploration evidence only. It does not certify WCAG, ADA, or Section 508 compliance. Manual keyboard, screen reader, content, and task-flow review is still required.</p>
    </section>
  </main>
</body>
</html>
`;
}

function renderState(state: StateViewModel): string {
  const issueSummary = summarizeIssues(state.issues);
  const stateSeverity = issueSummary.critical > 0
    ? "critical"
    : issueSummary.warning > 0
      ? "warning"
      : issueSummary.info > 0
        ? "info"
        : "ok";
  const issueBadges = state.issues.length > 0
    ? [
      issueSummary.critical ? badge("critical", `${issueSummary.critical} critical`) : "",
      issueSummary.warning ? badge("warning", `${issueSummary.warning} warning`) : "",
      issueSummary.info ? badge("info", `${issueSummary.info} info`) : ""
    ].filter(Boolean).join("")
    : badge("ok", "no findings");

  return `<article class="state state-${stateSeverity}" id="${escapeAttribute(state.id)}">
  ${renderStateScreenshot(state)}
  <div class="state-body">
    <div class="state-title">
      <div>
        <h3>${escapeHtml(state.id)}: ${escapeHtml(state.actionLabel)}</h3>
        <div class="url">${escapeHtml(state.url)}</div>
      </div>
      <span class="badge">depth ${state.depth}</span>
    </div>
    <div class="badges">
      ${issueBadges}
      <span class="badge">${state.actionCount} actions queued</span>
    </div>
    ${renderIssues(state.issues)}
  </div>
</article>`;
}

function renderStateScreenshot(state: StateViewModel): string {
  if (!state.screenshot) {
    return `<div class="placeholder">No screenshot</div>`;
  }

  const annotations = state.issues
    .filter((issue) => issue.elementBounds)
    .slice(0, 12)
    .map((issue, index) => renderAnnotation(issue, index + 1))
    .join("\n");
  const screenshotTargetId = `screenshot-${state.id}`;

  return `<div class="screenshot-frame">
    <img src="${escapeAttribute(state.screenshot)}" alt="Screenshot for ${escapeAttribute(state.id)}">
    ${annotations}
    <a class="screenshot-open" href="#${escapeAttribute(screenshotTargetId)}">Open annotated screenshot</a>
  </div>
  ${renderAnnotatedScreenshotView(state, annotations, screenshotTargetId)}`;
}

function renderAnnotatedScreenshotView(
  state: StateViewModel,
  annotations: string,
  screenshotTargetId: string
): string {
  if (!state.screenshot) return "";

  return `<div class="screenshot-lightbox" id="${escapeAttribute(screenshotTargetId)}" role="dialog" aria-label="Annotated screenshot for ${escapeAttribute(state.id)}">
    <div class="screenshot-lightbox-inner">
      <div class="lightbox-header">
        <div>
          <h2>${escapeHtml(state.id)}: ${escapeHtml(state.actionLabel)}</h2>
          <div class="url">${escapeHtml(state.url)}</div>
        </div>
        <a class="lightbox-close" href="#${escapeAttribute(state.id)}">Close</a>
      </div>
      <div class="screenshot-lightbox-frame">
        <img src="${escapeAttribute(state.screenshot)}" alt="Annotated screenshot for ${escapeAttribute(state.id)}">
        ${annotations}
      </div>
    </div>
  </div>`;
}

function renderAnnotation(issue: DedupedIssue, index: number): string {
  const bounds = issue.elementBounds;
  if (!bounds) return "";

  return `<span
    class="annotation annotation-${issue.severity}"
    title="${escapeAttribute(`${index}. ${issue.severity} ${issue.ruleId}: ${issue.message}`)}"
    style="${formatBoundsStyle(bounds)}"
  ></span>`;
}

function formatBoundsStyle(bounds: NonNullable<DedupedIssue["elementBounds"]>): string {
  return [
    `left: ${bounds.x}%`,
    `top: ${bounds.y}%`,
    `width: ${bounds.width}%`,
    `height: ${bounds.height}%`
  ].join("; ");
}

function renderTriageOverview(states: StateViewModel[], issues: DedupedIssue[]): string {
  return `<h2>Triage Overview</h2>
  <div class="triage-grid">
    <div>
      <h3>Most Affected States</h3>
      ${renderTopStates(states)}
    </div>
    <div>
      <h3>Top Rules</h3>
      ${renderTopRules(issues)}
    </div>
  </div>`;
}

function renderTopStates(states: StateViewModel[]): string {
  const rankedStates = states
    .map((state) => ({
      ...state,
      severityScore: sumSeverityScore(state.issues)
    }))
    .filter((state) => state.issues.length > 0)
    .sort((a, b) => {
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
      if (b.issues.length !== a.issues.length) return b.issues.length - a.issues.length;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 6);

  if (rankedStates.length === 0) {
    return `<p class="muted">No affected states were detected by automated exploration.</p>`;
  }

  return `<ol class="triage-list">
    ${rankedStates.map((state) => {
      const summary = summarizeIssues(state.issues);
      return `<li class="triage-item">
        <div class="triage-title">
          <a href="#${escapeAttribute(state.id)}"><strong>${escapeHtml(state.id)}</strong></a>
          <span class="badge">score ${state.severityScore}</span>
        </div>
        <div class="url">${escapeHtml(state.url)}</div>
        <div class="badges">
          ${summary.critical ? badge("critical", `${summary.critical} critical`) : ""}
          ${summary.warning ? badge("warning", `${summary.warning} warning`) : ""}
          ${summary.info ? badge("info", `${summary.info} info`) : ""}
        </div>
      </li>`;
    }).join("\n")}
  </ol>`;
}

function renderTopRules(issues: DedupedIssue[]): string {
  const ruleSummaries = summarizeRules(issues).slice(0, 8);

  if (ruleSummaries.length === 0) {
    return `<p class="muted">No rule findings were detected by automated exploration.</p>`;
  }

  return `<ol class="triage-list">
    ${ruleSummaries.map((rule) => `<li class="triage-item">
      <div class="triage-title">
        <code>${escapeHtml(rule.ruleId)}</code>
        <span class="badge">score ${rule.severityScore}</span>
      </div>
      <div class="badges">
        ${rule.critical ? badge("critical", `${rule.critical} critical`) : ""}
        ${rule.warning ? badge("warning", `${rule.warning} warning`) : ""}
        ${rule.info ? badge("info", `${rule.info} info`) : ""}
      </div>
      ${rule.criteria.length > 0 ? `<div class="url">${escapeHtml(rule.criteria.join(", "))}</div>` : ""}
      ${rule.states.length > 0 ? `<div class="url">States: ${rule.states.map((stateId) => `<a href="#${escapeAttribute(stateId)}">${escapeHtml(stateId)}</a>`).join(", ")}</div>` : ""}
    </li>`).join("\n")}
  </ol>`;
}

function renderIssues(issues: DedupedIssue[]): string {
  if (issues.length === 0) {
    return `<p class="muted">No automated findings in this state.</p>`;
  }

  return `<ul class="issue-list">
    ${issues.slice(0, 8).map((issue) => `<li class="issue">
      <div>${severityBadge(issue.severity)} <code>${escapeHtml(issue.ruleId)}</code></div>
      <div>${escapeHtml(issue.message)}</div>
      ${issue.selector ? `<div class="url">${escapeHtml(issue.selector)}</div>` : ""}
    </li>`).join("\n")}
  </ul>`;
}

function renderEdges(graph: ExplorationGraph): string {
  if (graph.edges.length === 0) {
    return `<details>
      <summary>State transitions: 0</summary>
      <p class="muted">No state transitions were recorded.</p>
    </details>`;
  }

  const visibleEdges = graph.edges.slice(0, 12);
  const hiddenCount = graph.edges.length - visibleEdges.length;

  return `<details>
    <summary>State transitions: ${graph.edges.length}</summary>
    <p class="muted">Transition details are mainly useful for debugging crawl coverage. Full data is available in <code>exploration-graph.json</code>.</p>
    <ul class="edge-list">
    ${visibleEdges.map((edge) => `<li class="edge">
      <div><a href="#${escapeAttribute(edge.from)}">${escapeHtml(edge.from)}</a> -> <a href="#${escapeAttribute(edge.to)}">${escapeHtml(edge.to)}</a></div>
      <div class="muted">${escapeHtml(edge.action.label)}</div>
      ${edge.action.selector ? `<div><code>${escapeHtml(edge.action.selector)}</code></div>` : ""}
    </li>`).join("\n")}
  </ul>
  ${hiddenCount > 0 ? `<p class="muted">${hiddenCount} more transitions are available in <code>exploration-graph.json</code>.</p>` : ""}
  </details>`;
}

function renderSkippedActions(graph: ExplorationGraph): string {
  const skippedActions = graph.skippedActions || [];

  if (skippedActions.length === 0) {
    return `<details>
      <summary>Skipped actions: 0</summary>
      <p class="muted">No skipped actions were recorded.</p>
    </details>`;
  }

  const visibleActions = skippedActions.slice(0, 20);
  const hiddenCount = skippedActions.length - visibleActions.length;

  return `<details>
    <summary>Skipped actions: ${skippedActions.length}</summary>
    <p class="muted">Skipped actions are usually safety decisions, such as avoiding submit, payment, logout, or destructive controls.</p>
    <ul class="edge-list">
    ${visibleActions.map((action) => `<li class="edge">
      <div><a href="#${escapeAttribute(action.stateId)}">${escapeHtml(action.stateId)}</a>: ${escapeHtml(action.label)}</div>
      <div class="muted">${escapeHtml(action.reason)}</div>
      ${action.selector ? `<div><code>${escapeHtml(action.selector)}</code></div>` : ""}
      ${action.url ? `<div class="url">${escapeHtml(action.url)}</div>` : ""}
    </li>`).join("\n")}
  </ul>
  ${hiddenCount > 0 ? `<p class="muted">${hiddenCount} more skipped actions are available in <code>exploration-graph.json</code>.</p>` : ""}
  </details>`;
}

function metric(label: string, value: number, severity?: Severity): string {
  const className = severity ? `metric metric-${severity}` : "metric";

  return `<div class="${className}">
    <strong>${value}</strong>
    <span>${escapeHtml(label)}</span>
  </div>`;
}

function severityBadge(severity: Severity): string {
  return badge(severity, severity);
}

function badge(kind: Severity | "ok", label: string): string {
  return `<span class="badge badge-${kind}">${escapeHtml(label)}</span>`;
}

function summarizeIssues(issues: DedupedIssue[]): Record<Severity, number> {
  return issues.reduce<Record<Severity, number>>((summary, issue) => {
    summary[issue.severity] += 1;
    return summary;
  }, {
    critical: 0,
    warning: 0,
    info: 0
  });
}

function summarizeRules(issues: DedupedIssue[]): Array<{
  ruleId: string;
  critical: number;
  warning: number;
  info: number;
  severityScore: number;
  states: string[];
  criteria: string[];
}> {
  const summaries = new Map<string, {
    ruleId: string;
    critical: number;
    warning: number;
    info: number;
    severityScore: number;
    states: Set<string>;
    criteria: Set<string>;
  }>();

  for (const issue of issues) {
    const summary = summaries.get(issue.ruleId) || {
      ruleId: issue.ruleId,
      critical: 0,
      warning: 0,
      info: 0,
      severityScore: 0,
      states: new Set<string>(),
      criteria: new Set<string>()
    };

    summary[issue.severity] += 1;
    summary.severityScore += severityScore(issue.severity);
    if (issue.stateId) summary.states.add(issue.stateId);
    for (const criterion of issue.wcagCriteria || []) {
      summary.criteria.add(`WCAG ${criterion.id} ${criterion.title}, Level ${criterion.level}`);
    }
    summaries.set(issue.ruleId, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      states: [...summary.states].sort(),
      criteria: [...summary.criteria].sort()
    }))
    .sort((a, b) => {
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
      const totalA = a.critical + a.warning + a.info;
      const totalB = b.critical + b.warning + b.info;
      if (totalB !== totalA) return totalB - totalA;
      return a.ruleId.localeCompare(b.ruleId);
    });
}

function sumSeverityScore(issues: DedupedIssue[]): number {
  return issues.reduce((total, issue) => total + severityScore(issue.severity), 0);
}

function severityScore(severity: Severity): number {
  if (severity === "critical") return 5;
  if (severity === "warning") return 2;
  return 1;
}

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string | undefined): string {
  return escapeHtml(value)
    .replace(/"/g, "&quot;");
}
