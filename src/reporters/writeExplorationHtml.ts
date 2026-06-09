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

    .states {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .state {
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 260px;
      overflow: hidden;
    }

    .state img {
      aspect-ratio: 16 / 10;
      background: #eef1f5;
      border-bottom: 1px solid var(--line);
      display: block;
      object-fit: cover;
      width: 100%;
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
      gap: 6px;
    }

    .badge {
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      display: inline-flex;
      font-size: 12px;
      gap: 4px;
      line-height: 1;
      padding: 5px 7px;
      white-space: nowrap;
    }

    .badge-critical {
      border-color: #fecdca;
      color: var(--critical);
    }

    .badge-warning {
      border-color: #fedf89;
      color: var(--warning);
    }

    .badge-info {
      border-color: #b2ddff;
      color: var(--info);
    }

    .badge-ok {
      border-color: #abefc6;
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
      ${metric("Screenshots", graph.summary.screenshots)}
      ${metric("Critical", totals.critical, "critical")}
      ${metric("Warning", totals.warning, "warning")}
      ${metric("Info", totals.info, "info")}
    </section>

    <section class="panel states" aria-label="Checked states">
      ${states.map(renderState).join("\n")}
    </section>

    <section class="panel" aria-label="Exploration edges">
      <h2>State Graph</h2>
      ${renderEdges(graph)}
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
  const issueBadges = state.issues.length > 0
    ? [
      issueSummary.critical ? badge("critical", `${issueSummary.critical} critical`) : "",
      issueSummary.warning ? badge("warning", `${issueSummary.warning} warning`) : "",
      issueSummary.info ? badge("info", `${issueSummary.info} info`) : ""
    ].filter(Boolean).join("")
    : badge("ok", "no findings");

  return `<article class="state" id="${escapeAttribute(state.id)}">
  ${state.screenshot
    ? `<img src="${escapeAttribute(state.screenshot)}" alt="Screenshot for ${escapeAttribute(state.id)}">`
    : `<div class="placeholder">No screenshot</div>`}
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
    return `<p class="muted">No state transitions were recorded.</p>`;
  }

  return `<ul class="edge-list">
    ${graph.edges.map((edge) => `<li class="edge">
      <div><a href="#${escapeAttribute(edge.from)}">${escapeHtml(edge.from)}</a> -> <a href="#${escapeAttribute(edge.to)}">${escapeHtml(edge.to)}</a></div>
      <div class="muted">${escapeHtml(edge.action.label)}</div>
      ${edge.action.selector ? `<div><code>${escapeHtml(edge.action.selector)}</code></div>` : ""}
    </li>`).join("\n")}
  </ul>`;
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
