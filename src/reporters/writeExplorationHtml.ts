import fs from "node:fs/promises";
import path from "node:path";
import { enrichIssueEvidence } from "../core/classification.js";
import { compareLighthouseWithFindings } from "../core/lighthouseComparison.js";
import { formatReportDateUtc } from "../core/reportDate.js";
import { getRemediationHint } from "../core/remediation.js";
import type { DedupedIssue, ExplorationGraph, ExplorationState, KeyboardAuditResult, LighthouseAuditResult, ManualChecklist, Severity } from "../types.js";

interface StateViewModel extends ExplorationState {
  issues: DedupedIssue[];
}

interface ExplorationHtmlOptions {
  fileName?: string;
  title?: string;
  keyboard?: KeyboardAuditResult;
  manualChecklist?: ManualChecklist;
  lighthouse?: LighthouseAuditResult[];
}

interface CoverageMatrixRow {
  automated: boolean;
  html: string;
}

export async function writeExplorationHtml(
  outputDir: string,
  graph: ExplorationGraph,
  issues: DedupedIssue[],
  options: ExplorationHtmlOptions = {}
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, options.fileName || "exploration.html"),
    renderExplorationHtml(graph, issues, options)
  );
}

export function renderExplorationHtml(
  graph: ExplorationGraph,
  issues: DedupedIssue[],
  options: ExplorationHtmlOptions = {}
): string {
  const reportIssues = issues.map((issue) => issue.findingType
    ? issue
    : enrichIssueEvidence(issue));
  const states = graph.states.map((state) => ({
    ...state,
    issues: reportIssues.filter((issue) => issue.stateId === state.id)
  }));
  const visualStateIds = new Set(graph.states.map((state) => state.id));
  const nonVisualIssues = reportIssues.filter((issue) => !issue.stateId || !visualStateIds.has(issue.stateId));
  const totals = summarizeIssues(reportIssues);
  const findingTypes = countFindingTypes(reportIssues);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title || "a11y-shiftleft exploration report")}</title>
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

    .comparison-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-top: 16px;
    }

    .comparison-grid > div {
      background: #f8fafc;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
    }

    .comparison-grid ul {
      margin: 0;
      padding-left: 18px;
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
      overflow: visible;
    }

    .focus-path {
      display: flex;
      gap: 24px;
      list-style: none;
      margin: 16px 0 8px;
      overflow-x: auto;
      padding: 4px 4px 14px;
    }

    .focus-path-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      flex: 0 0 190px;
      min-height: 112px;
      padding: 12px;
      position: relative;
    }

    .focus-path-item:not(:last-child)::after {
      border-top: 2px solid #98a2b3;
      content: "";
      position: absolute;
      right: -25px;
      top: 25px;
      width: 24px;
    }

    .focus-path-item-risk {
      background: #fff8f1;
      border-color: var(--warning-marker);
    }

    .focus-path-number {
      align-items: center;
      background: var(--info);
      border-radius: 50%;
      color: #fff;
      display: inline-flex;
      font-size: 12px;
      font-weight: 700;
      height: 28px;
      justify-content: center;
      margin-bottom: 8px;
      width: 28px;
    }

    .focus-path-item-risk .focus-path-number {
      background: var(--warning);
    }

    .focus-path-name,
    .focus-path-meta {
      display: block;
      overflow-wrap: anywhere;
    }

    .focus-path-name {
      font-weight: 700;
    }

    .focus-path-meta {
      color: var(--muted);
      font-size: 12px;
      margin-top: 4px;
    }

    .manual-targets {
      display: grid;
      gap: 8px;
      list-style: none;
      margin: 12px 0;
      padding: 0;
    }

    .manual-target {
      background: #f7faff;
      border: 1px solid #b8d2f5;
      border-radius: 6px;
      padding: 10px;
    }

    .manual-target strong,
    .manual-target span {
      display: block;
    }

    .manual-target a {
      color: var(--info);
      font-weight: 700;
    }

    .coverage-table-wrap {
      overflow-x: auto;
    }

    .coverage-table {
      border-collapse: collapse;
      min-width: 820px;
      width: 100%;
    }

    .coverage-table th,
    .coverage-table td {
      border: 1px solid #b8c0cc;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }

    .coverage-table thead th {
      background: #e9edf2;
      color: var(--ink);
      font-weight: 700;
    }

    .coverage-table tbody th {
      width: 22%;
    }

    .coverage-table .coverage-check-cell {
      text-align: center;
      width: 76px;
    }

    .coverage-table .coverage-findings {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      text-align: center;
      width: 84px;
    }

    .coverage-table .coverage-status-cell {
      min-width: 180px;
      width: 180px;
    }

    .coverage-table input[type="checkbox"] {
      accent-color: var(--ok);
      height: 20px;
      margin: 0;
      width: 20px;
    }

    .coverage-table input[type="checkbox"]:focus-visible {
      outline: 3px solid var(--info);
      outline-offset: 3px;
    }

    .coverage-table input[type="checkbox"]:disabled {
      opacity: 1;
    }

    .coverage-row-automated {
      background: #edf9f3;
    }

    .coverage-row-review {
      background: #fff7e6;
    }

    .coverage-row-review:not(.coverage-row-reviewed):hover,
    .coverage-row-review:not(.coverage-row-reviewed):focus-within {
      background: #ffefc7;
    }

    .coverage-row-reviewed {
      background: #edf9f3;
    }

    .coverage-status {
      border: 1px solid currentColor;
      border-radius: 4px;
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 6px;
    }

    .coverage-status-automated {
      color: #05603a;
    }

    .coverage-status-review {
      color: #8a3b0a;
    }

    .coverage-progress {
      color: #713b0b;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .coverage-progress-complete {
      color: var(--ok);
    }

    .visually-hidden {
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      height: 1px;
      overflow: hidden;
      position: absolute;
      white-space: nowrap;
      width: 1px;
    }

    .triage-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }

    .quick-review-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }

    .quick-review-list {
      display: grid;
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .quick-review-item {
      border-left: 3px solid var(--line);
      padding: 6px 8px;
    }

    .quick-review-item-critical {
      border-left-color: var(--critical);
    }

    .quick-review-item-warning {
      border-left-color: var(--warning-marker);
    }

    .quick-review-item a {
      color: var(--info);
      font-weight: 700;
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
      grid-template-rows: auto auto;
      min-height: 0;
      overflow: visible;
      position: relative;
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

    .state-compact {
      min-height: 0;
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

    .screenshot-scroll {
      height: 100%;
      overflow: hidden;
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
      height: auto;
      min-height: 220px;
      object-fit: contain;
      object-position: top center;
    }

    .screenshot-frame-full {
      aspect-ratio: auto;
      height: clamp(260px, 70vh, 560px);
      min-height: 260px;
      overflow: hidden;
    }

    .screenshot-frame-full .screenshot-scroll {
      height: 100%;
      overflow: auto;
    }

    .screenshot-frame-full .screenshot-stage {
      height: auto;
      min-height: 260px;
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
      box-sizing: border-box;
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

    .state-compact .state-body {
      gap: 6px;
      padding: 10px 12px;
    }

    .state-compact-summary {
      align-items: center;
      display: grid;
      gap: 8px;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .state-compact-summary h3 {
      font-size: 14px;
      margin-bottom: 0;
      overflow-wrap: anywhere;
    }

    .state-compact-meta {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
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

    .issue {
      position: relative;
    }

    .issue:has(details[open]) {
      z-index: 6;
    }

    .issue code,
    .edge code {
      background: #eef1f5;
      border-radius: 4px;
      padding: 2px 4px;
      word-break: break-word;
    }

    .finding-occurrences {
      display: grid;
      gap: 8px;
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
    }

    .finding-occurrence + .finding-occurrence {
      border-top: 1px solid var(--line);
      padding-top: 8px;
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

    .contrast-measurement {
      display: grid;
      gap: 7px;
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

    .remediation,
    .contrast-guidance {
      position: relative;
    }

    .remediation-body,
    .contrast-guidance-body {
      display: grid;
      gap: 8px;
    }

    .remediation[open] .remediation-body,
    .contrast-guidance[open] .contrast-guidance-body {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      box-shadow: 0 12px 32px rgb(30 36 48 / 18%);
      left: 0;
      max-height: min(380px, 60vh);
      overflow: auto;
      padding: 12px;
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      z-index: 8;
    }

    details {
      border-top: 1px solid var(--line);
      padding-top: 10px;
    }

    details + details {
      margin-top: 12px;
    }

    summary {
      align-items: center;
      cursor: pointer;
      display: flex;
      gap: 8px;
      font-weight: 700;
      list-style: none;
      min-height: 32px;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary::before {
      align-items: center;
      background: #eef1f5;
      border: 1px solid var(--line);
      border-radius: 4px;
      color: var(--ink);
      content: "›";
      display: inline-flex;
      flex: 0 0 24px;
      font-size: 20px;
      font-weight: 800;
      height: 24px;
      justify-content: center;
      line-height: 1;
      transform: rotate(0deg);
      transition: transform 120ms ease;
      width: 24px;
    }

    details[open] > summary::before {
      transform: rotate(90deg);
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
      .quick-review,
      .triage,
      .states {
        grid-column: 1 / -1;
      }
    }
  </style>
</head>
<body data-coverage-report-id="${escapeAttribute(`${graph.startUrl}|${graph.generatedAt}`)}">
  <header>
    <h1>${escapeHtml(options.title || "a11y-shiftleft exploration report")}</h1>
    <p class="muted">Generated: <time datetime="${escapeAttribute(graph.generatedAt)}">${escapeHtml(formatReportDateUtc(graph.generatedAt))}</time><br>Start URL: ${escapeHtml(graph.startUrl)}<br>Scan scope: depth ${graph.summary.maxDepth}, up to ${graph.summary.maxStates} states, ${graph.summary.statesVisited} rendered</p>
  </header>
  <main>
    <section class="summary" aria-label="Exploration summary">
      ${metric("UI states explored", graph.summary.uiStatesVisited ?? graph.summary.statesVisited)}
      ${metric("Pages visited", graph.summary.pagesVisited ?? new Set(graph.states.map((state) => state.url)).size)}
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
    </section>

    ${renderQuickReview(reportIssues, options)}

    ${renderLighthouseComparison(options.lighthouse, reportIssues)}

    ${renderCoverageMatrix(graph, options, reportIssues)}

    <section class="panel triage" aria-label="Triage overview">
      ${renderTriageOverview(states, reportIssues)}
    </section>

    <section class="panel states" aria-label="Checked states">
      ${states.map(renderState).join("\n")}
    </section>

    ${renderNonVisualIssues(nonVisualIssues)}

    ${options.keyboard ? renderKeyboardAudit(options.keyboard) : ""}

    ${options.manualChecklist ? renderManualChecklist(options.manualChecklist) : ""}

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
  <script>
    (() => {
      const rows = Array.from(document.querySelectorAll('[data-coverage-review]'));
      const progress = document.querySelector('[data-coverage-progress]');
      const reportId = document.body.dataset.coverageReportId || 'report';
      const storageKey = 'a11y-shiftleft:coverage:' + reportId;
      let saved = {};

      try {
        saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      } catch {
        saved = {};
      }

      const update = () => {
        const completed = {};
        let remaining = 0;

        for (const row of rows) {
          const checkbox = row.querySelector('input[type="checkbox"]');
          const status = row.querySelector('[data-coverage-status]');
          if (!checkbox || !status) continue;
          const checked = checkbox.checked;
          row.classList.toggle('coverage-row-reviewed', checked);
          status.textContent = checked ? 'Reviewed manually' : status.dataset.defaultStatus;
          status.classList.toggle('coverage-status-automated', checked);
          status.classList.toggle('coverage-status-review', !checked);
          completed[row.dataset.coverageReview] = checked;
          if (!checked) remaining += 1;
        }

        if (progress) {
          progress.textContent = remaining === 0
            ? 'Manual coverage review complete for this report.'
            : 'Manual review remaining: ' + remaining + ' of ' + rows.length + ' areas.';
          progress.classList.toggle('coverage-progress-complete', remaining === 0);
        }

        try {
          localStorage.setItem(storageKey, JSON.stringify(completed));
        } catch {
          // The report remains usable when storage is unavailable.
        }
      };

      for (const row of rows) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (!checkbox) continue;
        checkbox.checked = saved[row.dataset.coverageReview] === true;
        checkbox.addEventListener('change', update);
      }

      update();
    })();
  </script>
</body>
</html>
`;
}

function renderQuickReview(issues: DedupedIssue[], options: ExplorationHtmlOptions): string {
  if (!options.keyboard && !options.manualChecklist) return "";

  const highImpact = [...issues]
    .sort((left, right) => (
      severityValue(right.severity) - severityValue(left.severity)
        || left.ruleId.localeCompare(right.ruleId)
    ))
    .slice(0, 3);
  const tabSteps = options.keyboard?.steps.slice(0, 5) || [];
  const manualTasks = [...(options.manualChecklist?.items || [])]
    .sort((left, right) => (right.targets?.length || 0) - (left.targets?.length || 0))
    .slice(0, 3);

  return `<section class="panel quick-review" aria-label="Quick review">
    <h2>Quick Review</h2>
    <p class="muted">Start here for a compact review of high-impact findings, keyboard order, and human checks. Full evidence remains in the sections below.</p>
    <div class="quick-review-grid">
      <div>
        <h3>Fix First</h3>
        ${renderQuickFindings(highImpact)}
      </div>
      <div>
        <h3>First Tab Stops</h3>
        ${renderQuickTabStops(tabSteps, Boolean(options.keyboard))}
      </div>
      <div>
        <h3>Human Review Next</h3>
        ${renderQuickManualTasks(manualTasks)}
      </div>
    </div>
  </section>`;
}

function renderLighthouseComparison(results: LighthouseAuditResult[] | undefined, issues: DedupedIssue[] = []): string {
  if (!results || results.length === 0) return "";
  const scores = results
    .map((result) => result.accessibilityScore)
    .filter((score): score is number => typeof score === "number");
  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : undefined;
  const failedAuditCount = results.reduce((total, result) => total + result.failedAudits.length, 0);
  const manualAuditCount = results.reduce((total, result) => total + result.manualAudits.length, 0);
  const comparison = compareLighthouseWithFindings(issues, results);
  const rows = results.map((result) => {
    const failed = result.failedAudits.slice(0, 3).map((audit) =>
      audit.documentationUrl
        ? `<a href="${escapeAttribute(audit.documentationUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(audit.title)}</a>`
        : escapeHtml(audit.title)
    ).join("<br>");
    return `<tr>
      <td>${escapeHtml(result.finalUrl || result.url)}</td>
      <td>${result.accessibilityScore ?? "n/a"}</td>
      <td>${result.failedAudits.length}</td>
      <td>${result.manualAudits.length}</td>
      <td>${failed || "none"}</td>
    </tr>`;
  }).join("");

  return `<section class="panel triage" aria-label="Lighthouse comparison">
    <h2>Lighthouse Comparison</h2>
    <p class="muted">Lighthouse is a score-oriented comparison signal. Use it alongside axe, keyboard, visual evidence, and manual review; it is not a WCAG conformance certificate.</p>
    <div class="summary">
      ${metric("Average score", averageScore ?? "n/a")}
      ${metric("Pages scored", results.length)}
      ${metric("Failed audits", failedAuditCount, failedAuditCount > 0 ? "warning" : undefined)}
      ${metric("Manual audits", manualAuditCount)}
    </div>
    <table>
      <thead><tr><th>URL</th><th>Score</th><th>Failed</th><th>Manual</th><th>Top failed audits</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${comparison ? renderLighthouseComparisonDetails(comparison) : ""}
  </section>`;
}

function renderLighthouseComparisonDetails(comparison: NonNullable<ReturnType<typeof compareLighthouseWithFindings>>): string {
  const lighthouseOnly = comparison.lighthouseOnlyAudits.slice(0, 8).map((audit) =>
    `<li><code>${escapeHtml(audit.id)}</code> ${escapeHtml(audit.title)}</li>`
  ).join("");
  const pipelineOnly = comparison.pipelineOnlyRules.slice(0, 8).map((rule) =>
    `<li><code>${escapeHtml(rule.ruleId)}</code> ${rule.count} finding${rule.count === 1 ? "" : "s"} · ${escapeHtml(rule.highestSeverity)} · ${escapeHtml(rule.sources.join(" + "))}</li>`
  ).join("");

  return `<div class="comparison-grid" aria-label="Lighthouse and pipeline comparison">
    <div>
      <h3>Same rule IDs</h3>
      <p class="muted">${comparison.matchingRuleIds.length > 0 ? comparison.matchingRuleIds.map((ruleId) => `<code>${escapeHtml(ruleId)}</code>`).join(", ") : "No matching failed rule IDs."}</p>
    </div>
    <div>
      <h3>Lighthouse-only failed audits</h3>
      <ul>${lighthouseOnly || "<li>none</li>"}</ul>
    </div>
    <div>
      <h3>Pipeline-only rules</h3>
      <ul>${pipelineOnly || "<li>none</li>"}</ul>
    </div>
  </div>`;
}

function renderQuickFindings(issues: DedupedIssue[]): string {
  if (issues.length === 0) return `<p class="muted">No automated findings to prioritize.</p>`;
  return `<ol class="quick-review-list">${issues.map((issue) => {
    const target = issue.stateId ? ` href="#${escapeAttribute(issue.stateId)}"` : "";
    const label = issue.stateId ? `<a${target}>${escapeHtml(issue.ruleId)}</a>` : `<strong>${escapeHtml(issue.ruleId)}</strong>`;
    const level = [...new Set(issue.wcagCriteria.map((criterion) => criterion.level))].join("/");
    return `<li class="quick-review-item quick-review-item-${issue.severity}">
      ${label} ${severityBadge(issue.severity)}
      <span class="focus-path-meta">${escapeHtml(issue.message)}</span>
      ${level ? `<span class="focus-path-meta">WCAG Level ${escapeHtml(level)}</span>` : ""}
    </li>`;
  }).join("")}</ol>`;
}

function renderQuickTabStops(steps: KeyboardAuditResult["steps"], included: boolean): string {
  if (!included) return `<p class="muted">Keyboard evidence was not included.</p>`;
  if (steps.length === 0) return `<p class="muted">No forward Tab stops were recorded.</p>`;
  return `<ol class="quick-review-list">${steps.map((step, index) => {
    const risk = !step.indicatorVisible || step.obscured || !step.visible;
    return `<li class="quick-review-item${risk ? " quick-review-item-warning" : ""}">
      <strong>${index + 1}. ${escapeHtml(step.accessibleName || step.selector || "Unnamed control")}</strong>
      <span class="focus-path-meta">${escapeHtml(step.role || step.tagName)}${risk ? " · review focus visibility" : ""}</span>
    </li>`;
  }).join("")}</ol>`;
}

function renderQuickManualTasks(items: ManualChecklist["items"]): string {
  if (items.length === 0) return `<p class="muted">No manual-review checklist was included.</p>`;
  return `<ol class="quick-review-list">${items.map((item) => {
    const firstTarget = item.targets?.[0];
    const title = firstTarget
      ? `<a href="#${escapeAttribute(firstTarget.stateId)}">${escapeHtml(item.title)}</a>`
      : `<strong>${escapeHtml(item.title)}</strong>`;
    return `<li class="quick-review-item">
      ${title}
      <span class="focus-path-meta">${item.targets?.length ? `${item.targets.length} observed target${item.targets.length === 1 ? "" : "s"}` : "Choose a representative target"}</span>
    </li>`;
  }).join("")}</ol>`;
}

function renderKeyboardAudit(audit: KeyboardAuditResult): string {
  const attempts = audit.activationAttempts || [];
  return `<section class="panel" aria-label="Keyboard audit">
    <h2>Keyboard Audit</h2>
    <p class="muted">Bounded Tab and Shift+Tab evidence. This supports review but does not replace complete keyboard task testing.</p>
    <div class="summary">
      ${metric("Focusable controls", audit.focusableCount)}
      ${metric("Forward steps", audit.steps.length)}
      ${metric("Reverse steps", audit.backwardSteps.length)}
      ${metric("Activation attempts", attempts.length)}
    </div>
    ${renderKeyboardFocusPath(audit.steps)}
    <details>
      <summary>Complete focus path data</summary>
      <table>
        <thead><tr><th>Step</th><th>Direction</th><th>Target</th><th>Role</th><th>Name</th><th>Indicator</th><th>Obscured</th></tr></thead>
        <tbody>${[...audit.steps, ...audit.backwardSteps].map((step) => `<tr>
          <td>${step.index}</td><td>${escapeHtml(step.direction)}</td><td><code>${escapeHtml(step.selector)}</code></td>
          <td>${escapeHtml(step.role || step.tagName)}</td><td>${escapeHtml(step.accessibleName || "none")}</td>
          <td>${step.indicatorVisible ? "yes" : "no"}</td><td>${step.obscured ? "yes" : "no"}</td>
        </tr>`).join("") || '<tr><td colspan="7">No focus steps recorded.</td></tr>'}</tbody>
      </table>
    </details>
    ${attempts.length > 0 ? `<details><summary>Activation evidence</summary><table>
      <thead><tr><th>Key</th><th>Target</th><th>Role</th><th>Outcome</th><th>Reason or focus after</th></tr></thead>
      <tbody>${attempts.map((attempt) => `<tr><td>${escapeHtml(attempt.key)}</td><td><code>${escapeHtml(attempt.selector)}</code></td><td>${escapeHtml(attempt.role)}</td><td>${escapeHtml(attempt.outcome)}</td><td>${escapeHtml(attempt.reason || attempt.focusAfter || "none")}</td></tr>`).join("")}</tbody>
    </table></details>` : ""}
  </section>`;
}

function renderKeyboardFocusPath(steps: KeyboardAuditResult["steps"]): string {
  if (steps.length === 0) {
    return `<div aria-label="Visual Tab order"><h3>Visual Tab Order</h3><p class="muted">No forward focus steps were recorded.</p></div>`;
  }

  const visibleSteps = steps.slice(0, 20);
  const items = visibleSteps.map((step, index) => {
    const risks = [
      !step.indicatorVisible ? "focus indicator not detected" : "",
      step.obscured ? "control may be obscured" : "",
      !step.visible ? "control is not visibly rendered" : ""
    ].filter(Boolean);
    const className = risks.length > 0 ? "focus-path-item focus-path-item-risk" : "focus-path-item";
    const name = step.accessibleName || step.selector || "Unnamed control";
    const role = step.role || step.tagName || "control";

    return `<li class="${className}">
      <span class="focus-path-number" aria-hidden="true">${index + 1}</span>
      <span class="visually-hidden">Tab step ${index + 1}: </span>
      <span class="focus-path-name">${escapeHtml(name)}</span>
      <span class="focus-path-meta">${escapeHtml(role)}</span>
      ${risks.length > 0 ? `<span class="focus-path-meta">Review: ${escapeHtml(risks.join("; "))}</span>` : ""}
    </li>`;
  }).join("");
  const truncated = steps.length > visibleSteps.length
    ? `<p class="muted">Showing the first ${visibleSteps.length} of ${steps.length} forward steps. Complete selector data remains in the table below.</p>`
    : "";

  return `<div aria-label="Visual Tab order">
    <h3>Visual Tab Order</h3>
    <p class="muted">Follow the numbered controls from left to right. Orange steps require review.</p>
    <ol class="focus-path">${items}</ol>
    ${truncated}
  </div>`;
}

function renderCoverageMatrix(
  graph: ExplorationGraph,
  options: ExplorationHtmlOptions,
  issues: DedupedIssue[]
): string {
  const themes = [...new Set(graph.states.map((state) => state.colorScheme).filter(Boolean))];
  const reflowStates = graph.states.filter((state) => state.reflow);
  const modalStates = graph.states.filter((state) => state.modalFocus);
  const announcementStates = graph.states.filter((state) => state.dynamicAnnouncements);
  const announcementUpdates = announcementStates.reduce((total, state) => (
    total + (state.dynamicAnnouncements?.meaningfulUpdates || 0)
  ), 0);
  const formStates = graph.states.filter((state) => state.formErrors);
  const invalidFields = formStates.reduce((total, state) => total + (state.formErrors?.invalidFieldCount || 0), 0);
  const unassociatedInvalidFields = formStates.reduce((total, state) => total + (state.formErrors?.unassociatedInvalidCount || 0), 0);
  const imageStates = graph.states.filter((state) => state.imageAlternatives);
  const suspiciousImages = imageStates.reduce((total, state) => total + (state.imageAlternatives?.suspiciousCount || 0), 0);
  const mediaStates = graph.states.filter((state) => state.media);
  const mediaElements = mediaStates.reduce((total, state) => total + (state.media?.audioCount || 0) + (state.media?.videoCount || 0), 0);
  const autoplayRisks = mediaStates.reduce((total, state) => total + (state.media?.autoplayRiskCount || 0), 0);
  const embeddedStates = graph.states.filter((state) => state.embeddedContent);
  const iframeCount = embeddedStates.reduce((total, state) => total + (state.embeddedContent?.iframeCount || 0), 0);
  const inaccessibleFrames = embeddedStates.reduce((total, state) => total + (state.embeddedContent?.inaccessibleIframeCount || 0), 0);
  const canvasGaps = embeddedStates.reduce((total, state) => total + (state.embeddedContent?.canvasWithoutAlternativeCount || 0), 0);
  const countIssues = (predicate: (issue: DedupedIssue) => boolean) => issues.filter(predicate).length;
  const dynamicFindingCount = countIssues((issue) => issue.source !== "eslint" && issue.source !== "keyboard");
  const staticFindingCount = countIssues((issue) => issue.source === "eslint");
  const staticAdapterFailed = issues.some((issue) => issue.ruleId === "adapter/eslint-error");
  const keyboardFindingCount = countIssues((issue) => issue.source === "keyboard");
  const lighthouseFailedAudits = options.lighthouse?.reduce((total, result) => total + result.failedAudits.length, 0) || 0;
  const keyboardCommand = `npx a11y-shiftleft-cli audit --url ${shellQuote(graph.startUrl)} --out reports`;
  const lighthouseCommand = `npx a11y-shiftleft-cli audit --url ${shellQuote(graph.startUrl)} --with-lighthouse --out reports`;
  const rows = [
    coverageRow("browser-automation", "Browser automation", "Automated", `${graph.summary.statesVisited} rendered state${graph.summary.statesVisited === 1 ? "" : "s"} scanned with axe`, true, dynamicFindingCount),
    coverageRow("static-source", "Static source analysis", staticAdapterFailed ? "Setup required" : "Automated", staticAdapterFailed ? "Install or configure the detected framework adapter, then run the audit again" : "Project source files checked with the configured accessibility lint adapter", !staticAdapterFailed, staticFindingCount),
    coverageRow("keyboard", "Keyboard traversal", options.keyboard ? "Automated evidence" : "Run keyboard audit", options.keyboard ? `${options.keyboard.steps.length} forward focus steps recorded; complete task testing may still be required` : `Run <code>${escapeHtml(keyboardCommand)}</code>`, Boolean(options.keyboard), options.keyboard ? keyboardFindingCount : undefined),
    coverageRow("lighthouse", "Lighthouse score", options.lighthouse ? "Comparison evidence" : "Optional comparison", options.lighthouse ? `${options.lighthouse.length} page score${options.lighthouse.length === 1 ? "" : "s"} captured` : `Install <code>lighthouse</code>, then run <code>${escapeHtml(lighthouseCommand)}</code>`, Boolean(options.lighthouse), options.lighthouse ? lighthouseFailedAudits : undefined),
    coverageRow("appearance", "Light and dark appearance", "Automated evidence", themes.length > 0 ? escapeHtml(themes.join(", ")) : "No distinct system color-scheme state detected", true, countIssues((issue) => issue.category === "contrast")),
    coverageRow("reflow", "Reflow at 400% (320 CSS px simulation)", reflowStates.length > 0 ? "Automated evidence" : "Review required", reflowStates.length > 0 ? `${reflowStates.length} state${reflowStates.length === 1 ? "" : "s"} checked for overflow and clipped text` : "No reflow evidence was collected", reflowStates.length > 0, reflowStates.length > 0 ? countIssues((issue) => issue.source === "layout") : undefined),
    coverageRow("modal-focus", "Modal focus behavior", modalStates.length > 0 ? "Automated evidence" : "Review if applicable", modalStates.length > 0 ? `${modalStates.length} state${modalStates.length === 1 ? "" : "s"} checked for name, initial focus, Escape, and focus restoration` : "No opened modal was observed; open and review expected dialogs manually", modalStates.length > 0, modalStates.length > 0 ? countIssues((issue) => issue.source === "modal") : undefined),
    coverageRow("announcements", "Dynamic announcements", announcementStates.length > 0 ? "Automated evidence" : "Review if applicable", `${announcementUpdates} meaningful live-region update${announcementUpdates === 1 ? "" : "s"} observed after ${announcementStates.length} action${announcementStates.length === 1 ? "" : "s"}`, announcementStates.length > 0, announcementStates.length > 0 ? 0 : undefined),
    coverageRow("form-errors", "Form error states", formStates.length > 0 ? "Automated evidence" : "Review if applicable", formStates.length > 0 ? `${invalidFields} explicit invalid field${invalidFields === 1 ? "" : "s"}; ${unassociatedInvalidFields} without an exposed associated error` : "No rendered form error state was observed", formStates.length > 0, formStates.length > 0 ? countIssues((issue) => issue.category === "forms") : undefined),
    coverageRow("image-alternatives", "Image alternatives", imageStates.length > 0 ? "Automated heuristics" : "No images observed", `${suspiciousImages} image alternative${suspiciousImages === 1 ? "" : "s"} flagged for human review across ${imageStates.length} state${imageStates.length === 1 ? "" : "s"}`, true, countIssues((issue) => issue.category === "images")),
    coverageRow("media-motion", "Media and motion", mediaStates.length > 0 ? "Automated evidence" : "Review if applicable", `${mediaElements} audio/video element${mediaElements === 1 ? "" : "s"}; ${autoplayRisks} autoplay control risk${autoplayRisks === 1 ? "" : "s"}`, mediaStates.length > 0, mediaStates.length > 0 ? countIssues((issue) => issue.category === "media") : undefined),
    coverageRow("embedded-content", "Embedded content", embeddedStates.length > 0 ? "Automated evidence" : "No embeds observed", `${iframeCount} iframe${iframeCount === 1 ? "" : "s"}; ${inaccessibleFrames} unavailable document${inaccessibleFrames === 1 ? "" : "s"}; ${canvasGaps} canvas alternative gap${canvasGaps === 1 ? "" : "s"}`, true, countIssues((issue) => issue.source === "embedded-content")),
    coverageRow("screen-reader", "Screen reader", "Human review required", "Test representative tasks with NVDA, JAWS, or VoiceOver"),
    coverageRow("content-usability", "Content and task usability", options.manualChecklist ? "Checklist ready" : "Human review required", "Record tester, environment, evidence, and outcome")
  ];
  const orderedRows = rows
    .sort((left, right) => Number(right.automated) - Number(left.automated))
    .map((row) => row.html);

  return `<section class="panel triage" aria-label="Audit coverage matrix">
    <h2>Audit Coverage</h2>
    <p class="muted">Green checked rows contain evidence collected by this audit. Complete the yellow rows manually; your selections stay in this browser for this generated report.</p>
    <p class="coverage-progress" data-coverage-progress aria-live="polite"></p>
    <div class="coverage-table-wrap">
      <table class="coverage-table">
        <thead><tr><th scope="col">Review</th><th scope="col">Area</th><th scope="col">Status</th><th scope="col">Findings</th><th scope="col">Evidence or next step</th></tr></thead>
        <tbody>${orderedRows.join("\n")}</tbody>
      </table>
    </div>
  </section>`;
}

function coverageRow(
  id: string,
  area: string,
  status: string,
  evidence: string,
  automated = false,
  findingCount?: number
): CoverageMatrixRow {
  const checkboxLabel = automated
    ? `${area}: evidence collected automatically`
    : `${area}: mark manual review complete`;
  const html = `<tr class="coverage-row-${automated ? "automated" : "review"}"${automated ? "" : ` data-coverage-review="${escapeAttribute(id)}"`}>
    <td class="coverage-check-cell"><label><span class="visually-hidden">${escapeHtml(checkboxLabel)}</span><input type="checkbox"${automated ? " checked disabled" : ""}></label></td>
    <th scope="row">${escapeHtml(area)}</th>
    <td class="coverage-status-cell"><span class="coverage-status coverage-status-${automated ? "automated" : "review"}"${automated ? "" : ` data-coverage-status data-default-status="${escapeAttribute(status)}"`}>${escapeHtml(status)}</span></td>
    <td class="coverage-findings">${findingCount === undefined ? "&mdash;" : findingCount}</td>
    <td>${evidence}</td>
  </tr>`;

  return {
    automated,
    html
  };
}

function renderManualChecklist(checklist: ManualChecklist): string {
  const targetedItems = checklist.items.filter((item) => item.targets?.length).length;
  return `<section class="panel" aria-label="Manual review checklist">
    <h2>Manual Review Checklist</h2>
    <p class="muted">Automated checks cover only part of accessibility. ${targetedItems > 0 ? `${targetedItems} review area${targetedItems === 1 ? " has" : "s have"} observed targets from this audit.` : "Choose representative targets for the areas below."} Record human review evidence and outcomes.</p>
    ${checklist.items.map((item) => `<details>
      <summary>${escapeHtml(item.title)} (${escapeHtml(item.wcag.join(", "))})${item.targets?.length ? ` — ${item.targets.length} target${item.targets.length === 1 ? "" : "s"}` : ""}</summary>
      <p>${escapeHtml(item.whyManual)}</p>
      ${renderManualTargets(item.targets)}
      <ol>${item.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <p class="muted">Suggested evidence: ${escapeHtml(item.evidence.join("; "))}</p>
    </details>`).join("")}
  </section>`;
}

function renderManualTargets(targets: ManualChecklist["items"][number]["targets"]): string {
  if (!targets?.length) {
    return `<p class="muted">No specific target was collected automatically. Choose a representative instance from the tested task.</p>`;
  }

  return `<h3>Observed review targets</h3><ul class="manual-targets">${targets.map((target) => `<li class="manual-target">
    <strong>${escapeHtml(target.kind)}: ${escapeHtml(target.label)}</strong>
    <span>${escapeHtml(target.evidence)}</span>
    <span><a href="#${escapeAttribute(target.stateId)}">Open ${escapeHtml(target.stateId)}</a>${target.selector ? ` · <code>${escapeHtml(target.selector)}</code>` : ""}</span>
  </li>`).join("")}</ul>`;
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

  if (state.issues.length === 0) {
    return renderCompactState(state, stateSeverity, issueBadges);
  }

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
      ${state.screenshotEvidence?.some((evidence) => evidence.kind === "evidence-crop")
        ? `<span class="badge">${state.screenshotEvidence.length} focused evidence capture${state.screenshotEvidence.length === 1 ? "" : "s"}</span>`
        : ""}
      ${state.visualDuplicateOf ? `<span class="badge">visual reused from ${escapeHtml(state.visualDuplicateOf)}</span>` : ""}
      <span class="badge">${state.actionCount} actions queued</span>
    </div>
    ${renderIssues(state.issues)}
    ${renderAccessibilityTreeEvidence(state)}
    ${renderReflowEvidence(state)}
    ${renderModalFocusEvidence(state)}
    ${renderDynamicAnnouncementEvidence(state)}
    ${renderFormErrorEvidence(state)}
    ${renderImageAlternativeEvidence(state)}
    ${renderMediaEvidence(state)}
    ${renderEmbeddedContentEvidence(state)}
  </div>
</article>`;
}

function renderCompactState(state: StateViewModel, stateSeverity: string, issueBadges: string): string {
  return `<article class="state state-${stateSeverity} state-compact" id="${escapeAttribute(state.id)}">
  ${renderStateScreenshot(state)}
  <div class="state-body">
    <div class="state-compact-summary">
      <div>
        <h3>${escapeHtml(state.id)}: ${escapeHtml(state.actionLabel)}</h3>
        <div class="url">${escapeHtml(state.url)}</div>
      </div>
      ${issueBadges}
    </div>
    <div class="state-compact-meta">
      <span class="badge">depth ${state.depth}</span>
      ${state.colorScheme ? `<span class="badge">${escapeHtml(state.colorScheme)} color scheme</span>` : ""}
      ${state.screenshotFullPage ? `<span class="badge">full-page evidence</span>` : ""}
      ${state.visualDuplicateOf ? `<span class="badge">visual reused from ${escapeHtml(state.visualDuplicateOf)}</span>` : ""}
      <span class="badge">${state.actionCount} actions queued</span>
    </div>
    <p class="muted">No automated findings in this state.</p>
  </div>
</article>`;
}

function renderDynamicAnnouncementEvidence(state: ExplorationState): string {
  const evidence = state.dynamicAnnouncements;
  if (!evidence) return "";
  return `<details>
    <summary>Dynamic announcement evidence</summary>
    <p class="muted">Observed after: ${escapeHtml(evidence.actionLabel)}</p>
    <div class="summary">
      ${metric("Regions before", evidence.regionsBefore)}
      ${metric("Regions after", evidence.regionsAfter)}
      ${metric("Updates observed", evidence.updatesObserved)}
      ${metric("Meaningful updates", evidence.meaningfulUpdates)}
    </div>
    ${evidence.updates.length > 0
      ? `<table><thead><tr><th>Region</th><th>Role</th><th>Politeness</th><th>Observed text</th></tr></thead><tbody>${evidence.updates.map((update) => `<tr><td><code>${escapeHtml(update.selector)}</code></td><td>${escapeHtml(update.role || "none")}</td><td>${escapeHtml(update.politeness)}</td><td>${escapeHtml(update.text || "empty")}</td></tr>`).join("")}</tbody></table>`
      : '<p class="muted">No aria-live, alert, or status mutation was observed for this action.</p>'}
    <p class="muted">DOM mutation evidence does not prove how or when a supported screen reader announces the update.</p>
  </details>`;
}

function renderFormErrorEvidence(state: ExplorationState): string {
  const evidence = state.formErrors;
  if (!evidence || evidence.invalidFieldCount === 0) return "";
  return `<details>
    <summary>Form error evidence</summary>
    <div class="summary">
      ${metric("Forms", evidence.formCount)}
      ${metric("Fields", evidence.fieldCount)}
      ${metric("Explicit invalid fields", evidence.invalidFieldCount)}
      ${metric("Associated errors", evidence.associatedErrorCount)}
      ${metric("Unassociated invalid", evidence.unassociatedInvalidCount, evidence.unassociatedInvalidCount > 0 ? "warning" : undefined)}
      ${metric("Error summaries", evidence.errorSummaryCount)}
    </div>
    ${evidence.invalidFields.length > 0
      ? `<table><thead><tr><th>Field</th><th>Name</th><th>Error references</th><th>Exposed error text</th><th>Focused</th></tr></thead><tbody>${evidence.invalidFields.map((field) => `<tr><td><code>${escapeHtml(field.selector)}</code></td><td>${escapeHtml(field.accessibleName || "unnamed")}</td><td>${escapeHtml(field.errorReferenceIds.join(", ") || "none")}</td><td>${escapeHtml(field.associatedErrorText || "none")}</td><td>${field.focused ? "yes" : "no"}</td></tr>`).join("")}</tbody></table>`
      : '<p class="muted">No fields with explicit <code>aria-invalid="true"</code> were rendered in this state.</p>'}
    <p class="muted">The audit does not submit forms or enter personal data. Review message quality, focus movement, error summaries, and correction workflows manually.</p>
  </details>`;
}

function renderImageAlternativeEvidence(state: ExplorationState): string {
  const evidence = state.imageAlternatives;
  if (!evidence || (evidence.suspiciousCount === 0 && evidence.repeatedAlternativeGroups === 0)) return "";
  return `<details>
    <summary>Image alternative-text evidence</summary>
    <div class="summary">
      ${metric("Images", evidence.imageCount)}
      ${metric("Informative alternatives", evidence.informativeCount)}
      ${metric("Decorative alternatives", evidence.decorativeCount)}
      ${metric("Flagged for review", evidence.suspiciousCount, evidence.suspiciousCount > 0 ? "warning" : undefined)}
      ${metric("Repeated-alt groups", evidence.repeatedAlternativeGroups)}
    </div>
    ${evidence.samples.length > 0
      ? `<table><thead><tr><th>Image</th><th>Current alternative</th><th>Review reasons</th></tr></thead><tbody>${evidence.samples.map((sample) => `<tr><td><code>${escapeHtml(sample.selector)}</code></td><td>${escapeHtml(sample.alt)}</td><td>${escapeHtml(sample.concerns.join(", "))}${sample.repeatedCount ? ` (${sample.repeatedCount} uses)` : ""}</td></tr>`).join("")}</tbody></table>`
      : '<p class="muted">No deterministic alternative-text quality pattern was detected.</p>'}
    <p class="muted">These are medium-confidence review signals. Only a person can decide whether an image is informative, decorative, or accurately described in context.</p>
  </details>`;
}

function renderMediaEvidence(state: ExplorationState): string {
  const evidence = state.media;
  if (!evidence) return "";
  return `<details>
    <summary>Media and motion evidence</summary>
    <div class="summary">
      ${metric("Audio", evidence.audioCount)}
      ${metric("Video", evidence.videoCount)}
      ${metric("Videos with caption tracks", evidence.videosWithCaptions)}
      ${metric("Audio with transcript candidate", evidence.audioWithTranscriptCandidate)}
      ${metric("Autoplay control risks", evidence.autoplayRiskCount, evidence.autoplayRiskCount > 0 ? "warning" : undefined)}
      ${metric("Active animations", evidence.activeAnimationCount)}
    </div>
    ${evidence.elements.length > 0
      ? `<table><thead><tr><th>Element</th><th>Kind</th><th>Captions</th><th>Transcript candidate</th><th>Autoplay</th><th>Muted</th><th>Controls</th></tr></thead><tbody>${evidence.elements.map((element) => `<tr><td><code>${escapeHtml(element.selector)}</code></td><td>${element.kind}</td><td>${element.captionTrackCount}</td><td>${element.transcriptCandidate ? "yes" : "no"}</td><td>${element.autoplay ? "yes" : "no"}</td><td>${element.muted ? "yes" : "no"}</td><td>${element.controls ? "yes" : "no"}</td></tr>`).join("")}</tbody></table>`
      : '<p class="muted">No rendered audio or video elements were observed.</p>'}
    <p class="muted">Reduced-motion CSS query detected: ${evidence.reducedMotionQueryDetected ? "yes" : "no"}. Unreadable cross-origin stylesheets: ${evidence.unreadableStylesheetCount}. Caption, transcript, audio-description, motion, and flashing quality require human review.</p>
  </details>`;
}

function renderEmbeddedContentEvidence(state: ExplorationState): string {
  const evidence = state.embeddedContent;
  if (!evidence) return "";
  return `<details>
    <summary>Iframe and canvas evidence</summary>
    <div class="summary">
      ${metric("Iframes", evidence.iframeCount)}
      ${metric("Same-origin frames", evidence.sameOriginIframeCount)}
      ${metric("Cross-origin frames", evidence.crossOriginIframeCount)}
      ${metric("Unavailable frame documents", evidence.inaccessibleIframeCount, evidence.inaccessibleIframeCount > 0 ? "warning" : undefined)}
      ${metric("Canvas elements", evidence.canvasCount)}
      ${metric("Canvas alternative gaps", evidence.canvasWithoutAlternativeCount, evidence.canvasWithoutAlternativeCount > 0 ? "warning" : undefined)}
    </div>
    ${evidence.iframes.length > 0 ? `<h4>Frames</h4><table><thead><tr><th>Frame</th><th>Document</th><th>Origin</th><th>Title</th><th>DOM coverage</th></tr></thead><tbody>${evidence.iframes.map((frame) => `<tr><td><code>${escapeHtml(frame.selector)}</code></td><td>${escapeHtml(frame.url)}</td><td>${frame.sameOrigin ? "same" : "cross"}</td><td>${escapeHtml(frame.title || "missing")}</td><td>${frame.browserAccessible ? "available" : "unavailable"}</td></tr>`).join("")}</tbody></table>` : ""}
    ${evidence.canvases.length > 0 ? `<h4>Canvas</h4><table><thead><tr><th>Canvas</th><th>Size</th><th>Decorative</th><th>Accessible alternative</th></tr></thead><tbody>${evidence.canvases.map((canvas) => `<tr><td><code>${escapeHtml(canvas.selector)}</code></td><td>${canvas.width} x ${canvas.height}</td><td>${canvas.decorative ? "yes" : "no"}</td><td>${canvas.hasAccessibleAlternative ? "detected" : "not detected"}</td></tr>`).join("")}</tbody></table>` : ""}
    <p class="muted">Modern axe scans accessible frame documents recursively. Unavailable frames need a separate audit. Canvas pixels are not interpreted, so meaningful graphics still require contextual human review.</p>
  </details>`;
}

function renderModalFocusEvidence(state: ExplorationState): string {
  const modal = state.modalFocus;
  if (!modal) return "";
  const outcome = (value: boolean | undefined, yes: string, no: string, pending: string): string => (
    value === true ? yes : value === false ? no : pending
  );

  return `<details>
    <summary>Modal focus evidence</summary>
    <table>
      <tbody>
        <tr><th scope="row">Dialog</th><td><code>${escapeHtml(modal.dialogSelector)}</code></td></tr>
        <tr><th scope="row">Modal semantics</th><td>${modal.isModal ? "modal" : "non-modal or not declared"}</td></tr>
        <tr><th scope="row">Accessible name</th><td>${escapeHtml(modal.accessibleName || "missing")}</td></tr>
        <tr><th scope="row">Initial focus</th><td>${modal.initialFocusInside ? "inside dialog" : "outside dialog"}${modal.initialFocusSelector ? ` at <code>${escapeHtml(modal.initialFocusSelector)}</code>` : ""}</td></tr>
        <tr><th scope="row">Focus containment</th><td>${modal.containmentTested
          ? `${outcome(modal.forwardFocusContained, "forward contained", "forward escaped", "forward not tested")}; ${outcome(modal.backwardFocusContained, "reverse contained", "reverse escaped", "reverse not tested")} (${modal.containmentSteps || 0} bounded steps per direction)${modal.escapedFocusSelector ? `; escaped to <code>${escapeHtml(modal.escapedFocusSelector)}</code>` : ""}`
          : "not applicable or not tested"}</td></tr>
        <tr><th scope="row">Escape</th><td>${outcome(modal.escapeClosed, "closed dialog", "did not close dialog", "not tested")}</td></tr>
        <tr><th scope="row">Focus restoration</th><td>${outcome(modal.focusReturnedToTrigger, "returned to trigger", "did not return to trigger", "not applicable or not tested")}</td></tr>
      </tbody>
    </table>
    <p class="muted">This isolated bounded heuristic checks modal focus in both directions but does not prove every interaction or screen-reader workflow. Confirm every close and completion path manually.</p>
  </details>`;
}

function renderReflowEvidence(state: ExplorationState): string {
  const reflow = state.reflow;
  if (!reflow || (reflow.horizontalOverflowPx <= 1 && reflow.clippedTextCount === 0)) return "";
  return `<details>
    <summary>Reflow evidence at 400% (${reflow.viewportWidth} CSS px simulation)</summary>
    <div class="summary">
      ${metric("Document width", reflow.documentWidth)}
      ${metric("Horizontal overflow px", reflow.horizontalOverflowPx, reflow.horizontalOverflowPx > 1 ? "warning" : undefined)}
      ${metric("Clipped text candidates", reflow.clippedTextCount, reflow.clippedTextCount > 0 ? "warning" : undefined)}
    </div>
    ${reflow.clippedTextSample.length > 0
      ? `<ul>${reflow.clippedTextSample.map((item) => `<li><code>${escapeHtml(item.selector)}</code>: ${escapeHtml(item.text || "unnamed text")} (${item.horizontalOverflowPx}px horizontal, ${item.verticalOverflowPx}px vertical overflow)</li>`).join("")}</ul>`
      : '<p class="muted">No clipped text candidates were detected by the bounded heuristic.</p>'}
    <p class="muted">Review flagged content manually at 400% zoom. Intentional truncation is not automatically a WCAG failure when the complete information remains available.</p>
  </details>`;
}

function renderAccessibilityTreeEvidence(state: ExplorationState): string {
  const tree = state.accessibilityTree;
  if (!tree || tree.unnamedInteractiveNodes === 0) return "";
  const nodes = (items: typeof tree.headings) => items.length > 0
    ? `<ul>${items.map((item) => `<li><code>${escapeHtml(item.role)}</code>${item.level ? ` level ${item.level}` : ""}: ${escapeHtml(item.name || "unnamed")}</li>`).join("")}</ul>`
    : '<p class="muted">None exposed in this state.</p>';

  return `<details>
    <summary>Accessibility tree evidence</summary>
    <div class="summary">
      ${metric("Exposed nodes", tree.totalNodes)}
      ${metric("Named nodes", tree.namedNodes)}
      ${metric("Interactive nodes", tree.interactiveNodes)}
      ${metric("Unnamed interactive", tree.unnamedInteractiveNodes, tree.unnamedInteractiveNodes > 0 ? "warning" : undefined)}
    </div>
    <h4>Landmarks</h4>${nodes(tree.landmarks)}
    <h4>Headings</h4>${nodes(tree.headings)}
    <h4>Interactive sample</h4>${nodes(tree.interactiveSample)}
  </details>`;
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
    : evidence.kind === "evidence-crop"
      ? `Open focused evidence ${index + 1}`
      : "Open annotated screenshot";
  const screenshotAlt = fullPage
    ? `Full-page evidence for ${state.id}`
    : evidence.kind === "evidence-crop"
      ? `Focused accessibility evidence ${index + 1} for ${state.id}`
      : `Screenshot for ${state.id}`;

  return `<div class="${frameClass}">
    <div class="screenshot-scroll">
      <div class="screenshot-stage">
        <img src="${escapeAttribute(evidence.path)}" alt="${escapeAttribute(screenshotAlt)}">
        ${renderAnnotationLayer(previewAnnotations)}
      </div>
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

  const renderedBounds = evidence?.width && evidence.height && evidence.kind !== "full-page"
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
  issues: DedupedIssue[]
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

  const groups = new Map<string, DedupedIssue[]>();
  for (const issue of issues) {
    const current = groups.get(issue.ruleId) || [];
    current.push(issue);
    groups.set(issue.ruleId, current);
  }

  const rankedGroups = [...groups.entries()].sort((left, right) => {
    const scoreDifference = sumSeverityScore(right[1]) - sumSeverityScore(left[1]);
    return scoreDifference || right[1].length - left[1].length || left[0].localeCompare(right[0]);
  });
  const visibleGroups = rankedGroups.slice(0, 8);
  const remainingGroups = rankedGroups.slice(8);

  return `<ul class="issue-list">
    ${visibleGroups.map(([ruleId, groupIssues]) => renderStateIssueGroup(ruleId, groupIssues)).join("\n")}
  </ul>
  ${remainingGroups.length > 0 ? `<details>
    <summary>Show ${remainingGroups.length} more rule group${remainingGroups.length === 1 ? "" : "s"}</summary>
    <ul class="issue-list">${remainingGroups.map(([ruleId, groupIssues]) => renderStateIssueGroup(ruleId, groupIssues)).join("\n")}</ul>
  </details>` : ""}`;
}

function renderNonVisualIssues(issues: DedupedIssue[]): string {
  if (issues.length === 0) return "";
  return `<section class="panel" aria-label="Non-visual findings">
    <h2>Non-visual Findings</h2>
    <p class="muted">These source or keyboard findings are not tied to a captured browser state.</p>
    ${renderIssues(issues)}
  </section>`;
}

function renderStateIssueGroup(ruleId: string, issues: DedupedIssue[]): string {
  const summary = summarizeIssues(issues);
  const colorSchemes = [...new Set(issues.map((issue) => issue.colorScheme).filter(Boolean))];
  const criteria = uniqueWcagCriteria(issues);
  const levels = [...new Set(criteria.map((criterion) => criterion.level))];
  const findingTypes = [...new Set(issues.map((issue) => issue.findingType))];
  const occurrences = `<ul class="finding-occurrences">
    ${issues.map((issue) => `<li class="finding-occurrence">
      ${issues.length > 1 ? `<div>${severityBadge(issue.severity)} ${findingTypeBadge(issue.findingType)}</div>` : ""}
      ${issues.length > 1 && issue.colorScheme ? `<div class="badges"><span class="badge">${escapeHtml(issue.colorScheme)} color scheme</span></div>` : ""}
      <div>${escapeHtml(issue.message)}</div>
      ${issue.selector || issue.file ? `<div class="url">${escapeHtml(issue.selector || issue.file || "")}</div>` : ""}
      ${issues.length > 1 ? "" : renderContrastEvidence(issue)}
    </li>`).join("\n")}
  </ul>`;

  return `<li class="issue">
    <div class="triage-title">
      <code>${escapeHtml(ruleId)}</code>
      ${issues.length > 1 ? `<span class="badge">${issues.length} occurrences</span>` : ""}
    </div>
    <div class="badges">
      ${summary.critical ? badge("critical", `${summary.critical} critical`) : ""}
      ${summary.warning ? badge("warning", `${summary.warning} warning`) : ""}
      ${summary.info ? badge("info", `${summary.info} info`) : ""}
      ${findingTypes.map(findingTypeBadge).join("")}
      ${levels.map((level) => `<span class="badge">WCAG Level ${escapeHtml(level)}</span>`).join("")}
      ${colorSchemes.map((scheme) => `<span class="badge">${escapeHtml(scheme)} color scheme</span>`).join("")}
    </div>
    ${renderWcagCriteria(criteria)}
    ${issues.length > 1
      ? `<details open><summary>Affected findings (${issues.length})</summary>${occurrences}</details>`
      : occurrences}
    ${issues.length > 1 ? renderGroupedContrastGuidance(issues) : ""}
    ${renderRemediation(issues[0])}
  </li>`;
}

function uniqueWcagCriteria(issues: DedupedIssue[]): DedupedIssue["wcagCriteria"] {
  const criteria = new Map<string, DedupedIssue["wcagCriteria"][number]>();
  for (const issue of issues) {
    for (const criterion of issue.wcagCriteria || []) {
      if (!criteria.has(criterion.id)) criteria.set(criterion.id, criterion);
    }
  }
  return [...criteria.values()];
}

function renderWcagCriteria(criteria: DedupedIssue["wcagCriteria"]): string {
  if (criteria.length === 0) return "";
  return `<div class="url">${criteria.map((criterion) => {
    const url = safeExternalUrl(criterion.url);
    const label = `WCAG ${criterion.id} ${criterion.title}`;
    return url
      ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
      : escapeHtml(label);
  }).join(" · ")}</div>`;
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

  return `<details class="remediation">
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

  return renderContrastGuidance(contrast);
}

function renderContrastMeasurement(contrast: NonNullable<DedupedIssue["contrast"]>): string {
  const typography = [contrast.fontSize, contrast.fontWeight].filter(Boolean).join(", ");
  return `<div class="contrast-measurement">
    <div><strong>Contrast ${contrast.actualRatio}:1</strong> · required ${contrast.requiredRatio}:1</div>
    <div class="contrast-colors">
      <span class="contrast-color">${renderColorSwatch(contrast.foreground)} Text <code>${escapeHtml(contrast.foreground)}</code></span>
      <span class="contrast-color">${renderColorSwatch(contrast.background)} Background <code>${escapeHtml(contrast.background)}</code></span>
    </div>
    ${typography ? `<div class="url">${escapeHtml(typography)}</div>` : ""}
  </div>`;
}

function renderGroupedContrastGuidance(issues: DedupedIssue[]): string {
  const groups = new Map<string, { contrast: NonNullable<DedupedIssue["contrast"]>; count: number }>();

  for (const issue of issues) {
    if (!issue.contrast) continue;
    const key = JSON.stringify({
      foreground: issue.contrast.foreground,
      background: issue.contrast.background,
      requiredRatio: issue.contrast.requiredRatio,
      suggestions: issue.contrast.suggestions
    });
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { contrast: issue.contrast, count: 1 });
  }

  if (groups.size === 0) return "";
  return [...groups.values()].map(({ contrast, count }) => (
    `<div class="contrast-guidance-group">
      ${count > 1 ? `<div class="url">Shared recommendation for ${count} findings</div>` : ""}
      ${renderContrastGuidance(contrast)}
    </div>`
  )).join("\n");
}

function renderContrastGuidance(contrast: NonNullable<DedupedIssue["contrast"]>): string {
  const suggestions = contrast.suggestions.length > 0
    ? `<div class="contrast-suggestions">
      ${contrast.suggestions.map((suggestion) => `<span class="contrast-color">
        ${renderColorSwatch(suggestion.color)}
        ${formatContrastSuggestionPurpose(suggestion.purpose)}: <code>${escapeHtml(suggestion.color)}</code> → ${suggestion.contrastRatio}:1
      </span>`).join("\n")}
    </div>`
    : `<div class="muted">No reliable single-color suggestion is available. Review this contrast manually.</div>`;

  return `<details class="contrast-evidence contrast-guidance">
    <summary>Color recommendations</summary>
    <div class="contrast-guidance-body">
      ${renderContrastMeasurement(contrast)}
      <div><strong>Suggested accessible colors</strong></div>
      <div class="url">Keep background ${escapeHtml(contrast.background)} and change the text color:</div>
      ${suggestions}
      <div class="url">Review design tokens and hover, focus, disabled, and visited states before applying.</div>
    </div>
  </details>`;
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

function metric(label: string, value: number | string, severity?: Severity): string {
  const className = severity ? `metric metric-${severity}` : "metric";

  return `<div class="${className}">
    <strong>${escapeHtml(String(value))}</strong>
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

function severityValue(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
