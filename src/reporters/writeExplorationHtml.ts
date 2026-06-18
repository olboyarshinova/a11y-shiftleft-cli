import fs from "node:fs/promises";
import path from "node:path";
import { enrichIssueEvidence } from "../core/classification.js";
import { formatReportDateUtc } from "../core/reportDate.js";
import { getRemediationHint } from "../core/remediation.js";
import { summarizeRootCauses } from "../core/rootCauses.js";
import type { DedupedIssue, ExplorationGraph, ExplorationState, RootCauseGroup, Severity } from "../types.js";

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
  const reportIssues = issues.map((issue) => issue.findingType
    ? issue
    : enrichIssueEvidence(issue));
  const states = graph.states.map((state) => ({
    ...state,
    issues: reportIssues.filter((issue) => issue.stateId === state.id)
  }));
  const totals = summarizeIssues(reportIssues);
  const findingTypes = countFindingTypes(reportIssues);
  const rootCauseGroups = summarizeRootCauses(reportIssues);

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

    .screenshot-frame {
      aspect-ratio: 16 / 9;
      background: #eef1f5;
      border-bottom: 1px solid var(--line);
      overflow: hidden;
      position: relative;
    }

    .screenshot-evidence-grid {
      background: #eef1f5;
      display: grid;
      gap: 1px;
      grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
    }

    .screenshot-evidence-grid .screenshot-frame {
      border: 0;
    }

    .screenshot-stage {
      line-height: 0;
      position: relative;
      width: 100%;
    }

    .screenshot-frame .screenshot-stage {
      height: 100%;
    }

    .screenshot-frame .screenshot-stage > img {
      background: #eef1f5;
      display: block;
      height: 100%;
      object-fit: contain;
      object-position: center;
      width: 100%;
    }

    .screenshot-frame-full .screenshot-stage > img {
      object-fit: contain;
      object-position: center;
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
      z-index: 2;
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

    .screenshot-lightbox-frame .screenshot-stage > img {
      display: block;
      height: auto;
      max-height: none;
      object-fit: contain;
      width: 100%;
    }

    .annotation-layer {
      inset: 0;
      pointer-events: none;
      position: absolute;
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

    .contrast-evidence {
      background: #f6f7f9;
      border-left: 3px solid var(--info);
      display: grid;
      gap: 7px;
      margin-top: 8px;
      padding: 9px 10px;
    }

    .contrast-colors,
    .contrast-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px 14px;
    }

    .contrast-color {
      align-items: center;
      display: inline-flex;
      gap: 6px;
    }

    .color-swatch {
      border: 1px solid #717784;
      display: inline-block;
      flex: 0 0 18px;
      height: 18px;
      width: 18px;
    }

    .contrast-evidence code {
      background: #e7eaf0;
    }

    .remediation {
      background: #f4fbf7;
      border-left: 3px solid var(--ok);
      border-top: 0;
      margin-top: 8px;
      padding: 9px 10px;
    }

    .remediation-body {
      display: grid;
      gap: 7px;
      padding-top: 7px;
    }

    .remediation ol {
      margin: 0;
      padding-left: 20px;
    }

    .remediation pre {
      background: #e8f4ed;
      margin: 0;
      overflow-x: auto;
      padding: 8px;
      white-space: pre-wrap;
    }

    .remediation-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
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

    .screenshot-reference {
      align-items: center;
      aspect-ratio: 16 / 10;
      background: #f8fafc;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      display: flex;
      flex-direction: column;
      gap: 8px;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }

    .screenshot-reference a {
      color: var(--info);
      font-weight: 700;
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
    <p class="muted">Generated: <time datetime="${escapeAttribute(graph.generatedAt)}">${escapeHtml(formatReportDateUtc(graph.generatedAt))}</time><br>Start URL: ${escapeHtml(graph.startUrl)}</p>
  </header>
  <main>
    <section class="summary" aria-label="Exploration summary">
      ${metric("UI states explored", graph.summary.uiStatesVisited ?? graph.summary.statesVisited)}
      ${metric("Rendered states", graph.summary.statesVisited)}
      ${metric("Actions tried", graph.summary.actionsTried)}
      ${metric("Actions skipped", graph.summary.skippedActions || 0)}
      ${metric("Unique screenshots", graph.summary.screenshots)}
      ${graph.summary.duplicateScreenshots
        ? metric("Duplicate screenshots skipped", graph.summary.duplicateScreenshots)
        : ""}
      ${metric("Critical", totals.critical, "critical")}
      ${metric("Warning", totals.warning, "warning")}
      ${metric("Info", totals.info, "info")}
      ${metric("WCAG findings", findingTypes.wcag)}
      ${metric("Best practices", findingTypes["best-practice"])}
      ${metric("Likely root causes", rootCauseGroups.length)}
    </section>

    <section class="panel triage" aria-label="Triage overview">
      ${renderTriageOverview(states, reportIssues, rootCauseGroups)}
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
      ${state.colorScheme ? `<span class="badge">${escapeHtml(state.colorScheme)} color scheme</span>` : ""}
      ${state.screenshotFullPage ? `<span class="badge">full-page evidence</span>` : ""}
      ${state.screenshotEvidence?.some((evidence) => evidence.kind === "error-crop")
        ? `<span class="badge">${state.screenshotEvidence.length} focused evidence capture${state.screenshotEvidence.length === 1 ? "" : "s"}</span>`
        : ""}
      ${state.visualDuplicateOf ? `<span class="badge">visual reused from ${escapeHtml(state.visualDuplicateOf)}</span>` : ""}
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

  const evidence = state.screenshotEvidence?.length
    ? state.screenshotEvidence
    : [{
      path: state.screenshot,
      kind: state.screenshotFullPage ? "full-page" as const : "viewport" as const,
      issueCount: state.issues.length
    }];
  const firstTargetId = `screenshot-${state.id}`;

  if (state.visualDuplicateOf && evidence.length === 1) {
    const annotations = annotationsForEvidence(state, evidence[0].path);
    return `<div class="screenshot-reference">
      <strong>Duplicate visual not stored again</strong>
      <span>Same pixels as <a href="#${escapeAttribute(state.visualDuplicateOf)}">${escapeHtml(state.visualDuplicateOf)}</a>.</span>
      <a href="#${escapeAttribute(firstTargetId)}">Open this state's annotated evidence</a>
    </div>
    ${renderAnnotatedScreenshotView(state, evidence[0].path, annotations, firstTargetId)}`;
  }

  return `<div class="screenshot-evidence-grid">
    ${evidence.map((item, index) => renderEvidenceFrame(state, item, index)).join("\n")}
  </div>`;
}

function renderEvidenceFrame(
  state: StateViewModel,
  evidence: NonNullable<ExplorationState["screenshotEvidence"]>[number],
  index: number
): string {
  const previewAnnotations = annotationsForEvidence(state, evidence.path, evidence);
  const lightboxAnnotations = annotationsForEvidence(state, evidence.path);
  const targetId = index === 0
    ? `screenshot-${state.id}`
    : `screenshot-${state.id}-${index + 1}`;
  const fullPage = evidence.kind === "full-page";
  const frameClass = fullPage
    ? "screenshot-frame screenshot-frame-full"
    : "screenshot-frame";
  const openLabel = fullPage
    ? "Open full-page evidence"
    : evidence.kind === "error-crop"
      ? `Open error evidence ${index + 1}`
      : "Open annotated screenshot";
  const screenshotAlt = fullPage
    ? `Full-page evidence for ${state.id}`
    : evidence.kind === "error-crop"
      ? `Focused error evidence ${index + 1} for ${state.id}`
      : `Screenshot for ${state.id}`;

  return `<div class="${frameClass}">
    <div class="screenshot-stage">
      <img src="${escapeAttribute(evidence.path)}" alt="${escapeAttribute(screenshotAlt)}">
      ${renderAnnotationLayer(previewAnnotations)}
    </div>
    <a class="screenshot-open" href="#${escapeAttribute(targetId)}">${openLabel}</a>
  </div>
  ${renderAnnotatedScreenshotView(state, evidence.path, lightboxAnnotations, targetId)}`;
}

function annotationsForEvidence(
  state: StateViewModel,
  screenshot: string,
  evidence?: NonNullable<ExplorationState["screenshotEvidence"]>[number]
): string {
  const matchingIssues = state.issues.filter((issue) => issue.screenshot === screenshot);
  const issues = matchingIssues.length > 0 ? matchingIssues : state.issues;

  return issues
    .filter((issue) => issue.elementBounds)
    .slice(0, 12)
    .map((issue, index) => renderAnnotation(issue, index + 1, evidence))
    .join("\n");
}

function renderAnnotatedScreenshotView(
  state: StateViewModel,
  screenshot: string,
  annotations: string,
  screenshotTargetId: string
): string {
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
        <div class="screenshot-stage">
          <img src="${escapeAttribute(screenshot)}" alt="Annotated screenshot for ${escapeAttribute(state.id)}">
          ${renderAnnotationLayer(annotations)}
        </div>
      </div>
    </div>
  </div>`;
}

function renderAnnotationLayer(annotations: string): string {
  if (!annotations.trim()) return "";
  return `<div class="annotation-layer" aria-hidden="true">${annotations}</div>`;
}

function renderAnnotation(
  issue: DedupedIssue,
  index: number,
  evidence?: NonNullable<ExplorationState["screenshotEvidence"]>[number]
): string {
  const bounds = issue.elementBounds;
  if (!bounds) return "";

  const renderedBounds = evidence?.width && evidence.height
    ? transformBoundsForContainedPreview(bounds, evidence.width, evidence.height)
    : bounds;

  return `<span
    class="annotation annotation-${issue.severity}"
    title="${escapeAttribute(`${index}. ${issue.severity} ${issue.ruleId}: ${issue.message}`)}"
    style="${formatBoundsStyle(renderedBounds)}"
  ></span>`;
}

export function transformBoundsForContainedPreview(
  bounds: NonNullable<DedupedIssue["elementBounds"]>,
  imageWidth: number,
  imageHeight: number,
  frameAspectRatio = 16 / 9
): NonNullable<DedupedIssue["elementBounds"]> {
  if (
    !Number.isFinite(imageWidth)
    || !Number.isFinite(imageHeight)
    || !Number.isFinite(frameAspectRatio)
    || imageWidth <= 0
    || imageHeight <= 0
    || frameAspectRatio <= 0
  ) {
    return bounds;
  }

  const imageAspectRatio = imageWidth / imageHeight;
  if (imageAspectRatio > frameAspectRatio) {
    const renderedHeight = frameAspectRatio / imageAspectRatio;
    return {
      ...bounds,
      y: roundPreviewPercent(((1 - renderedHeight) / 2) * 100 + bounds.y * renderedHeight),
      height: roundPreviewPercent(bounds.height * renderedHeight)
    };
  }

  const renderedWidth = imageAspectRatio / frameAspectRatio;
  return {
    ...bounds,
    x: roundPreviewPercent(((1 - renderedWidth) / 2) * 100 + bounds.x * renderedWidth),
    width: roundPreviewPercent(bounds.width * renderedWidth)
  };
}

function roundPreviewPercent(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatBoundsStyle(bounds: NonNullable<DedupedIssue["elementBounds"]>): string {
  return [
    `left: ${bounds.x}%`,
    `top: ${bounds.y}%`,
    `width: ${bounds.width}%`,
    `height: ${bounds.height}%`
  ].join("; ");
}

function renderTriageOverview(
  states: StateViewModel[],
  issues: DedupedIssue[],
  rootCauseGroups: RootCauseGroup[]
): string {
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
    <div>
      <h3>Likely Root Causes</h3>
      ${renderRootCauseGroups(rootCauseGroups)}
    </div>
  </div>`;
}

function renderRootCauseGroups(groups: RootCauseGroup[]): string {
  if (groups.length === 0) {
    return `<p class="muted">No root-cause candidates were generated.</p>`;
  }

  const renderGroup = (group: RootCauseGroup): string => `<li class="triage-item">
      <div class="triage-title">
        <code>${escapeHtml(group.ruleId)}</code>
        <span class="badge">${group.occurrenceCount} occurrence${group.occurrenceCount === 1 ? "" : "s"}</span>
      </div>
      <div class="badges">
        ${findingTypeBadge(group.findingType)}
        <span class="badge">${group.affectedPages.length} page${group.affectedPages.length === 1 ? "" : "s"}</span>
        ${(group.affectedColorSchemes || []).map((scheme) => `<span class="badge">${escapeHtml(scheme)} color scheme</span>`).join("")}
      </div>
      <div class="url">${escapeHtml(group.targetPattern)}</div>
    </li>`;
  const visibleGroups = groups.slice(0, 8);
  const remainingGroups = groups.slice(8);

  return `<ol class="triage-list">
    ${visibleGroups.map(renderGroup).join("\n")}
  </ol>
  ${remainingGroups.length > 0 ? `<details>
    <summary>Show ${remainingGroups.length} more root cause${remainingGroups.length === 1 ? "" : "s"}</summary>
    <ol class="triage-list">${remainingGroups.map(renderGroup).join("\n")}</ol>
  </details>` : ""}
  <p class="muted">Groups are heuristic and keep individual page evidence below.</p>`;
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
        ${findingTypeBadge(rule.findingType)}
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

  const renderIssue = (issue: DedupedIssue): string => `<li class="issue">
      <div>${severityBadge(issue.severity)} ${findingTypeBadge(issue.findingType)} <code>${escapeHtml(issue.ruleId)}</code></div>
      ${issue.colorScheme ? `<div class="badges"><span class="badge">${escapeHtml(issue.colorScheme)} color scheme</span></div>` : ""}
      <div>${escapeHtml(issue.message)}</div>
      ${issue.selector ? `<div class="url">${escapeHtml(issue.selector)}</div>` : ""}
      ${renderContrastEvidence(issue)}
      ${renderRemediation(issue)}
    </li>`;
  const visibleIssues = issues.slice(0, 8);
  const remainingIssues = issues.slice(8);

  return `<ul class="issue-list">
    ${visibleIssues.map(renderIssue).join("\n")}
  </ul>
  ${remainingIssues.length > 0 ? `<details>
    <summary>Show ${remainingIssues.length} more finding${remainingIssues.length === 1 ? "" : "s"}</summary>
    <ul class="issue-list">${remainingIssues.map(renderIssue).join("\n")}</ul>
  </details>` : ""}`;
}

function renderRemediation(issue: DedupedIssue): string {
  const remediation = issue.remediation || getRemediationHint(
    issue.ruleId,
    issue.wcagCriteria,
    issue.framework,
    { helpUrl: issue.helpUrl }
  );
  const steps = remediation.howToFix.length > 0
    ? `<ol>${remediation.howToFix.map((step) => `<li>${escapeHtml(step)}</li>`).join("\n")}</ol>`
    : "";
  const examples = Object.entries(remediation.frameworkExamples || {});
  const example = examples.length > 0
    ? `<div><strong>${escapeHtml(examples[0][0])} example</strong></div>
      <pre><code>${escapeHtml(examples[0][1])}</code></pre>`
    : "";
  const docs = remediation.docs
    .map(safeExternalUrl)
    .filter((url): url is string => Boolean(url));
  const links = docs.length > 0
    ? `<div class="remediation-links">${docs.slice(0, 3).map((url, index) => `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">Guidance ${index + 1}</a>`).join("\n")}</div>`
    : "";

  return `<details class="remediation" open>
    <summary>How to fix</summary>
    <div class="remediation-body">
      <div>${escapeHtml(remediation.summary)}</div>
      ${steps}
      ${example}
      ${links}
    </div>
  </details>`;
}

function safeExternalUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function renderContrastEvidence(issue: DedupedIssue): string {
  const contrast = issue.contrast;
  if (!contrast) return "";

  const typography = [contrast.fontSize, contrast.fontWeight].filter(Boolean).join(", ");
  const suggestions = contrast.suggestions.length > 0
    ? `<div class="contrast-suggestions">
      ${contrast.suggestions.map((suggestion) => `<span class="contrast-color">
        ${renderColorSwatch(suggestion.color)}
        ${formatContrastSuggestionPurpose(suggestion.purpose)}: <code>${escapeHtml(suggestion.color)}</code> → ${suggestion.contrastRatio}:1
      </span>`).join("\n")}
    </div>`
    : `<div class="muted">No reliable single-color suggestion is available. Review this contrast manually.</div>`;

  return `<div class="contrast-evidence">
    <div><strong>Contrast ${contrast.actualRatio}:1</strong> · required ${contrast.requiredRatio}:1</div>
    <div class="contrast-colors">
      <span class="contrast-color">${renderColorSwatch(contrast.foreground)} Text <code>${escapeHtml(contrast.foreground)}</code></span>
      <span class="contrast-color">${renderColorSwatch(contrast.background)} Background <code>${escapeHtml(contrast.background)}</code></span>
    </div>
    ${typography ? `<div class="url">${escapeHtml(typography)}</div>` : ""}
    <div><strong>Suggested accessible colors</strong></div>
    <div class="url">Keep background ${escapeHtml(contrast.background)} and change the text color:</div>
    ${suggestions}
    <div class="url">Review design tokens and hover, focus, disabled, and visited states before applying.</div>
  </div>`;
}

function formatContrastSuggestionPurpose(
  purpose: NonNullable<DedupedIssue["contrast"]>["suggestions"][number]["purpose"]
): string {
  if (purpose === "minimum") return "Minimum change";
  if (purpose === "recommended") return "Recommended";
  return "Enhanced contrast";
}

function renderColorSwatch(color: string): string {
  if (!/^#[0-9a-f]{3,8}$/i.test(color)) return "";
  return `<span class="color-swatch" style="background-color: ${escapeAttribute(color)}" aria-hidden="true"></span>`;
}

function renderEdges(graph: ExplorationGraph): string {
  if (graph.edges.length === 0) {
    return `<details>
      <summary>State transitions: 0</summary>
      <p class="muted">No state transitions were recorded.</p>
    </details>`;
  }

  const renderEdge = (edge: ExplorationGraph["edges"][number]): string => `<li class="edge">
      <div><a href="#${escapeAttribute(edge.from)}">${escapeHtml(edge.from)}</a> -> <a href="#${escapeAttribute(edge.to)}">${escapeHtml(edge.to)}</a></div>
      <div class="muted">${escapeHtml(edge.action.label)}</div>
      ${edge.action.selector ? `<div><code>${escapeHtml(edge.action.selector)}</code></div>` : ""}
    </li>`;
  const visibleEdges = graph.edges.slice(0, 12);
  const remainingEdges = graph.edges.slice(12);

  return `<details>
    <summary>State transitions: ${graph.edges.length}</summary>
    <p class="muted">Transition details are mainly useful for debugging crawl coverage. Full data is available in <code>exploration-graph.json</code>.</p>
    <ul class="edge-list">
    ${visibleEdges.map(renderEdge).join("\n")}
  </ul>
  ${remainingEdges.length > 0 ? `<details>
    <summary>Show ${remainingEdges.length} more transition${remainingEdges.length === 1 ? "" : "s"}</summary>
    <ul class="edge-list">${remainingEdges.map(renderEdge).join("\n")}</ul>
  </details>` : ""}
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

  const renderAction = (action: NonNullable<ExplorationGraph["skippedActions"]>[number]): string => `<li class="edge">
      <div><a href="#${escapeAttribute(action.stateId)}">${escapeHtml(action.stateId)}</a>: ${escapeHtml(action.label)}</div>
      <div class="muted">${escapeHtml(action.reason)}</div>
      ${action.selector ? `<div><code>${escapeHtml(action.selector)}</code></div>` : ""}
      ${action.url ? `<div class="url">${escapeHtml(action.url)}</div>` : ""}
    </li>`;
  const visibleActions = skippedActions.slice(0, 20);
  const remainingActions = skippedActions.slice(20);

  return `<details>
    <summary>Skipped actions: ${skippedActions.length}</summary>
    <p class="muted">Skipped actions are usually safety decisions, such as avoiding submit, payment, logout, or destructive controls.</p>
    <ul class="edge-list">
    ${visibleActions.map(renderAction).join("\n")}
  </ul>
  ${remainingActions.length > 0 ? `<details>
    <summary>Show ${remainingActions.length} more skipped action${remainingActions.length === 1 ? "" : "s"}</summary>
    <ul class="edge-list">${remainingActions.map(renderAction).join("\n")}</ul>
  </details>` : ""}
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

function findingTypeBadge(type: DedupedIssue["findingType"]): string {
  if (type === "wcag") return `<span class="badge">WCAG violation</span>`;
  if (type === "best-practice") return `<span class="badge">best practice</span>`;
  return `<span class="badge">unmapped review</span>`;
}

function countFindingTypes(issues: DedupedIssue[]): Record<DedupedIssue["findingType"], number> {
  return issues.reduce<Record<DedupedIssue["findingType"], number>>((counts, issue) => {
    counts[issue.findingType] += 1;
    return counts;
  }, {
    wcag: 0,
    "best-practice": 0,
    unmapped: 0
  });
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
  findingType: DedupedIssue["findingType"];
  critical: number;
  warning: number;
  info: number;
  severityScore: number;
  states: string[];
  criteria: string[];
}> {
  const summaries = new Map<string, {
    ruleId: string;
    findingType: DedupedIssue["findingType"];
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
      findingType: issue.findingType,
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
