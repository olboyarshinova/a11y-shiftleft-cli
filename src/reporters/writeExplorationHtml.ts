import fs from "node:fs/promises";
import path from "node:path";
import { enrichIssueEvidence } from "../core/classification.js";
import { compareLighthouseWithFindings } from "../core/lighthouseComparison.js";
import { formatReportDateUtc } from "../core/reportDate.js";
import { getRemediationHint } from "../core/remediation.js";
import type { DedupedIssue, ElementBounds, ExplorationGraph, ExplorationState, KeyboardAuditResult, LighthouseAuditResult, ManualChecklist, Severity } from "../types.js";

interface StateViewModel extends ExplorationState {
  issues: DedupedIssue[];
  annotationSeverityByKey: Record<string, Severity>;
  annotationNumberByIssueKey: Record<string, number>;
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
  evidenceState: CoverageEvidenceState;
  html: string;
}

type CoverageEvidenceState = "passed" | "failed" | "needs-review" | "not-tested" | "unavailable";
type CoverageStateCounts = Record<CoverageEvidenceState, number>;

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
  const annotationSeverityByKey = buildAnnotationSeverityByKey(reportIssues);
  const reportIssuesByStateId = groupIssuesByStateId(reportIssues);
  const displayIssuesByStateId = filterRepeatedStateIssues(graph.states, reportIssuesByStateId);
  const states = graph.states.map((state) => {
    const stateIssues = displayIssuesByStateId.get(state.id) || [];
    return {
      ...state,
      issues: stateIssues,
      annotationSeverityByKey,
      annotationNumberByIssueKey: buildAnnotationNumberByIssueKey(state, stateIssues)
    };
  });
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
      --muted: #46515f;
      --line: #d9dde5;
      --critical: #d0001b;
      --warning: #c2410c;
      --warning-marker: #f97316;
      --info: #005fcc;
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

    .report-header-grid {
      align-items: start;
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(0, 1fr);
    }

    .report-header-main {
      min-width: 0;
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

    .report-product {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 10px;
    }

    .report-product strong {
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .report-product a {
      color: var(--info);
      font-weight: 700;
    }

    h2 {
      font-size: 16px;
      margin-bottom: 8px;
    }

    main {
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr);
      padding: 12px;
    }

    .summary {
      display: grid;
      gap: 10px;
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

    .share-review {
      border-left: 4px solid var(--info);
      grid-column: 1 / -1;
    }

    .ticket-drafts {
      align-self: start;
      background: #f8fcfa;
      border-left: 4px solid var(--ok);
      justify-self: end;
      margin-top: 0;
      max-width: 380px;
      padding: 12px;
      width: 100%;
    }

    .ticket-drafts-header {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: space-between;
    }

    .ticket-drafts-header h2 {
      margin-bottom: 0;
    }

    .ticket-drafts p {
      font-size: 12px;
      line-height: 1.35;
      margin: 6px 0 0;
    }

    .ticket-drafts .issue-actions {
      justify-content: flex-end;
      margin-top: 8px;
      width: 100%;
    }

    .share-review-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-top: 12px;
    }

    .share-review-card {
      background: #f8fafc;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
    }

    .share-review-card strong {
      display: block;
      margin-bottom: 4px;
    }

    .share-command {
      background: #111827;
      border-radius: 8px;
      color: #f9fafb;
      display: block;
      margin: 12px 0 0;
      overflow-x: auto;
      padding: 12px;
      white-space: pre;
    }

    .lighthouse-recommendations {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      margin-top: 16px;
    }

    .lighthouse-card {
      background: #fff;
      border: 1px solid var(--line);
      border-left: 4px solid var(--warning-marker);
      border-radius: 8px;
      padding: 12px;
    }

    .lighthouse-card-manual {
      border-left-color: var(--info);
    }

    .lighthouse-card code {
      white-space: normal;
    }

    .metric,
    .panel,
    .state {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .metric {
      padding: 8px 10px;
    }

    .metric strong {
      display: block;
      font-size: 20px;
      line-height: 1;
    }

    .metric-critical strong,
    .metric-wcag strong {
      color: var(--critical);
    }

    .metric-warning strong,
    .metric-needs-review strong {
      color: var(--warning-marker);
    }

    .metric-info strong,
    .metric-best-practice strong {
      color: var(--info);
    }

    .metric-zero strong {
      color: var(--ok);
    }

    .metric span,
    .muted {
      color: var(--muted);
    }

    .metric span {
      display: block;
      font-size: 12px;
      line-height: 1.25;
      margin-top: 2px;
    }

    .panel {
      padding: 12px;
      overflow: visible;
    }

    .panel-full-width {
      grid-column: 1 / -1;
      width: 100%;
    }

    .panel:has(.remediation[open]) {
      position: relative;
      z-index: 70;
    }

    .keyboard-audit {
      grid-column: 1 / -1;
    }

    .focus-path-scroll-wrapper {
      display: grid;
      gap: 6px;
    }

    .visual-tab-order {
      margin-top: 16px;
    }

    .focus-path {
      display: flex;
      gap: 24px;
      list-style: none;
      margin: 16px 0 0;
      overflow-x: auto;
      padding: 4px 4px 14px;
      scrollbar-color: #8b96a8 #e5e7eb;
      scrollbar-gutter: stable;
      scrollbar-width: auto;
    }

    .focus-path::-webkit-scrollbar {
      height: 12px;
    }

    .focus-path::-webkit-scrollbar-track {
      background: #e5e7eb;
      border-radius: 999px;
    }

    .focus-path::-webkit-scrollbar-thumb {
      background: #8b96a8;
      border: 2px solid #e5e7eb;
      border-radius: 999px;
    }

    .focus-path-scrollbar {
      background: #e5e7eb;
      border: 1px solid #c7ced9;
      border-radius: 999px;
      height: 14px;
      overflow: hidden;
      position: relative;
      width: 100%;
    }

    .focus-path-scrollbar-thumb {
      background: #6b7585;
      border-radius: 999px;
      display: block;
      height: 100%;
      min-width: 36px;
      transform: translateX(0);
      width: 36px;
    }

    .focus-path-scrollbar-disabled .focus-path-scrollbar-thumb {
      background: #9ca3af;
      opacity: 0.7;
      width: 100%;
    }

    .focus-path:focus-visible {
      outline: 3px solid var(--info);
      outline-offset: 4px;
    }

    .keyboard-summary-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      margin: 12px 0 16px;
    }

    .keyboard-review-card {
      background: #f8fafc;
      border: 1px solid var(--line);
      border-left: 4px solid var(--ok);
      border-radius: 8px;
      padding: 12px;
    }

    .keyboard-review-card-warning {
      background: #fff7e6;
      border-left-color: var(--warning-marker);
    }

    .keyboard-review-card strong,
    .keyboard-review-card span {
      display: block;
    }

    .keyboard-review-card span {
      color: var(--muted);
      margin-top: 4px;
    }

    .focus-path-item {
      background: #ffffff;
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

    .focus-path-risk-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }

    .focus-path-risk {
      background: #ffedd5;
      border: 1px solid #fed7aa;
      border-radius: 4px;
      color: #8a3b0a;
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 5px;
    }

    .focus-path-name,
    .focus-path-meta {
      background-color: inherit;
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

    .manual-env-grid {
      border: 1px solid var(--line);
      border-radius: 8px;
      display: grid;
      gap: 0;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin: 12px 0;
      overflow: hidden;
    }

    .manual-env-field {
      background: #f8fafc;
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      min-height: 64px;
      padding: 10px;
    }

    .manual-env-field strong,
    .manual-env-field span {
      display: block;
    }

    .manual-env-field strong {
      font-size: 12px;
    }

    .manual-env-field span {
      color: var(--muted);
      margin-top: 4px;
    }

    .manual-checklist-progress {
      color: var(--muted);
      font-size: 0.9rem;
      margin: 8px 0 14px;
    }

    .manual-checklist-progress-complete {
      color: var(--ok);
      font-weight: 700;
    }

    .manual-checklist-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 12px;
    }

    .manual-checklist-item + .manual-checklist-item {
      margin-top: 10px;
    }

    .manual-checklist-item-reviewed {
      background: #edf9f3;
      border-color: #9bd8bd;
    }

    .manual-checklist-header {
      align-items: center;
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
    }

    .manual-checklist-title {
      font-weight: 700;
    }

    .manual-checklist-item input[type="checkbox"] {
      accent-color: var(--ok);
      flex: 0 0 auto;
      height: 24px;
      margin: 0;
      width: 24px;
    }

    .manual-checklist-item details {
      margin-left: 34px;
    }

    .manual-checklist-item input[type="checkbox"]:focus-visible {
      outline: 3px solid var(--info);
      outline-offset: 3px;
    }

    .coverage-table-wrap {
      overflow-x: auto;
    }

    .coverage-legend {
      display: grid;
      gap: 5px;
      grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
      margin: 8px 0 10px;
    }

    .coverage-legend-item {
      align-items: center;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 8px;
      display: grid;
      gap: 4px;
      grid-template-columns: auto auto minmax(0, 1fr);
      min-height: 32px;
      padding: 5px 7px;
    }

    .coverage-legend-swatch {
      border-radius: 3px;
      display: inline-block;
      height: 12px;
      width: 12px;
    }

    .coverage-legend-item strong {
      color: var(--ink);
      font-size: 16px;
      line-height: 1;
    }

    .coverage-legend-item span:last-child {
      color: var(--ink);
      font-size: 11px;
      font-weight: 700;
    }

    .coverage-legend-failed {
      background: #fff0f3;
      border-color: #ff9aaa;
    }

    .coverage-legend-failed .coverage-legend-swatch {
      background: var(--critical);
    }

    .coverage-legend-needs-review,
    .coverage-legend-not-tested {
      background: #fff7e6;
      border-color: #f6c56b;
    }

    .coverage-legend-needs-review .coverage-legend-swatch,
    .coverage-legend-not-tested .coverage-legend-swatch {
      background: var(--warning);
    }

    .coverage-legend-unavailable {
      background: #f1f3f6;
      border-color: #c8ced8;
    }

    .coverage-legend-unavailable .coverage-legend-swatch {
      background: var(--muted);
    }

    .coverage-legend-passed {
      background: #edf9f3;
      border-color: #9bd8bd;
    }

    .coverage-legend-passed .coverage-legend-swatch {
      background: var(--ok);
    }

    .coverage-table {
      border-collapse: collapse;
      min-width: 820px;
      width: 100%;
    }

    .coverage-table th,
    .coverage-table td {
      border: 1px solid #b8c0cc;
      font-size: 13px;
      line-height: 1.3;
      padding: 6px 9px;
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
      width: 64px;
    }

    .coverage-table .coverage-findings {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      text-align: center;
      width: 84px;
    }

    .coverage-table .coverage-state-cell,
    .coverage-table .coverage-status-cell {
      min-width: 180px;
      width: 180px;
    }

    .coverage-table input[type="checkbox"] {
      accent-color: var(--ok);
      height: 16px;
      margin: 0;
      width: 16px;
    }

    .coverage-table input[type="checkbox"]:focus-visible {
      outline: 3px solid var(--info);
      outline-offset: 3px;
    }

    .coverage-table input[type="checkbox"]:disabled {
      opacity: 1;
    }

    .coverage-row-automated,
    .coverage-row-state-passed,
    .coverage-row-reviewed {
      background: #edf9f3;
    }

    .coverage-row-review,
    .coverage-row-state-needs-review,
    .coverage-row-state-not-tested {
      background: #fff7e6;
    }

    .coverage-row-state-failed {
      background: #fff1f0;
    }

    .coverage-row-state-unavailable {
      background: #f1f3f6;
    }

    .coverage-row-review:not(.coverage-row-reviewed):hover,
    .coverage-row-review:not(.coverage-row-reviewed):focus-within {
      background: #ffefc7;
    }

    .coverage-status,
    .coverage-state {
      border: 1px solid currentColor;
      border-radius: 4px;
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      padding: 2px 5px;
    }

    .coverage-status-automated {
      color: #05603a;
    }

    .coverage-status-review {
      color: #8a3b0a;
    }

    .coverage-state-passed {
      color: var(--ok);
    }

    .coverage-state-failed {
      color: var(--critical);
    }

    .coverage-state-needs-review,
    .coverage-state-not-tested {
      color: var(--warning);
    }

    .coverage-state-unavailable {
      color: var(--muted);
    }

    .coverage-progress {
      color: #713b0b;
      font-weight: 700;
      margin-bottom: 7px;
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
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .triage h2 {
      margin-bottom: 6px;
    }

    .triage h3 {
      font-size: 14px;
      margin-bottom: 6px;
    }

    .triage-list {
      display: grid;
      gap: 5px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .triage-item {
      border: 1px solid var(--line);
      border-radius: 6px;
      display: grid;
      gap: 4px 8px;
      grid-template-columns: minmax(0, 1fr);
      padding: 6px 8px;
    }

    .triage-title {
      align-items: start;
      display: flex;
      gap: 8px;
      justify-content: space-between;
      min-width: 0;
    }

    .triage-title-main {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
    }

    .triage-title a,
    .edge a {
      color: inherit;
    }

    .triage-item .badges {
      justify-content: start;
    }

    .triage-item .url {
      grid-column: 1 / -1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .triage-more {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      margin: 10px 0 0;
    }

    .focus-path-note {
      margin: 10px 0 0;
    }

    .states {
      align-items: start;
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
      position: relative;
    }

    .state {
      display: grid;
      grid-template-rows: auto auto;
      min-height: 0;
      overflow: visible;
      position: relative;
    }

    .state:has(details[open]) {
      z-index: 12;
    }

    .state:has(.remediation[open]) {
      z-index: 80;
    }

    .states:has(.screenshot-lightbox:target),
    .state:has(.screenshot-lightbox:target) {
      z-index: 1000;
    }

    .state-critical {
      border-color: #ff9aaa;
      box-shadow: inset 4px 0 0 var(--critical);
    }

    .state-critical .state-body {
      background: #ffffff;
    }

    .state-warning {
      border-color: #f7a45a;
      box-shadow: inset 4px 0 0 var(--warning-marker);
    }

    .state-warning .state-body {
      background: #ffffff;
    }

    .state-info {
      border-color: #9fc3f5;
      box-shadow: inset 4px 0 0 var(--info);
    }

    .state-info .state-body {
      background: #ffffff;
    }

    .non-visual-finding-summary {
      align-items: center;
      background: #f8fafc;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      display: flex;
      font-weight: 700;
      justify-content: center;
      min-height: 120px;
      padding: 16px;
      text-align: center;
    }

    .state-ok {
      border-color: #a6d8c3;
      box-shadow: inset 4px 0 0 var(--ok);
    }

    .state-compact {
      min-height: 0;
    }

    .screenshot-frame {
      aspect-ratio: var(--screenshot-aspect, 16 / 9);
      background: #eef1f5;
      border-bottom: 1px solid var(--line);
      overflow: hidden;
      position: relative;
    }

    .screenshot-evidence-grid {
      align-items: start;
      background: #eef1f5;
      display: grid;
      gap: 1px;
      grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
    }

    .screenshot-evidence-grid .screenshot-frame {
      align-self: start;
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
      height: auto;
      max-height: min(420px, 62vh);
      min-height: 0;
      overflow: hidden;
    }

    .screenshot-frame-full .screenshot-scroll {
      height: auto;
      max-height: min(420px, 62vh);
      overflow: auto;
      scrollbar-gutter: stable both-edges;
    }

    .screenshot-frame-full .screenshot-stage {
      height: auto;
      min-height: 0;
    }

    .screenshot-open {
      background: #ffffff;
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

    .screenshot-reuse-note {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 4px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      left: 8px;
      max-width: calc(100% - 16px);
      padding: 5px 7px;
      position: absolute;
      top: 8px;
      z-index: 2;
    }

    .screenshot-lightbox {
      align-items: center;
      background: rgb(30 36 48 / 82%);
      display: none;
      inset: 0;
      padding: 24px;
      position: fixed;
      z-index: 1001;
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
      position: relative;
      width: 100%;
      z-index: 1;
    }

    .screenshot-lightbox-backdrop {
      inset: 0;
      position: absolute;
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
      color: var(--warning);
      min-height: 10px;
      min-width: 10px;
      pointer-events: none;
      position: absolute;
    }

    .annotation-critical {
      background: rgb(208 0 27 / 12%);
      border-color: var(--critical);
      box-shadow: 0 0 0 1px rgb(208 0 27 / 38%);
      color: var(--critical);
    }

    .annotation-warning {
      background: rgb(249 115 22 / 10%);
      border-color: var(--warning-marker);
      box-shadow: 0 0 0 1px rgb(249 115 22 / 28%);
      color: var(--warning);
    }

    .annotation-info {
      background: rgb(0 95 204 / 10%);
      border-color: var(--info);
      box-shadow: 0 0 0 1px rgb(0 95 204 / 28%);
      color: var(--info);
    }

    .annotation-number {
      align-items: center;
      background: var(--warning-marker);
      border: 2px solid #ffffff;
      border-radius: 999px;
      box-shadow: 0 2px 6px rgb(0 0 0 / 24%);
      color: #ffffff;
      display: inline-flex;
      font-size: 11px;
      font-weight: 800;
      height: 22px;
      justify-content: center;
      left: 0;
      line-height: 1;
      min-width: 22px;
      padding: 0 5px;
      position: absolute;
      top: 0;
      transform: translate(-50%, -50%);
      z-index: 1;
    }

    .annotation-critical .annotation-number {
      background: var(--critical);
    }

    .annotation-warning .annotation-number {
      background: var(--warning-marker);
      color: #111827;
    }

    .annotation-info .annotation-number {
      background: var(--info);
    }

    .state-body {
      align-content: start;
      align-items: start;
      display: grid;
      gap: 8px;
      padding: 10px;
    }

    .state-body > * {
      align-self: start;
      width: 100%;
    }

    .state-compact .state-body {
      gap: 5px;
      padding: 8px 10px;
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
      background-color: inherit;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }

    .state-title > div,
    .state-title h3 {
      background-color: inherit;
      font-size: 14px;
      margin-bottom: 2px;
      word-break: break-word;
    }

    .state-title .url,
    .state-body > .badges,
    .issue-list,
    .issue,
    .issue .triage-title,
    .issue .triage-title > *,
    .issue .badges,
    .issue .url {
      background-color: inherit;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 8px;
    }

    .badge {
      background-color: inherit;
      color: var(--ink);
      display: inline-flex;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.25;
      white-space: nowrap;
    }

    .badge + .badge::before {
      color: var(--muted);
      content: "•";
      font-weight: 400;
      margin-right: 8px;
    }

    .badge-critical {
      color: #d0001b;
    }

    .badge-warning {
      color: #c2410c;
    }

    .badge-info {
      color: var(--info);
    }

    .badge-ok {
      color: #05603a;
    }

    .issue-list,
    .edge-list {
      align-items: start;
      display: grid;
      gap: 6px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .issue-list:has(details[open]) {
      position: relative;
      z-index: 7;
    }

    .issue-list:has(.remediation[open]) {
      z-index: 75;
    }

    .issue,
    .edge {
      border-top: 1px solid var(--line);
      padding-top: 6px;
    }

    .issue {
      align-self: start;
      position: relative;
    }

    .issue:has(details[open]) {
      z-index: 6;
    }

    .issue:has(.remediation[open]) {
      z-index: 85;
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

    .finding-targets {
      display: grid;
      gap: 6px;
      margin: 8px 0 0;
      padding-left: 24px;
    }

    .finding-targets li::marker {
      color: var(--muted);
      font-weight: 700;
    }

    .finding-target-note {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      list-style: none;
      margin-left: -24px;
    }

    .finding-target {
      align-items: start;
      display: flex;
      gap: 8px;
    }

    .finding-marker {
      align-items: center;
      background: var(--ink);
      border-radius: 999px;
      color: #ffffff;
      display: inline-flex;
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 800;
      height: 22px;
      justify-content: center;
      line-height: 1;
      margin-top: 2px;
      min-width: 22px;
      padding: 0 6px;
      white-space: nowrap;
    }

    .finding-marker-critical {
      background: var(--critical);
    }

    .finding-marker-warning {
      background: var(--warning-marker);
      color: #111827;
    }

    .finding-marker-info {
      background: var(--info);
    }

    .finding-review-note {
      background: #fff7ed;
      border-left: 3px solid var(--warning-marker);
      color: #7c2d12;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 8px;
    }

    .finding-context {
      background: #f8fafc;
      border: 1px solid var(--line);
      border-left: 4px solid var(--info);
      border-radius: 8px;
      color: var(--muted);
      display: grid;
      gap: 3px;
      margin-top: 6px;
      padding: 8px;
    }

    .finding-context strong {
      color: var(--ink);
    }

    .finding-context a {
      color: var(--info);
    }

    .finding-context-third-party {
      border-left-color: var(--warning-marker);
    }

    .finding-context-blocked {
      border-left-color: var(--critical);
    }

    .issue-actions {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }

    .triage-title .issue-actions {
      flex: 0 0 auto;
      justify-content: flex-end;
      margin-top: 0;
    }

    .copy-issue {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--ink);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      min-height: 32px;
      padding: 5px 10px;
    }

    .copy-issue-ticket {
      line-height: 1.1;
      padding-left: 6px;
      padding-right: 6px;
      white-space: normal;
      width: 72px;
    }

    .copy-issue-ticket span {
      display: block;
    }

    .copy-issue:hover,
    .copy-issue:focus-visible {
      border-color: var(--info);
      outline: 2px solid transparent;
    }

    .copy-issue-status {
      color: var(--muted);
      font-size: 12px;
    }

    .contrast-evidence {
      background: #f6f7f9;
      border-left: 3px solid var(--info);
      display: grid;
      gap: 5px;
      margin-top: 6px;
      padding: 7px 8px;
    }

    .contrast-colors,
    .contrast-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 5px 10px;
    }

    .contrast-measurement {
      display: grid;
      gap: 4px;
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
      margin-top: 6px;
      padding: 7px 8px;
    }

    .remediation-body {
      display: grid;
      gap: 5px;
      padding-top: 5px;
    }

    .remediation ol {
      margin: 0;
      padding-left: 20px;
    }

    .remediation pre {
      background: #e8f4ed;
      margin: 0;
      overflow-x: auto;
      padding: 6px;
      white-space: pre-wrap;
    }

    .remediation-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
    }

    .remediation {
      position: relative;
    }

    .remediation[open] {
      z-index: 90;
    }

    .remediation-body,
    .contrast-guidance-body {
      display: grid;
      gap: 6px;
    }

    .contrast-guidance-title {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      font-weight: 700;
    }

    .contrast-guidance-body {
      gap: 5px;
    }

    .contrast-guidance .contrast-measurement {
      gap: 4px;
    }

    .contrast-summary,
    .contrast-try {
      color: var(--muted);
      font-size: 12px;
    }

    .contrast-guidance-markers {
      align-items: center;
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .remediation[open] .remediation-body {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      box-shadow: 0 12px 32px rgb(30 36 48 / 18%);
      left: 0;
      max-height: min(380px, 60vh);
      overflow: auto;
      padding: 10px;
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      z-index: 100;
    }

    details {
      border-top: 1px solid var(--line);
      padding-top: 8px;
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
      .report-header-grid {
        grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
      }

      .ticket-drafts {
        margin-top: 44px;
      }

      main {
        grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
      }

      .summary,
      .share-review,
      .triage,
      .keyboard-audit,
      .states {
        grid-column: 1 / -1;
      }

    }
  </style>
</head>
<body data-coverage-report-id="${escapeAttribute(`${graph.startUrl}|${graph.generatedAt}`)}">
  <header>
    <div class="report-header-grid">
      <div class="report-header-main">
        <div class="report-product">
          <strong>a11y-shiftleft-cli</strong>
          <span class="muted">Visual accessibility report generated by the open-source project.</span>
          <a href="https://github.com/olboyarshinova/a11y-shiftleft-cli" target="_blank" rel="noopener noreferrer">Project on GitHub</a>
        </div>
        <h1>${escapeHtml(options.title || "a11y-shiftleft exploration report")}</h1>
        <p class="muted">Generated: <time datetime="${escapeAttribute(graph.generatedAt)}">${escapeHtml(formatReportDateUtc(graph.generatedAt))}</time><br>Start URL: ${escapeHtml(graph.startUrl)}<br>Scan depth: ${escapeHtml(formatDepthScope(graph.summary.maxDepth))}<br>Scan scope: ${escapeHtml(graph.summary.scopeSelector ? `selector ${graph.summary.scopeSelector}; up to ${graph.summary.maxStates} states, ${graph.summary.statesVisited} rendered` : `up to ${graph.summary.maxStates} states, ${graph.summary.statesVisited} rendered`)}<br>Hidden elements: ${escapeHtml(formatHiddenElements(graph.summary.hideElements))}</p>
      </div>
      ${renderTicketDraftsPanel(reportIssues)}
    </div>
  </header>
  <main>
    <section class="summary" aria-label="Exploration summary">
      ${metric("Exploration depth", formatDepthMetric(graph.summary.maxDepth))}
      ${metric("UI states explored", graph.summary.uiStatesVisited ?? graph.summary.statesVisited)}
      ${metric("Pages visited", graph.summary.pagesVisited ?? new Set(graph.states.map((state) => state.url)).size)}
      ${metric("Rendered states", graph.summary.statesVisited)}
      ${metric("Actions tried", graph.summary.actionsTried)}
      ${metric("Actions skipped", graph.summary.skippedActions || 0)}
      ${metric("Unique screenshots", graph.summary.screenshots)}
      ${graph.summary.duplicateScreenshots
        ? metric("Duplicate screenshots skipped", graph.summary.duplicateScreenshots)
        : ""}
    </section>

    <section class="summary summary-findings" aria-label="Finding summary">
      ${metric("Critical", totals.critical, "critical")}
      ${metric("Warning", totals.warning, "warning")}
      ${metric("Info", totals.info, "info")}
      ${metric("WCAG findings", findingTypes.wcag, "wcag")}
      ${metric("Needs review", findingTypes["needs-review"], "needs-review")}
      ${metric("Best practices", findingTypes["best-practice"], "best-practice")}
    </section>

    ${renderLighthouseComparison(options.lighthouse, reportIssues)}

    ${renderCoverageMatrix(graph, options, reportIssues)}

    <section class="panel triage" aria-label="Triage overview">
      ${renderTriageOverview(states, reportIssues)}
    </section>

    <section class="panel states" aria-label="Checked states">
      ${states.map(renderState).join("\n")}
      ${renderNonVisualIssues(nonVisualIssues)}
    </section>

    ${options.keyboard ? renderKeyboardAudit(options.keyboard) : ""}

    ${options.manualChecklist ? renderManualChecklist(options.manualChecklist) : ""}

    ${renderShareReview()}

    <section class="panel panel-full-width coverage-note" aria-label="Manual review note">
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
          const state = row.querySelector('[data-coverage-state]');
          if (!checkbox || !status || !state) continue;
          const checked = checkbox.checked;
          row.classList.toggle('coverage-row-reviewed', checked);
          status.textContent = checked ? 'Reviewed manually' : status.dataset.defaultStatus;
          status.classList.toggle('coverage-status-automated', checked);
          status.classList.toggle('coverage-status-review', !checked);
          state.textContent = checked ? 'passed' : state.dataset.defaultState;
          for (const value of ['passed', 'failed', 'needs-review', 'not-tested', 'unavailable']) {
            state.classList.toggle('coverage-state-' + value, state.textContent === value);
            row.classList.toggle('coverage-row-state-' + value, state.textContent === value);
          }
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

    (() => {
      const items = Array.from(document.querySelectorAll('[data-manual-checklist-item]'));
      const progress = document.querySelector('[data-manual-checklist-progress]');
      const reportId = document.body.dataset.coverageReportId || 'report';
      const storageKey = 'a11y-shiftleft:manual-checklist:' + reportId;
      let saved = {};

      try {
        saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      } catch {
        saved = {};
      }

      const update = () => {
        const completed = {};
        let remaining = 0;

        for (const item of items) {
          const checkbox = item.querySelector('[data-manual-checklist-checkbox]');
          if (!checkbox) continue;
          const checked = checkbox.checked;
          item.classList.toggle('manual-checklist-item-reviewed', checked);
          completed[item.dataset.manualChecklistItem] = checked;
          if (!checked) remaining += 1;
        }

        if (progress) {
          progress.textContent = remaining === 0
            ? 'Manual checklist complete for this report.'
            : 'Manual checks remaining: ' + remaining + ' of ' + items.length + '.';
          progress.classList.toggle('manual-checklist-progress-complete', remaining === 0);
        }

        try {
          localStorage.setItem(storageKey, JSON.stringify(completed));
        } catch {
          // The report remains usable when storage is unavailable.
        }
      };

      for (const item of items) {
        const checkbox = item.querySelector('[data-manual-checklist-checkbox]');
        if (!checkbox) continue;
        checkbox.checked = saved[item.dataset.manualChecklistItem] === true;
        checkbox.addEventListener('click', (event) => event.stopPropagation());
        checkbox.addEventListener('change', update);
      }

      update();
    })();

    (() => {
      const paths = Array.from(document.querySelectorAll('[data-focus-path-scroll]'));

      const updateScrollbar = (path) => {
        const wrapper = path.closest('.focus-path-scroll-wrapper');
        const track = wrapper ? wrapper.querySelector('[data-focus-path-scrollbar]') : null;
        const thumb = track ? track.querySelector('[data-focus-path-scrollbar-thumb]') : null;
        if (!track || !thumb) return;

        const viewportWidth = path.clientWidth;
        const contentWidth = path.scrollWidth;
        const trackWidth = track.clientWidth;
        const hasOverflow = contentWidth > viewportWidth + 1;
        track.classList.toggle('focus-path-scrollbar-disabled', !hasOverflow);

        if (!trackWidth || !contentWidth || !viewportWidth) return;

        const thumbWidth = hasOverflow
          ? Math.max(36, Math.round((viewportWidth / contentWidth) * trackWidth))
          : trackWidth;
        const maxScrollLeft = Math.max(1, contentWidth - viewportWidth);
        const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
        const thumbLeft = hasOverflow ? Math.round((path.scrollLeft / maxScrollLeft) * maxThumbLeft) : 0;

        thumb.style.width = thumbWidth + 'px';
        thumb.style.transform = 'translateX(' + thumbLeft + 'px)';
      };

      for (const path of paths) {
        const wrapper = path.closest('.focus-path-scroll-wrapper');
        const track = wrapper ? wrapper.querySelector('[data-focus-path-scrollbar]') : null;

        path.addEventListener('scroll', () => updateScrollbar(path), { passive: true });
        if (track) {
          track.addEventListener('pointerdown', (event) => {
            const rect = track.getBoundingClientRect();
            const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
            path.scrollLeft = ratio * Math.max(0, path.scrollWidth - path.clientWidth);
            updateScrollbar(path);
          });
        }

        updateScrollbar(path);
        requestAnimationFrame(() => updateScrollbar(path));
        window.addEventListener('resize', () => updateScrollbar(path));
      }
    })();

    (() => {
      const buttons = Array.from(document.querySelectorAll('[data-copy-issue]'));

      const copyText = async (text) => {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      };

      for (const button of buttons) {
        button.addEventListener('click', async () => {
          const status = button.parentElement?.querySelector('[data-copy-issue-status]');
          try {
            await copyText(decodeURIComponent(button.dataset.copyIssue || ''));
            if (status) status.textContent = 'Copied ticket draft';
          } catch {
            if (status) status.textContent = 'Copy failed';
          }
        });
      }

      const allTicketsButton = document.querySelector('[data-copy-all-ticket-drafts]');
      const allTicketsTemplate = document.querySelector('#all-ticket-drafts');
      if (allTicketsButton && allTicketsTemplate) {
        allTicketsButton.addEventListener('click', async () => {
          const status = allTicketsButton.parentElement?.querySelector('[data-copy-all-ticket-drafts-status]');
          try {
            const text = allTicketsTemplate.content?.textContent || allTicketsTemplate.textContent || '';
            if (!text.trim()) {
              if (status) status.textContent = 'Nothing to copy';
              return;
            }
            await copyText(text);
            if (status) status.textContent = 'Copied all ticket drafts';
          } catch {
            if (status) status.textContent = 'Copy failed';
          }
        });
      }
    })();
  </script>
</body>
</html>
`;
}

function renderShareReview(): string {
  return `<section class="panel share-review" aria-label="Share review copy">
    <h2>Share Review Copy</h2>
    <p class="muted">Before sending evidence outside the team, create a smaller sanitized copy. By default it removes screenshots, raw keyboard data, exploration graphs, raw Lighthouse payloads, query strings, hashes, obvious local paths, and common secret patterns.</p>
    <div class="share-review-grid">
      <div class="share-review-card">
        <strong>Text-first review copy</strong>
        <span>Share <code>share-summary.md</code>, <code>share-report.json</code>, <code>privacy-summary.json</code>, and <code>share-evaluation-scope.json</code> when it exists.</span>
      </div>
      <div class="share-review-card">
        <strong>One-file visual HTML</strong>
        <span>Add <code>--include-html</code> only when screenshots are approved for sharing. It creates <code>share-report.html</code> with embedded screenshots.</span>
      </div>
    </div>
    <code class="share-command">npx a11y-shiftleft-cli share prepare --report reports --out a11y-share</code>
    <code class="share-command">npx a11y-shiftleft-cli share prepare --report reports --out a11y-share --include-html</code>
  </section>`;
}

function renderTicketDraftsPanel(issues: DedupedIssue[]): string {
  const groups = collectTicketDraftGroups(issues);
  if (groups.length === 0) return "";
  const markdown = buildAllTicketDraftsMarkdown(groups);

  return `<section class="panel ticket-drafts" aria-label="Ticket drafts">
    <div class="ticket-drafts-header">
      <div>
        <h2>Ticket Drafts</h2>
        <p class="muted">Copy local Markdown drafts grouped by issue type. Nothing is sent to GitHub, Jira, or Linear automatically.</p>
      </div>
      <div class="issue-actions">
        <span class="copy-issue-status" data-copy-all-ticket-drafts-status aria-live="polite"></span>
        <button class="copy-issue" type="button" title="Copy Markdown drafts grouped by issue type" data-copy-all-ticket-drafts>Copy all ticket drafts (${groups.length})</button>
      </div>
    </div>
    <template id="all-ticket-drafts">${escapeHtml(markdown)}</template>
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
    <table aria-label="Lighthouse accessibility score comparison">
      <thead><tr><th>URL</th><th>Score</th><th>Failed</th><th>Manual</th><th>Top failed audits</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${comparison ? renderLighthouseComparisonDetails(comparison) : ""}
    ${renderLighthouseRecommendations(results)}
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

function renderLighthouseRecommendations(results: LighthouseAuditResult[]): string {
  const failed = uniqueLighthouseAudits(results.flatMap((result) => result.failedAudits));
  const manual = uniqueLighthouseAudits(results.flatMap((result) => result.manualAudits));
  if (failed.length === 0 && manual.length === 0) return "";

  const cards = [
    ...failed.slice(0, 8).map((audit) => renderLighthouseRecommendationCard(audit, "Failed audit")),
    ...manual.slice(0, 4).map((audit) => renderLighthouseRecommendationCard(audit, "Manual review", true))
  ].join("");

  return `<div class="lighthouse-recommendations" aria-label="Lighthouse recommendations">
    ${cards}
  </div>`;
}

function renderLighthouseRecommendationCard(audit: LighthouseAuditResult["failedAudits"][number], label: string, manual = false): string {
  const className = manual ? "lighthouse-card lighthouse-card-manual" : "lighthouse-card";
  const docs = audit.documentationUrl
    ? `<p><a href="${escapeAttribute(audit.documentationUrl)}" target="_blank" rel="noopener noreferrer">Open Lighthouse guidance</a></p>`
    : "";

  return `<article class="${className}">
    <h3>${escapeHtml(label)}</h3>
    <p><code>${escapeHtml(audit.id)}</code></p>
    <p><strong>${escapeHtml(audit.title)}</strong></p>
    ${audit.description ? `<p class="muted">${escapeHtml(audit.description)}</p>` : ""}
    ${docs}
  </article>`;
}

function uniqueLighthouseAudits(audits: LighthouseAuditResult["failedAudits"]): LighthouseAuditResult["failedAudits"] {
  const seen = new Set<string>();
  const unique: LighthouseAuditResult["failedAudits"] = [];
  for (const audit of audits) {
    if (seen.has(audit.id)) continue;
    seen.add(audit.id);
    unique.push(audit);
  }
  return unique.sort((left, right) => left.id.localeCompare(right.id));
}

function addIssueTarget(targets: Set<string>, issue: DedupedIssue): void {
  const target = issueTarget(issue);
  if (target) targets.add(target);
}

function issueTarget(issue: DedupedIssue): string {
  return issue.file || issue.selector || "";
}

function renderKeyboardAudit(audit: KeyboardAuditResult): string {
  const attempts = audit.activationAttempts || [];
  return `<section class="panel keyboard-audit" id="keyboard-audit" aria-label="Keyboard audit">
    <h2>Keyboard Audit</h2>
    <p class="muted">Bounded keyboard evidence for the first Tab path. Use this to spot invisible focus, obscured controls, keyboard traps, and unexpected focus order.</p>
    ${renderKeyboardReviewSummary(audit)}
    <div class="summary">
      ${metric("Focusable controls", audit.focusableCount)}
      ${metric("Forward steps", audit.steps.length)}
      ${metric("Reverse steps", audit.backwardSteps.length)}
      ${metric("Activation attempts", attempts.length)}
    </div>
    ${renderKeyboardFocusPath(audit.steps)}
    <details>
      <summary>Complete focus path data</summary>
      <table aria-label="Complete keyboard focus path">
        <thead><tr><th>Step</th><th>Direction</th><th>Target</th><th>Role</th><th>Name</th><th>Indicator</th><th>Obscured</th></tr></thead>
        <tbody>${[...audit.steps, ...audit.backwardSteps].map((step) => `<tr>
          <td>${step.index}</td><td>${escapeHtml(step.direction)}</td><td><code>${escapeHtml(step.selector)}</code></td>
          <td>${escapeHtml(step.role || step.tagName)}</td><td>${escapeHtml(step.accessibleName || "none")}</td>
          <td>${step.indicatorVisible ? "yes" : "no"}</td><td>${step.obscured ? "yes" : "no"}</td>
        </tr>`).join("") || '<tr><td colspan="7">No focus steps recorded.</td></tr>'}</tbody>
      </table>
    </details>
    ${attempts.length > 0 ? `<details><summary>Activation evidence</summary><table aria-label="Keyboard activation evidence">
      <thead><tr><th>Key</th><th>Target</th><th>Role</th><th>Outcome</th><th>Reason or focus after</th></tr></thead>
      <tbody>${attempts.map((attempt) => `<tr><td>${escapeHtml(attempt.key)}</td><td><code>${escapeHtml(attempt.selector)}</code></td><td>${escapeHtml(attempt.role)}</td><td>${escapeHtml(attempt.outcome)}</td><td>${escapeHtml(attempt.reason || attempt.focusAfter || "none")}</td></tr>`).join("")}</tbody>
    </table></details>` : ""}
  </section>`;
}

function renderKeyboardReviewSummary(audit: KeyboardAuditResult): string {
  const risks = audit.steps.filter((step) => keyboardStepRisks(step).length > 0);
  const cycleStatus = audit.completedCycle
    ? ["Tab cycle reached the start again", "No obvious keyboard trap in bounded traversal", false] as const
    : ["Tab cycle incomplete", `Traversal stopped before returning to the start within ${audit.maxTabs} Tab presses`, true] as const;
  const reverseStatus = audit.reverseOrderMatches === null
    ? ["Reverse order not checked", "Run Shift+Tab review manually for complex widgets", true] as const
    : audit.reverseOrderMatches
      ? ["Shift+Tab order matches", "Forward and reverse traversal were consistent", false] as const
      : ["Shift+Tab order mismatch", "Review whether backward focus order is logical", true] as const;
  const visibilityStatus = risks.length === 0
    ? ["Focus visibility looks ok", "No invisible or obscured focus steps were detected", false] as const
    : [`${risks.length} focus step${risks.length === 1 ? "" : "s"} need review`, "Check orange steps in the visual Tab order below", true] as const;

  return `<div class="keyboard-summary-grid" aria-label="Keyboard review summary">
    ${keyboardReviewCard(visibilityStatus[0], visibilityStatus[1], visibilityStatus[2])}
    ${keyboardReviewCard(cycleStatus[0], cycleStatus[1], cycleStatus[2])}
    ${keyboardReviewCard(reverseStatus[0], reverseStatus[1], reverseStatus[2])}
  </div>`;
}

function keyboardReviewCard(title: string, detail: string, warning: boolean): string {
  return `<div class="keyboard-review-card${warning ? " keyboard-review-card-warning" : ""}">
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(detail)}</span>
  </div>`;
}

function renderKeyboardFocusPath(steps: KeyboardAuditResult["steps"]): string {
  if (steps.length === 0) {
    return `<div class="visual-tab-order" aria-label="Visual Tab order"><h3>Visual Tab Order</h3><p class="muted">No forward focus steps were recorded.</p></div>`;
  }

  const visibleSteps = steps.slice(0, 20);
  const items = visibleSteps.map((step, index) => {
    const risks = keyboardStepRisks(step);
    const className = risks.length > 0 ? "focus-path-item focus-path-item-risk" : "focus-path-item";
    const name = step.accessibleName || step.selector || "Unnamed control";
    const role = step.role || step.tagName || "control";

    return `<li class="${className}">
      <span class="focus-path-number" aria-hidden="true">${index + 1}</span>
      <span class="visually-hidden">Tab step ${index + 1}: </span>
      <span class="focus-path-name">${escapeHtml(name)}</span>
      <span class="focus-path-meta">${escapeHtml(role)}</span>
      ${risks.length > 0 ? `<span class="focus-path-risk-list">${risks.map((risk) => `<span class="focus-path-risk">${escapeHtml(risk)}</span>`).join("")}</span>` : ""}
    </li>`;
  }).join("");
  const truncated = steps.length > visibleSteps.length
    ? `<p class="muted focus-path-note">Showing the first ${visibleSteps.length} of ${steps.length} forward steps. Complete selector data remains in the table below.</p>`
    : "";

  return `<div class="visual-tab-order" aria-label="Visual Tab order">
    <h3>Visual Tab Order</h3>
    <p class="muted">Follow the numbered controls from left to right. Orange steps require review.</p>
    <div class="focus-path-scroll-wrapper">
      <ol class="focus-path" tabindex="0" aria-label="Forward keyboard focus path" data-focus-path-scroll>${items}</ol>
      <div class="focus-path-scrollbar" aria-hidden="true" data-focus-path-scrollbar>
        <span class="focus-path-scrollbar-thumb" data-focus-path-scrollbar-thumb></span>
      </div>
    </div>
    ${truncated}
  </div>`;
}

function keyboardStepRisks(step: KeyboardAuditResult["steps"][number]): string[] {
  return [
    !step.indicatorVisible ? "Focus not visible" : "",
    step.obscured ? "Obscured" : "",
    !step.visible ? "Not visibly rendered" : ""
  ].filter(Boolean);
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
  const forcedColorStates = graph.states.filter((state) => state.forcedColors);
  const forcedColorSamples = forcedColorStates.reduce((total, state) => total + (state.forcedColors?.samples.length || 0), 0);
  const forcedColorUnsupported = forcedColorStates.some((state) => state.forcedColors?.supported === false);
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
  const embeddedFindingCount = countIssues((issue) => issue.source === "embedded-content");
  const appearanceFindingCount = countIssues((issue) => issue.category === "contrast" && issue.source !== "forced-colors");
  const rows = [
    coverageRow("browser-automation", "Browser automation", evidenceState(dynamicFindingCount), "Automated", `${graph.summary.statesVisited} rendered state${graph.summary.statesVisited === 1 ? "" : "s"} scanned with axe`, true, dynamicFindingCount),
    coverageRow("static-source", "Static source analysis", staticAdapterFailed ? "unavailable" : evidenceState(staticFindingCount), staticAdapterFailed ? "Setup required" : "Automated", staticAdapterFailed ? "Install or configure the detected framework adapter, then run the audit again" : "Project source files checked with the configured accessibility lint adapter", !staticAdapterFailed, staticFindingCount),
    coverageRow("keyboard", "Keyboard traversal", options.keyboard ? evidenceState(keyboardFindingCount) : "not-tested", options.keyboard ? "Automated evidence" : "Run keyboard audit", options.keyboard ? `${options.keyboard.steps.length} forward focus steps recorded; complete task testing may still be required` : `Run <code>${escapeHtml(keyboardCommand)}</code>`, Boolean(options.keyboard), options.keyboard ? keyboardFindingCount : undefined),
    coverageRow("lighthouse", "Lighthouse score", options.lighthouse ? evidenceState(lighthouseFailedAudits) : "not-tested", options.lighthouse ? "Comparison evidence" : "Optional comparison", options.lighthouse ? `${options.lighthouse.length} page score${options.lighthouse.length === 1 ? "" : "s"} captured` : `Install <code>lighthouse</code>, then run <code>${escapeHtml(lighthouseCommand)}</code>`, Boolean(options.lighthouse), options.lighthouse ? lighthouseFailedAudits : undefined),
    coverageRow("appearance", "Light and dark appearance", evidenceState(appearanceFindingCount), "Automated evidence", themes.length > 0 ? escapeHtml(themes.join(", ")) : "No distinct system color-scheme state detected", true, appearanceFindingCount),
    coverageRow("forced-colors", "Forced colors / high contrast", forcedColorUnsupported ? "unavailable" : evidenceState(countIssues((issue) => issue.source === "forced-colors")), forcedColorUnsupported ? "Browser support unavailable" : "Automated heuristics", forcedColorStates.length > 0 ? `${forcedColorStates.length} state${forcedColorStates.length === 1 ? "" : "s"} checked; ${forcedColorSamples} review signal${forcedColorSamples === 1 ? "" : "s"} collected` : "No forced-colors evidence collected", forcedColorStates.length > 0, forcedColorStates.length > 0 ? countIssues((issue) => issue.source === "forced-colors") : undefined),
    coverageRow("reflow", "Reflow at 400% (320 CSS px simulation)", reflowStates.length > 0 ? evidenceState(countIssues((issue) => issue.source === "layout")) : "not-tested", reflowStates.length > 0 ? "Automated evidence" : "Review required", reflowStates.length > 0 ? `${reflowStates.length} state${reflowStates.length === 1 ? "" : "s"} checked for overflow and clipped text` : "This audit did not collect reflow evidence; run a reflow check to verify overflow and clipped text.", reflowStates.length > 0, reflowStates.length > 0 ? countIssues((issue) => issue.source === "layout") : undefined),
    coverageRow("modal-focus", "Modal focus behavior", modalStates.length > 0 ? evidenceState(countIssues((issue) => issue.source === "modal")) : "needs-review", modalStates.length > 0 ? "Automated evidence" : "Review if applicable", modalStates.length > 0 ? `${modalStates.length} state${modalStates.length === 1 ? "" : "s"} checked for name, initial focus, Escape, and focus restoration` : "No modal opened during this audit; open any dialog and check initial focus, Escape, and focus return manually.", modalStates.length > 0, modalStates.length > 0 ? countIssues((issue) => issue.source === "modal") : undefined),
    coverageRow("announcements", "Dynamic announcements", announcementStates.length > 0 ? "passed" : "needs-review", announcementStates.length > 0 ? "Automated evidence" : "Review if applicable", `${announcementUpdates} meaningful live-region update${announcementUpdates === 1 ? "" : "s"} observed after ${announcementStates.length} action${announcementStates.length === 1 ? "" : "s"}`, announcementStates.length > 0, announcementStates.length > 0 ? 0 : undefined),
    coverageRow("form-errors", "Form error states", formStates.length > 0 ? evidenceState(countIssues((issue) => issue.category === "forms")) : "needs-review", formStates.length > 0 ? "Automated evidence" : "Review if applicable", formStates.length > 0 ? `${invalidFields} explicit invalid field${invalidFields === 1 ? "" : "s"}; ${unassociatedInvalidFields} without an exposed associated error` : "No rendered form error state was observed", formStates.length > 0, formStates.length > 0 ? countIssues((issue) => issue.category === "forms") : undefined),
    coverageRow("image-alternatives", "Image alternatives", evidenceState(countIssues((issue) => issue.category === "images")), imageStates.length > 0 ? "Automated heuristics" : "No images observed", `${suspiciousImages} image alternative${suspiciousImages === 1 ? "" : "s"} flagged for human review across ${imageStates.length} state${imageStates.length === 1 ? "" : "s"}`, true, countIssues((issue) => issue.category === "images")),
    coverageRow("media-motion", "Media and motion", mediaStates.length > 0 ? evidenceState(countIssues((issue) => issue.category === "media")) : "needs-review", mediaStates.length > 0 ? "Automated evidence" : "Review if applicable", `${mediaElements} audio/video element${mediaElements === 1 ? "" : "s"}; ${autoplayRisks} autoplay control risk${autoplayRisks === 1 ? "" : "s"}`, mediaStates.length > 0, mediaStates.length > 0 ? countIssues((issue) => issue.category === "media") : undefined),
    coverageRow("embedded-content", "Embedded content", inaccessibleFrames > 0 ? "unavailable" : evidenceState(embeddedFindingCount), embeddedStates.length > 0 ? "Automated evidence" : "No embeds observed", `${iframeCount} iframe${iframeCount === 1 ? "" : "s"}; ${inaccessibleFrames} unavailable document${inaccessibleFrames === 1 ? "" : "s"}; ${canvasGaps} canvas alternative gap${canvasGaps === 1 ? "" : "s"}`, true, embeddedFindingCount),
    coverageRow("screen-reader", "Screen reader", "needs-review", "Human review required", "Test representative tasks with NVDA, JAWS, or VoiceOver"),
    coverageRow("content-usability", "Content and task usability", "needs-review", options.manualChecklist ? "Checklist ready" : "Human review required", "Record tester, environment, evidence, and outcome")
  ];
  const stateCounts = countCoverageStates(rows);
  const orderedRows = rows
    .sort((left, right) => Number(right.automated) - Number(left.automated))
    .map((row) => row.html);

  return `<section class="panel triage" aria-label="Audit coverage matrix">
    <h2>Audit Coverage</h2>
    <p class="muted">Green checked rows contain evidence collected by this audit. Complete the yellow rows manually; your selections stay in this browser for this generated report.</p>
    ${renderCoverageLegend(stateCounts)}
    <p class="coverage-progress" data-coverage-progress aria-live="polite"></p>
    <div class="coverage-table-wrap">
      <table class="coverage-table" aria-label="Audit coverage matrix">
        <thead><tr><th scope="col">Review</th><th scope="col">Area</th><th scope="col">Evidence state</th><th scope="col">Status</th><th scope="col">Findings</th><th scope="col">Evidence or next step</th></tr></thead>
        <tbody>${orderedRows.join("\n")}</tbody>
      </table>
    </div>
  </section>`;
}

function countCoverageStates(rows: CoverageMatrixRow[]): CoverageStateCounts {
  const counts: CoverageStateCounts = {
    passed: 0,
    failed: 0,
    "needs-review": 0,
    "not-tested": 0,
    unavailable: 0
  };

  for (const row of rows) {
    counts[row.evidenceState] += 1;
  }

  return counts;
}

function renderCoverageLegend(counts: CoverageStateCounts): string {
  const labels: Array<[CoverageEvidenceState, string]> = [
    ["failed", "Failed evidence"],
    ["needs-review", "Needs review"],
    ["not-tested", "Not tested"],
    ["unavailable", "Unavailable"],
    ["passed", "Passed evidence"]
  ];

  return `<div class="coverage-legend" aria-label="Audit coverage evidence state summary">
    ${labels.map(([state, label]) => `<div class="coverage-legend-item coverage-legend-${state}">
      <span class="coverage-legend-swatch" aria-hidden="true"></span>
      <strong>${counts[state]}</strong>
      <span>${escapeHtml(label)}</span>
    </div>`).join("")}
  </div>`;
}

function evidenceState(findingCount: number): CoverageEvidenceState {
  return findingCount > 0 ? "failed" : "passed";
}

function coverageRow(
  id: string,
  area: string,
  state: CoverageEvidenceState,
  status: string,
  evidence: string,
  automated = false,
  findingCount?: number
): CoverageMatrixRow {
  const checkboxLabel = automated
    ? `${area}: evidence collected automatically`
    : `${area}: mark manual review complete`;
  const html = `<tr class="coverage-row-${automated ? "automated" : "review"} coverage-row-state-${state}"${automated ? "" : ` data-coverage-review="${escapeAttribute(id)}"`}>
    <td class="coverage-check-cell"><label><span class="visually-hidden">${escapeHtml(checkboxLabel)}</span><input type="checkbox"${automated ? " checked disabled" : ""}></label></td>
    <th scope="row">${escapeHtml(area)}</th>
    <td class="coverage-state-cell"><span class="coverage-state coverage-state-${state}"${automated ? "" : ` data-coverage-state data-default-state="${escapeAttribute(state)}"`}>${escapeHtml(state)}</span></td>
    <td class="coverage-status-cell"><span class="coverage-status coverage-status-${automated ? "automated" : "review"}"${automated ? "" : ` data-coverage-status data-default-status="${escapeAttribute(status)}"`}>${escapeHtml(status)}</span></td>
    <td class="coverage-findings">${findingCount === undefined ? "&mdash;" : findingCount}</td>
    <td>${evidence}</td>
  </tr>`;

  return {
    automated,
    evidenceState: state,
    html
  };
}

function renderManualChecklist(checklist: ManualChecklist): string {
  const targetedItems = checklist.items.filter((item) => item.targets?.length).length;
  return `<section class="panel panel-full-width manual-review-checklist" id="manual-review-checklist" aria-label="Manual review checklist">
    <h2>Manual Review Checklist</h2>
    <p class="muted">Automated checks cover only part of accessibility. ${targetedItems > 0 ? `${targetedItems} review area${targetedItems === 1 ? " has" : "s have"} observed targets from this audit.` : "Choose representative targets for the areas below."} Record human review evidence and outcomes.</p>
    <p class="manual-checklist-progress" data-manual-checklist-progress>Manual checks remaining: ${checklist.items.length} of ${checklist.items.length}.</p>
    ${renderManualEnvironmentTemplate()}
    ${checklist.items.map((item) => `<article class="manual-checklist-item" data-manual-checklist-item="${escapeAttribute(item.id)}">
      <div class="manual-checklist-header">
        <input type="checkbox" aria-label="Mark ${escapeAttribute(item.title)} as reviewed" data-manual-checklist-checkbox>
        <span class="manual-checklist-title">${escapeHtml(item.title)} (${escapeHtml(item.wcag.join(", "))})${item.targets?.length ? ` — ${item.targets.length} target${item.targets.length === 1 ? "" : "s"}` : ""}</span>
      </div>
      <details>
        <summary>Review guidance</summary>
        <p>${escapeHtml(item.whyManual)}</p>
        ${renderManualTargets(item.targets)}
        <ol>${item.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
        <p class="muted">Suggested evidence: ${escapeHtml(item.evidence.join("; "))}</p>
      </details>
    </article>`).join("")}
  </section>`;
}

function renderManualEnvironmentTemplate(): string {
  const fields = [
    ["Operating system", "Example: Windows 11, macOS 15, iOS 18"],
    ["Browser", "Example: Chrome 126, Safari 18, Edge 126"],
    ["Assistive technology", "Example: NVDA 2026.1, JAWS 2026, VoiceOver"],
    ["Input method", "Example: keyboard only, touch, switch, voice"],
    ["Viewport or zoom", "Example: 390px mobile, 200%, 400%"],
    ["Color mode", "Example: light, dark, forced colors"]
  ];

  return `<div class="manual-env-grid" aria-label="Manual test environment fields">
    ${fields.map(([label, hint]) => `<div class="manual-env-field">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(hint)}</span>
    </div>`).join("")}
  </div>`;
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
      ${state.screenshotEvidence?.some((evidence) => evidence.kind === "evidence-crop")
        ? `<span class="badge">${state.screenshotEvidence.length} focused evidence capture${state.screenshotEvidence.length === 1 ? "" : "s"}</span>`
        : ""}
      ${state.visualDuplicateOf ? `<span class="badge">visual reused from ${escapeHtml(state.visualDuplicateOf)}</span>` : ""}
    </div>
    ${renderIssues(state.issues, state.annotationNumberByIssueKey)}
    ${renderAccessibilityTreeEvidence(state)}
    ${renderReflowEvidence(state)}
    ${renderForcedColorsEvidence(state)}
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
      ${state.visualDuplicateOf ? `<span class="badge">visual reused from ${escapeHtml(state.visualDuplicateOf)}</span>` : ""}
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
      ? `<table aria-label="Dynamic announcement updates"><thead><tr><th>Region</th><th>Role</th><th>Politeness</th><th>Observed text</th></tr></thead><tbody>${evidence.updates.map((update) => `<tr><td><code>${escapeHtml(update.selector)}</code></td><td>${escapeHtml(update.role || "none")}</td><td>${escapeHtml(update.politeness)}</td><td>${escapeHtml(update.text || "empty")}</td></tr>`).join("")}</tbody></table>`
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
      ? `<table aria-label="Form error evidence fields"><thead><tr><th>Field</th><th>Name</th><th>Error references</th><th>Exposed error text</th><th>Focused</th></tr></thead><tbody>${evidence.invalidFields.map((field) => `<tr><td><code>${escapeHtml(field.selector)}</code></td><td>${escapeHtml(field.accessibleName || "unnamed")}</td><td>${escapeHtml(field.errorReferenceIds.join(", ") || "none")}</td><td>${escapeHtml(field.associatedErrorText || "none")}</td><td>${field.focused ? "yes" : "no"}</td></tr>`).join("")}</tbody></table>`
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
      ? `<table aria-label="Image alternative text evidence"><thead><tr><th>Image</th><th>Current alternative</th><th>Review reasons</th></tr></thead><tbody>${evidence.samples.map((sample) => `<tr><td><code>${escapeHtml(sample.selector)}</code></td><td>${escapeHtml(sample.alt)}</td><td>${escapeHtml(sample.concerns.join(", "))}${sample.repeatedCount ? ` (${sample.repeatedCount} uses)` : ""}</td></tr>`).join("")}</tbody></table>`
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
      ? `<table aria-label="Media and motion evidence elements"><thead><tr><th>Element</th><th>Kind</th><th>Captions</th><th>Transcript candidate</th><th>Autoplay</th><th>Muted</th><th>Controls</th></tr></thead><tbody>${evidence.elements.map((element) => `<tr><td><code>${escapeHtml(element.selector)}</code></td><td>${element.kind}</td><td>${element.captionTrackCount}</td><td>${element.transcriptCandidate ? "yes" : "no"}</td><td>${element.autoplay ? "yes" : "no"}</td><td>${element.muted ? "yes" : "no"}</td><td>${element.controls ? "yes" : "no"}</td></tr>`).join("")}</tbody></table>`
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
    ${evidence.iframes.length > 0 ? `<h4>Frames</h4><table aria-label="Iframe evidence"><thead><tr><th>Frame</th><th>Document</th><th>Origin</th><th>Title</th><th>DOM coverage</th></tr></thead><tbody>${evidence.iframes.map((frame) => `<tr><td><code>${escapeHtml(frame.selector)}</code></td><td>${escapeHtml(frame.url)}</td><td>${frame.sameOrigin ? "same" : "cross"}</td><td>${escapeHtml(frame.title || "missing")}</td><td>${frame.browserAccessible ? "available" : "unavailable"}</td></tr>`).join("")}</tbody></table>` : ""}
    ${evidence.canvases.length > 0 ? `<h4>Canvas</h4><table aria-label="Canvas evidence"><thead><tr><th>Canvas</th><th>Size</th><th>Decorative</th><th>Accessible alternative</th></tr></thead><tbody>${evidence.canvases.map((canvas) => `<tr><td><code>${escapeHtml(canvas.selector)}</code></td><td>${canvas.width} x ${canvas.height}</td><td>${canvas.decorative ? "yes" : "no"}</td><td>${canvas.hasAccessibleAlternative ? "detected" : "not detected"}</td></tr>`).join("")}</tbody></table>` : ""}
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
    <table aria-label="Modal focus evidence">
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

function renderForcedColorsEvidence(state: ExplorationState): string {
  const evidence = state.forcedColors;
  if (!evidence || (!evidence.error && evidence.samples.length === 0)) return "";
  const concernLabel = (value: string): string => ({
    "focus-indicator": "Focus indicator",
    "background-image": "Background image",
    "hard-coded-svg-color": "Hard-coded SVG color",
    "forced-color-adjust-none": "Opted out of forced colors"
  }[value] || value);

  return `<details>
    <summary>Forced colors / high contrast evidence</summary>
    <div class="summary">
      ${metric("Controls checked", evidence.controlsChecked)}
      ${metric("Focus risks", evidence.focusRiskCount, evidence.focusRiskCount > 0 ? "warning" : undefined)}
      ${metric("Background image risks", evidence.backgroundImageRiskCount, evidence.backgroundImageRiskCount > 0 ? "warning" : undefined)}
      ${metric("SVG color risks", evidence.svgColorRiskCount, evidence.svgColorRiskCount > 0 ? "warning" : undefined)}
      ${metric("forced-color-adjust: none", evidence.forcedColorAdjustNoneCount, evidence.forcedColorAdjustNoneCount > 0 ? "warning" : undefined)}
    </div>
    ${evidence.error ? `<p class="muted">Forced-colors emulation was unavailable: ${escapeHtml(evidence.error)}</p>` : ""}
    ${evidence.samples.length > 0
      ? `<table aria-label="Forced colors and high contrast evidence"><thead><tr><th>Concern</th><th>Element</th><th>Label</th><th>Evidence</th></tr></thead><tbody>${evidence.samples.map((sample) => `<tr><td>${escapeHtml(concernLabel(sample.concern))}</td><td><code>${escapeHtml(sample.selector)}</code></td><td>${escapeHtml(sample.label || "unnamed")}</td><td>${escapeHtml(sample.detail)}</td></tr>`).join("")}</tbody></table>`
      : '<p class="muted">No deterministic forced-colors review signals were detected.</p>'}
    <p class="muted">This is a bounded heuristic. Confirm critical controls, icons, and state indicators in Windows High Contrast or another system high-contrast mode.</p>
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
  const lightboxAnnotations = annotationsForEvidence(state, evidence.path, evidence);
  const reusedFrom = inferStateIdFromScreenshot(evidence.path);
  const reuseNote = reusedFrom && reusedFrom !== state.id
    ? `<span class="screenshot-reuse-note">Reused visual evidence from ${escapeHtml(reusedFrom)}</span>`
    : "";
  const targetId = index === 0
    ? `screenshot-${state.id}`
    : `screenshot-${state.id}-${index + 1}`;
  const fullPage = evidence.kind === "full-page";
  const frameClass = fullPage
    ? "screenshot-frame screenshot-frame-full"
    : "screenshot-frame";
  const frameStyle = evidence.width && evidence.height
    ? ` style="--screenshot-aspect: ${evidence.width} / ${evidence.height}"`
    : "";
  const openLabel = fullPage
    ? "Open scrollable full-page screenshot"
    : evidence.kind === "evidence-crop"
      ? `Open focused evidence ${index + 1}`
      : "Open annotated screenshot";
  const screenshotAlt = fullPage
    ? `Full-page evidence for ${state.id}`
    : evidence.kind === "evidence-crop"
      ? `Focused accessibility evidence ${index + 1} for ${state.id}`
      : `Screenshot for ${state.id}`;

  return `<div class="${frameClass}"${frameStyle}>
    <div class="screenshot-scroll">
      <div class="screenshot-stage">
        <img src="${escapeAttribute(evidence.path)}" alt="${escapeAttribute(screenshotAlt)}">
        ${renderAnnotationLayer(previewAnnotations)}
      </div>
    </div>
    ${reuseNote}
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
  const hasSpecificEvidence = Boolean(state.screenshotEvidence?.length);
  const issues = matchingIssues.length > 0 || hasSpecificEvidence
    ? matchingIssues
    : state.issues;

  return issues
    .filter((issue) => issue.elementBounds)
    .sort(compareIssuesForAnnotationOrder)
    .filter((issue, index, sortedIssues) =>
      sortedIssues.findIndex((candidate) => annotationVisualKey(candidate) === annotationVisualKey(issue)) === index
    )
    .slice(0, 12)
    .map((issue, index) => renderAnnotation(
      issue,
      state.annotationNumberByIssueKey[annotationIssueKey(issue)] || index + 1,
      evidence,
      state.annotationSeverityByKey[annotationSeverityKey(issue)]
    ))
    .join("\n");
}

function renderAnnotatedScreenshotView(
  state: StateViewModel,
  screenshot: string,
  annotations: string,
  screenshotTargetId: string
): string {
  return `<div class="screenshot-lightbox" id="${escapeAttribute(screenshotTargetId)}" role="dialog" aria-label="Annotated screenshot for ${escapeAttribute(state.id)}">
    <a class="screenshot-lightbox-backdrop" href="#${escapeAttribute(state.id)}" aria-label="Close annotated screenshot"></a>
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
  evidence?: NonNullable<ExplorationState["screenshotEvidence"]>[number],
  severityOverride?: Severity
): string {
  const bounds = issue.elementBounds;
  if (!bounds) return "";
  const severity = severityOverride || issue.severity;

  const renderedBounds = evidence?.width && evidence.height && evidence.kind !== "full-page"
    ? transformBoundsForContainedPreview(bounds, evidence.width, evidence.height, evidence.width / evidence.height)
    : bounds;

  return `<span
    class="annotation annotation-${severity}"
    title="${escapeAttribute(`${index}. ${severity} ${issue.ruleId}: ${issue.message}`)}"
    style="${formatBoundsStyle(renderedBounds)}"
  ><span class="annotation-number">${index}</span></span>`;
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
  const topStates = rankAffectedStates(states, 5);
  const ruleSummaries = summarizeRules(issues);
  const topRuleLimit = calculateTopRuleLimit(topStates, ruleSummaries);

  return `<h2>Triage Overview</h2>
  <div class="triage-grid">
    <div>
      <h3>Most Affected States</h3>
      ${renderTopStates(topStates)}
    </div>
    <div>
      <h3>Top Rules</h3>
      ${renderTopRules(ruleSummaries, topRuleLimit)}
    </div>
  </div>`;
}

function rankAffectedStates(states: StateViewModel[], limit: number): StateViewModel[] {
  return states
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
    .slice(0, limit);
}

function renderTopStates(rankedStates: StateViewModel[]): string {
  if (rankedStates.length === 0) {
    return `<p class="muted">No affected states were detected by automated exploration.</p>`;
  }

  return `<ol class="triage-list">
    ${rankedStates.map((state) => {
      const summary = summarizeIssues(state.issues);
      return `<li class="triage-item">
        <div class="triage-title">
          <a href="#${escapeAttribute(state.id)}"><strong>${escapeHtml(state.id)}</strong></a>
        </div>
        <div class="badges">
          ${summary.critical ? badge("critical", `${summary.critical} critical`) : ""}
          ${summary.warning ? badge("warning", `${summary.warning} warning`) : ""}
          ${summary.info ? badge("info", `${summary.info} info`) : ""}
        </div>
        <div class="url">${escapeHtml(state.url)}</div>
      </li>`;
    }).join("\n")}
  </ol>`;
}

function calculateTopRuleLimit(
  topStates: StateViewModel[],
  ruleSummaries: ReturnType<typeof summarizeRules>
): number {
  if (ruleSummaries.length === 0) return 0;
  const targetHeightUnits = Math.max(1, topStates.length) * 3;
  let usedUnits = 0;
  let limit = 0;

  for (const rule of ruleSummaries.slice(0, 5)) {
    const nextUnits = estimateTopRuleHeightUnits(rule);
    if (limit > 0 && usedUnits + nextUnits > targetHeightUnits) break;
    usedUnits += nextUnits;
    limit += 1;
  }

  return Math.min(ruleSummaries.length, 5, Math.max(3, limit));
}

function estimateTopRuleHeightUnits(rule: ReturnType<typeof summarizeRules>[number]): number {
  return 2
    + (rule.criteria.length > 0 ? 1 : 0)
    + (renderRuleImpactSignal(rule) ? 1 : 0)
    + (rule.states.length > 0 ? 1 : 0);
}

function renderTopRules(allRuleSummaries: ReturnType<typeof summarizeRules>, limit: number): string {
  const ruleSummaries = allRuleSummaries.slice(0, limit);
  const hiddenRuleCount = Math.max(0, allRuleSummaries.length - ruleSummaries.length);

  if (ruleSummaries.length === 0) {
    return `<p class="muted">No rule findings were detected by automated exploration.</p>`;
  }

  return `<ol class="triage-list">
    ${ruleSummaries.map((rule) => {
      return `<li class="triage-item">
      <div class="triage-title">
        <code>${escapeHtml(rule.ruleId)}</code>
      </div>
      <div class="badges">
        ${findingTypeBadge(rule.findingType)}
        ${rule.critical ? badge("critical", `${rule.critical} critical`) : ""}
        ${rule.warning ? badge("warning", `${rule.warning} warning`) : ""}
        ${rule.info ? badge("info", `${rule.info} info`) : ""}
      </div>
      ${rule.criteria.length > 0 ? `<div class="url">${escapeHtml(rule.criteria.join(", "))}</div>` : ""}
      ${renderRuleImpactSignal(rule)}
      ${rule.states.length > 0 ? `<div class="url">States: ${rule.states.map((stateId) => `<a href="#${escapeAttribute(stateId)}">${escapeHtml(stateId)}</a>`).join(", ")}</div>` : ""}
    </li>`;
    }).join("\n")}
  </ol>
  ${hiddenRuleCount > 0 ? `<p class="muted triage-more">+ ${hiddenRuleCount} more rule${hiddenRuleCount === 1 ? "" : "s"} shown in the state findings below.</p>` : ""}`;
}

function renderRuleImpactSignal(rule: ReturnType<typeof summarizeRules>[number]): string {
  const signals = [
    rule.occurrenceCount > 1 ? `${rule.occurrenceCount} occurrences` : "",
    rule.pages.length > 1 ? `${rule.pages.length} pages affected` : "",
    rule.states.length > 1 ? `${rule.states.length} states affected` : "",
    rule.targets.length > 1 ? `${rule.targets.length} target patterns` : ""
  ].filter(Boolean);
  const fixScope = formatRuleFixScope(rule);

  if (signals.length === 0 && !fixScope) return "";

  return `<div class="url rule-impact">${escapeHtml([...signals, fixScope].filter(Boolean).join(" · "))}</div>`;
}

function formatRuleFixScope(rule: ReturnType<typeof summarizeRules>[number]): string {
  if (rule.pages.length > 1 && rule.targets.length <= 1) {
    return "likely shared component or template";
  }

  if (rule.pages.length > 1) {
    return "cross-page pattern";
  }

  if (rule.occurrenceCount > 1 && rule.targets.length <= 3) {
    return "repeated local pattern";
  }

  if (rule.targets.length > 3) {
    return "multiple target patterns";
  }

  return "";
}

function renderIssues(
  issues: DedupedIssue[],
  annotationNumberByIssueKey: Record<string, number> = {}
): string {
  if (issues.length === 0) {
    return `<p class="muted">No automated findings in this state.</p>`;
  }

  const groups = new Map<string, DedupedIssue[]>();
  for (const issue of issues) {
    const current = groups.get(issue.ruleId) || [];
    current.push(issue);
    groups.set(issue.ruleId, current);
  }

  const rankedGroups = [...groups.entries()].sort(compareIssueGroupEntries);
  const visibleGroups = rankedGroups.slice(0, 8);
  const remainingGroups = rankedGroups.slice(8);

  return `<ul class="issue-list">
    ${visibleGroups.map(([ruleId, groupIssues]) => renderStateIssueGroup(ruleId, groupIssues, annotationNumberByIssueKey)).join("\n")}
  </ul>
  ${remainingGroups.length > 0 ? `<details>
    <summary>Show ${remainingGroups.length} more rule group${remainingGroups.length === 1 ? "" : "s"}</summary>
    <ul class="issue-list">${remainingGroups.map(([ruleId, groupIssues]) => renderStateIssueGroup(ruleId, groupIssues, annotationNumberByIssueKey)).join("\n")}</ul>
  </details>` : ""}`;
}

function renderNonVisualIssues(issues: DedupedIssue[]): string {
  if (issues.length === 0) return "";
  const issueSummary = summarizeIssues(issues);
  const stateSeverity = issueSummary.critical > 0
    ? "critical"
    : issueSummary.warning > 0
      ? "warning"
      : "info";
  const issueBadges = [
    issueSummary.critical ? badge("critical", `${issueSummary.critical} critical`) : "",
    issueSummary.warning ? badge("warning", `${issueSummary.warning} warning`) : "",
    issueSummary.info ? badge("info", `${issueSummary.info} info`) : ""
  ].filter(Boolean).join("");

  return `<article class="state state-${stateSeverity} non-visual-findings" aria-label="Non-visual findings">
    <div class="non-visual-finding-summary">Source and keyboard findings</div>
    <div class="state-body">
      <div class="state-title">
        <div>
          <h3>Non-visual Findings</h3>
          <p class="muted">These findings are not tied to a captured browser screenshot.</p>
        </div>
      </div>
      <div class="badges">${issueBadges}</div>
      ${renderIssues(issues)}
    </div>
  </article>`;
}

function renderStateIssueGroup(
  ruleId: string,
  issues: DedupedIssue[],
  annotationNumberByIssueKey: Record<string, number> = {}
): string {
  const sortedIssues = [...issues].sort(compareIssuesForTriage);
  const displayGroups = groupStateIssuesForDisplay(sortedIssues);
  const summary = summarizeIssues(sortedIssues);
  const colorSchemes = [...new Set(sortedIssues.map((issue) => issue.colorScheme).filter(Boolean))];
  const criteria = uniqueWcagCriteria(sortedIssues);
  const levels = [...new Set(criteria.map((criterion) => criterion.level))];
  const findingTypes = [...new Set(sortedIssues.map((issue) => issue.findingType))];
  const ownershipLabels = [...new Set(sortedIssues.map((issue) => issue.ownership?.label).filter(Boolean))];
  const occurrences = `<ul class="finding-occurrences">
    ${displayGroups.map((group) => renderFindingOccurrenceGroup(group, sortedIssues.length, annotationNumberByIssueKey)).join("\n")}
  </ul>`;

  return `<li class="issue">
    <div class="triage-title">
      <div class="triage-title-main">
        <code>${escapeHtml(ruleId)}</code>
        ${sortedIssues.length > 1 ? `<span class="badge">${sortedIssues.length} occurrences</span>` : ""}
      </div>
      ${renderCopyIssueAction(ruleId, sortedIssues)}
    </div>
    <div class="badges">
      ${summary.critical ? badge("critical", `${summary.critical} critical`) : ""}
      ${summary.warning ? badge("warning", `${summary.warning} warning`) : ""}
      ${summary.info ? badge("info", `${summary.info} info`) : ""}
      ${findingTypes.map(findingTypeBadge).join("")}
      ${levels.map((level) => `<span class="badge">WCAG Level ${escapeHtml(level)}</span>`).join("")}
    ${colorSchemes.map((scheme) => `<span class="badge">${escapeHtml(scheme)} color scheme</span>`).join("")}
      ${ownershipLabels.map((label) => `<span class="badge">${escapeHtml(label || "")}</span>`).join("")}
    </div>
    ${renderWcagCriteria(criteria)}
    ${sortedIssues.some((issue) => issue.findingType === "needs-review") ? renderNeedsReviewNote(sortedIssues) : ""}
    ${sortedIssues.length > 1
      ? `<details open><summary>Affected findings (${sortedIssues.length})</summary>${occurrences}</details>`
      : occurrences}
    ${sortedIssues.length > 1 ? renderGroupedContrastGuidance(sortedIssues, annotationNumberByIssueKey) : ""}
    ${renderRemediation(sortedIssues[0])}
  </li>`;
}

function groupStateIssuesForDisplay(issues: DedupedIssue[]): Array<{ key: string; representative: DedupedIssue; issues: DedupedIssue[] }> {
  const groups = new Map<string, { key: string; representative: DedupedIssue; issues: DedupedIssue[] }>();

  for (const issue of issues) {
    const key = stateIssueDisplayKey(issue);
    const existing = groups.get(key);
    if (existing) {
      existing.issues.push(issue);
    } else {
      groups.set(key, { key, representative: issue, issues: [issue] });
    }
  }

  return [...groups.values()];
}

function stateIssueDisplayKey(issue: DedupedIssue): string {
  return JSON.stringify({
    severity: issue.severity,
    findingType: issue.findingType,
    message: normalizeIssueMessageForDisplay(issue.message),
    colorScheme: issue.colorScheme || "",
    wcag: (issue.wcagCriteria || []).map((criterion) => `${criterion.id}:${criterion.level}`).sort(),
    ownership: issue.ownership
      ? `${issue.ownership.kind}:${issue.ownership.source || ""}:${issue.ownership.label}`
      : ""
  });
}

function renderFindingOccurrenceGroup(
  group: { representative: DedupedIssue; issues: DedupedIssue[] },
  totalRuleIssues: number,
  annotationNumberByIssueKey: Record<string, number> = {}
): string {
  const issue = group.representative;
  const grouped = group.issues.length > 1;
  return `<li class="finding-occurrence">
      ${totalRuleIssues > 1 ? `<div>${severityBadge(issue.severity)} ${findingTypeBadge(issue.findingType)}${grouped ? ` <span class="badge">${group.issues.length} locations</span>` : ""}</div>` : ""}
      ${totalRuleIssues > 1 && issue.colorScheme ? `<div class="badges"><span class="badge">${escapeHtml(issue.colorScheme)} color scheme</span></div>` : ""}
      <div>${escapeHtml(normalizeIssueMessageForDisplay(issue.message))}</div>
      ${grouped ? renderFindingTargets(group.issues, annotationNumberByIssueKey) : renderFindingTarget(group.issues[0], annotationNumberByIssueKey)}
      ${renderOwnership(issue)}
      ${renderHumanVerificationContext(issue)}
      ${totalRuleIssues > 1 ? "" : renderContrastEvidence(issue, annotationNumberByIssueKey)}
    </li>`;
}

function renderFindingTargets(
  issues: DedupedIssue[],
  annotationNumberByIssueKey: Record<string, number> = {}
): string {
  const markedCount = issues.filter((issue) => annotationNumberByIssueKey[annotationIssueKey(issue)]).length;
  const markerNote = markedCount > 0 && markedCount < issues.length
    ? `<li class="finding-target-note">${markedCount} of ${issues.length} shown on screenshots</li>`
    : "";
  return `<ol class="finding-targets">
    ${issues.map((issue) => `<li>${renderFindingTarget(issue, annotationNumberByIssueKey)}</li>`).join("\n")}
    ${markerNote}
  </ol>`;
}

function renderNeedsReviewNote(issues: DedupedIssue[]): string {
  const incomplete = issues.some((issue) => issue.tags?.includes("axe-incomplete"));
  const text = incomplete
    ? "Needs review means axe could not complete this check automatically. Treat it as evidence to verify, not as a confirmed WCAG failure."
    : "Needs review means this item requires human confirmation before treating it as a confirmed accessibility defect.";
  return `<aside class="finding-review-note">${escapeHtml(text)}</aside>`;
}

function renderFindingTarget(
  issue: DedupedIssue,
  annotationNumberByIssueKey: Record<string, number> = {}
): string {
  const target = issue.selector || issue.file;
  const label = extractIssueLabel(issue.message);
  const contrast = issue.contrast
    ? ` · Contrast ${issue.contrast.actualRatio}:1, required ${issue.contrast.requiredRatio}:1`
    : "";
  const labelText = label ? ` · Label: "${label}"` : "";
  const markerNumber = annotationNumberByIssueKey[annotationIssueKey(issue)];
  const marker = markerNumber
    ? `<span class="finding-marker finding-marker-${issue.severity}" title="Screenshot marker ${markerNumber}">${markerNumber}</span>`
    : "";
  const text = target
    ? `${target}${labelText}${contrast}`
    : `Target not available${labelText}${contrast}`;
  return `<div class="finding-target">${marker}<div class="url">${escapeHtml(text)}</div></div>`;
}

function normalizeIssueMessageForDisplay(message: string): string {
  return message.replace(/\s+Label:\s*"[^"]*"\.?$/u, ".").replace(/\.\.$/u, ".");
}

function extractIssueLabel(message: string): string | undefined {
  return message.match(/\s+Label:\s*"([^"]*)"\.?$/u)?.[1];
}

function uniqueWcagCriteria(issues: DedupedIssue[]): DedupedIssue["wcagCriteria"] {
  const criteria = new Map<string, DedupedIssue["wcagCriteria"][number]>();
  for (const issue of issues) {
    for (const criterion of issue.wcagCriteria || []) {
      if (!criteria.has(criterion.id)) criteria.set(criterion.id, criterion);
    }
  }
  return [...criteria.values()].sort(compareWcagCriteriaForTriage);
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

function renderOwnership(issue: DedupedIssue): string {
  if (!issue.ownership) return "";
  const sourceUrl = issue.ownership.url ? safeExternalUrl(issue.ownership.url) : undefined;
  const source = issue.ownership.source
    ? sourceUrl
      ? `<span>Source: <a href="${escapeAttribute(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(issue.ownership.source)}</a></span>`
      : `<span>Source: ${escapeHtml(issue.ownership.source)}</span>`
    : "";
  const note = issue.ownership.note ? `<span>${escapeHtml(issue.ownership.note)}</span>` : "";
  const className = issue.ownership.kind === "third-party-embed"
    ? "finding-context finding-context-third-party"
    : "finding-context";
  return `<aside class="${className}" aria-label="Finding ownership">
    <strong>Ownership: ${escapeHtml(issue.ownership.label)}</strong>
    ${source}
    ${note}
  </aside>`;
}

function renderHumanVerificationContext(issue: DedupedIssue): string {
  if (issue.ruleId !== "adapter/human-verification") return "";
  return `<aside class="finding-context finding-context-blocked" aria-label="Human verification blocker">
    <strong>Scan blocked by human verification</strong>
    <span>The page appears to be replaced by CAPTCHA, bot protection, or a verify-you-are-human challenge, so automated accessibility results for this URL are incomplete.</span>
    <span>Use a staging, preview, or allowlisted URL for automation, or record manual accessibility evidence for this flow.</span>
  </aside>`;
}

function renderCopyIssueAction(ruleId: string, issues: DedupedIssue[]): string {
  const markdown = buildIssueMarkdown(ruleId, issues);
  return `<div class="issue-actions">
    <button class="copy-issue copy-issue-ticket" type="button" title="Copy a GitHub/Jira-ready Markdown summary" data-copy-issue="${escapeAttribute(encodeURIComponent(markdown))}"><span>Copy for</span><span>ticket</span></button>
    <span class="copy-issue-status" data-copy-issue-status aria-live="polite"></span>
  </div>`;
}

function collectTicketDraftGroups(issues: DedupedIssue[]): Array<{ key: string; ruleId: string; issues: DedupedIssue[] }> {
  const groups = new Map<string, { key: string; ruleId: string; issues: DedupedIssue[] }>();

  for (const issue of issues) {
    const key = ticketDraftTypeKey(issue);
    const existing = groups.get(key);
    if (existing) {
      existing.issues.push(issue);
    } else {
      groups.set(key, { key, ruleId: issue.ruleId, issues: [issue] });
    }
  }

  return [...groups.values()].sort((left, right) => compareIssueGroupEntries(
    [left.ruleId, left.issues],
    [right.ruleId, right.issues]
  ));
}

function ticketDraftTypeKey(issue: DedupedIssue): string {
  return JSON.stringify({
    ruleId: issue.ruleId,
    findingType: issue.findingType,
    message: normalizeIssueMessageForDisplay(issue.message),
    wcag: (issue.wcagCriteria || []).map((criterion) => `${criterion.id}:${criterion.level}`).sort(),
    ownership: issue.ownership?.kind || ""
  });
}

function buildAllTicketDraftsMarkdown(groups: Array<{ ruleId: string; issues: DedupedIssue[] }>): string {
  const lines = [
    "# Accessibility Ticket Drafts",
    "",
    `Generated by a11y-shiftleft-cli for ${groups.length} finding group${groups.length === 1 ? "" : "s"}.`,
    "",
    "Paste each section into GitHub Issues, Jira, Linear, or your team tracker.",
    ""
  ];

  for (const [index, group] of groups.entries()) {
    lines.push(
      "---",
      "",
      `<!-- Ticket draft ${index + 1} of ${groups.length} -->`,
      "",
      buildIssueMarkdown(group.ruleId, group.issues),
      ""
    );
  }

  return lines.join("\n").trim();
}

function buildIssueMarkdown(ruleId: string, issues: DedupedIssue[]): string {
  const primary = issues[0];
  const summary = summarizeIssues(issues);
  const criteria = uniqueWcagCriteria(issues);
  const remediation = primary.remediation || getRemediationHint(
    primary.ruleId,
    primary.wcagCriteria,
    primary.framework,
    { helpUrl: primary.helpUrl }
  );
  const allTargets = [...new Set(issues.map(formatIssueTargetForMarkdown))];
  const visibleTargets = allTargets.slice(0, 10);
  const hiddenTargetCount = Math.max(0, allTargets.length - visibleTargets.length);
  const wcag = criteria.length > 0
    ? criteria.map((criterion) => `- WCAG ${criterion.id} ${criterion.title} (${criterion.level}): ${criterion.url}`)
    : ["- No WCAG mapping available."];
  const ownership: string[] = primary.ownership
    ? ([
      "",
      "### Ownership",
      "",
      `- ${primary.ownership.label}`,
      primary.ownership.source ? `- Source: ${primary.ownership.source}` : undefined,
      primary.ownership.note ? `- Note: ${primary.ownership.note}` : undefined
    ].filter((line): line is string => line !== undefined))
    : [];

  const lines: Array<string | undefined> = [
    `## ${ruleId}`,
    "",
    normalizeIssueMessageForDisplay(primary.message),
    "",
    "### Evidence",
    "",
    `- Severity: ${primary.severity}`,
    `- Source: ${primary.source}`,
    `- Finding type: ${primary.findingType}`,
    `- Page: ${primary.url || "unknown"}`,
    primary.stateId ? `- State: ${primary.stateId}${primary.stateLabel ? ` (${primary.stateLabel})` : ""}` : "",
    `- Findings in group: ${issues.length}`,
    `- Severity mix: critical ${summary.critical}, warning ${summary.warning}, info ${summary.info}`,
    "",
    "### Targets",
    "",
    ...visibleTargets.map((target) => `- ${target}`),
    hiddenTargetCount ? `- ...and ${hiddenTargetCount} more target${hiddenTargetCount === 1 ? "" : "s"}` : undefined,
    "",
    "### WCAG",
    "",
    ...wcag,
    ...ownership,
    "",
    "### Suggested fix",
    "",
    remediation.summary,
    "",
    ...remediation.howToFix.map((step) => `- ${step}`),
    "",
    ...remediation.docs.slice(0, 3).map((url) => `- ${url}`)
  ];

  return lines.filter((line): line is string => line !== undefined).join("\n");
}

function formatIssueTargetForMarkdown(issue: DedupedIssue): string {
  const target = issue.selector || issue.file || "unknown target";
  const context = [
    issue.url ? `page: ${issue.url}` : undefined,
    issue.stateId ? `state: ${issue.stateId}${issue.stateLabel ? ` (${issue.stateLabel})` : ""}` : undefined
  ].filter((value): value is string => Boolean(value));
  const label = extractIssueLabel(issue.message);
  const labelText = label ? `; label: "${label}"` : "";
  const contextText = context.length > 0 ? ` (${context.join("; ")}${labelText})` : labelText ? ` (${labelText.slice(2)})` : "";
  return `\`${target}\`${contextText}`;
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

function renderContrastEvidence(
  issue: DedupedIssue,
  annotationNumberByIssueKey: Record<string, number> = {}
): string {
  const contrast = issue.contrast;
  if (!contrast) return "";

  return renderContrastGuidance(contrast, renderContrastGuidanceMarkers([issue], annotationNumberByIssueKey));
}

function renderContrastMeasurement(contrast: NonNullable<DedupedIssue["contrast"]>): string {
  return `<div class="contrast-measurement">
    <div><strong>Contrast ${contrast.actualRatio}:1</strong> · needs ${contrast.requiredRatio}:1</div>
    <div class="contrast-colors">
      <span class="contrast-color">${renderColorSwatch(contrast.foreground)} Text <code>${escapeHtml(contrast.foreground)}</code></span>
      <span class="contrast-color">${renderColorSwatch(contrast.background)} Background <code>${escapeHtml(contrast.background)}</code></span>
    </div>
  </div>`;
}

function renderGroupedContrastGuidance(
  issues: DedupedIssue[],
  annotationNumberByIssueKey: Record<string, number> = {}
): string {
  const groups = new Map<string, { contrast: NonNullable<DedupedIssue["contrast"]>; issues: DedupedIssue[] }>();

  for (const issue of issues) {
    if (!issue.contrast) continue;
    const key = JSON.stringify({
      foreground: issue.contrast.foreground,
      background: issue.contrast.background,
      requiredRatio: issue.contrast.requiredRatio,
      suggestions: issue.contrast.suggestions
    });
    const existing = groups.get(key);
    if (existing) existing.issues.push(issue);
    else groups.set(key, { contrast: issue.contrast, issues: [issue] });
  }

  if (groups.size === 0) return "";
  return [...groups.values()].map(({ contrast, issues: groupedIssues }) => (
    `<div class="contrast-guidance-group">
      ${groupedIssues.length > 1 ? `<div class="url">Shared recommendation for ${groupedIssues.length} findings</div>` : ""}
      ${renderContrastGuidance(contrast, renderContrastGuidanceMarkers(groupedIssues, annotationNumberByIssueKey))}
    </div>`
  )).join("\n");
}

function renderContrastGuidanceMarkers(
  issues: DedupedIssue[],
  annotationNumberByIssueKey: Record<string, number>
): string {
  const markers = issues
    .map((issue) => ({
      number: annotationNumberByIssueKey[annotationIssueKey(issue)],
      severity: issue.severity
    }))
    .filter((marker): marker is { number: number; severity: Severity } => Boolean(marker.number))
    .sort((left, right) => left.number - right.number);
  const uniqueMarkers = new Map<number, Severity>();
  for (const marker of markers) {
    const current = uniqueMarkers.get(marker.number);
    if (!current || severityValue(marker.severity) > severityValue(current)) {
      uniqueMarkers.set(marker.number, marker.severity);
    }
  }
  if (uniqueMarkers.size === 0) return "";
  return `<span class="contrast-guidance-markers" aria-label="Screenshot markers">
    ${[...uniqueMarkers.entries()].map(([number, severity]) => `<span class="finding-marker finding-marker-${severity}" title="Screenshot marker ${number}">${number}</span>`).join("")}
  </span>`;
}

function renderContrastGuidance(
  contrast: NonNullable<DedupedIssue["contrast"]>,
  markers = ""
): string {
  const compactSuggestions = selectContrastSuggestions(contrast.suggestions);
  const suggestions = contrast.suggestions.length > 0
    ? `<div class="contrast-suggestions contrast-try">
      ${compactSuggestions.map((suggestion) => `<span class="contrast-color">
        ${renderColorSwatch(suggestion.color)}
        ${formatContrastSuggestionTarget(suggestion.target)} ${formatContrastSuggestionPurpose(suggestion.purpose)} <code>${escapeHtml(suggestion.color)}</code> (${suggestion.contrastRatio}:1)
      </span>`).join("\n")}
    </div>`
    : `<div class="muted">No reliable single-color suggestion is available. Review this contrast manually.</div>`;

  return `<div class="contrast-evidence contrast-guidance">
    <div class="contrast-guidance-title"><span>Color recommendations</span>${markers}</div>
    <div class="contrast-guidance-body">
      ${renderContrastMeasurement(contrast)}
      ${suggestions}
    </div>
  </div>`;
}

function selectContrastSuggestions(
  suggestions: NonNullable<DedupedIssue["contrast"]>["suggestions"]
): NonNullable<DedupedIssue["contrast"]>["suggestions"] {
  const preferred = suggestions.filter((suggestion) => suggestion.purpose !== "enhanced");
  const pool = preferred.length > 0 ? preferred : suggestions;
  const minimumByTarget = [
    pool.find((suggestion) => suggestion.target === "foreground" && suggestion.purpose === "minimum"),
    pool.find((suggestion) => suggestion.target === "background" && suggestion.purpose === "minimum")
  ].filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion));

  if (minimumByTarget.length >= 2) return minimumByTarget;

  return pool.slice(0, 2);
}

function formatContrastSuggestionTarget(
  target: NonNullable<DedupedIssue["contrast"]>["suggestions"][number]["target"]
): string {
  return target === "background" ? "Background color" : "Text color";
}

function formatContrastSuggestionPurpose(
  purpose: NonNullable<DedupedIssue["contrast"]>["suggestions"][number]["purpose"]
): string {
  if (purpose === "minimum") return "Minimum";
  if (purpose === "recommended") return "Recommended";
  return "AAA";
}

function renderColorSwatch(color: string): string {
  if (!/^#[0-9a-f]{3,8}$/i.test(color)) return "";
  return `<span class="color-swatch" style="background-color: ${escapeAttribute(color)}" aria-hidden="true"></span>`;
}

type MetricTone = Severity | "wcag" | "needs-review" | "best-practice";

function metric(label: string, value: number | string, tone?: MetricTone): string {
  const numericValue = typeof value === "number" ? value : Number(value);
  const isZero = tone && Number.isFinite(numericValue) && numericValue === 0;
  const className = [
    "metric",
    tone ? `metric-${tone}` : "",
    isZero ? "metric-zero" : ""
  ].filter(Boolean).join(" ");

  return `<div class="${className}">
    <strong>${escapeHtml(String(value))}</strong>
    <span>${escapeHtml(label)}</span>
  </div>`;
}

function formatDepthMetric(maxDepth: number): string {
  return maxDepth === 1 ? "1 level" : `${maxDepth} levels`;
}

function formatDepthScope(maxDepth: number): string {
  if (maxDepth === 0) return "start page only (depth 0)";
  const levelLabel = maxDepth === 1 ? "1 interaction level" : `${maxDepth} interaction levels`;
  return `${levelLabel} from the start page`;
}

function formatHiddenElements(selectors: string[] | undefined): string {
  return selectors && selectors.length > 0 ? selectors.join(", ") : "None";
}

function severityBadge(severity: Severity): string {
  return badge(severity, severity);
}

function badge(kind: Severity | "ok", label: string): string {
  return `<span class="badge badge-${kind}">${escapeHtml(label)}</span>`;
}

function findingTypeBadge(type: DedupedIssue["findingType"]): string {
  if (type === "wcag") return `<span class="badge">WCAG violation</span>`;
  if (type === "needs-review") return `<span class="badge">needs review</span>`;
  if (type === "best-practice") return `<span class="badge">best practice</span>`;
  return `<span class="badge">unmapped review</span>`;
}

function countFindingTypes(issues: DedupedIssue[]): Record<DedupedIssue["findingType"], number> {
  return issues.reduce<Record<DedupedIssue["findingType"], number>>((counts, issue) => {
    counts[issue.findingType] += 1;
    return counts;
  }, {
    wcag: 0,
    "needs-review": 0,
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

function groupIssuesByStateId(issues: DedupedIssue[]): Map<string, DedupedIssue[]> {
  const issuesByStateId = new Map<string, DedupedIssue[]>();
  for (const issue of issues) {
    if (!issue.stateId) continue;
    const current = issuesByStateId.get(issue.stateId) || [];
    current.push(issue);
    issuesByStateId.set(issue.stateId, current);
  }
  return issuesByStateId;
}

function filterRepeatedStateIssues(
  states: ExplorationState[],
  issuesByStateId: Map<string, DedupedIssue[]>
): Map<string, DedupedIssue[]> {
  const displayIssuesByStateId = new Map<string, DedupedIssue[]>();
  const firstSeenKeys = new Set<string>();
  const orderedStates = [...states].sort((left, right) =>
    left.depth - right.depth || stateNumericId(left.id) - stateNumericId(right.id) || left.id.localeCompare(right.id)
  );

  for (const state of orderedStates) {
    const stateIssues = issuesByStateId.get(state.id) || [];
    const displayIssues: DedupedIssue[] = [];
    for (const issue of stateIssues) {
      if (!shouldDisplayIssueInState(state, issue)) continue;
      const key = repeatedStateIssueKey(issue);
      if (!key || !firstSeenKeys.has(key)) {
        displayIssues.push(issue);
      }
      if (key) firstSeenKeys.add(key);
    }
    displayIssuesByStateId.set(state.id, displayIssues);
  }

  return displayIssuesByStateId;
}

function shouldDisplayIssueInState(state: ExplorationState, issue: DedupedIssue): boolean {
  if (!state.modalFocus || state.depth === 0) return true;
  return isModalSpecificIssue(issue)
    || isIssueInsideDialogBounds(issue, state.modalFocus.dialogBounds);
}

function isModalSpecificIssue(issue: DedupedIssue): boolean {
  const haystack = [
    issue.source,
    issue.ruleId,
    issue.selector
  ].filter(Boolean).join(" ").toLowerCase();

  return /\bmodal\b|\bdialog\b|aria-modal|alertdialog|role=["']?dialog|role=["']?alertdialog/.test(haystack);
}

function isIssueInsideDialogBounds(issue: DedupedIssue, dialogBounds?: ElementBounds): boolean {
  if (!dialogBounds || !issue.elementBounds) return false;
  const issueBounds = normalizeBoundsToDocumentSpace(issue.elementBounds);
  const modalBounds = normalizeBoundsToDocumentSpace(dialogBounds);
  if (!issueBounds || !modalBounds) return false;
  const issueCenterX = issueBounds.x + issueBounds.width / 2;
  const issueCenterY = issueBounds.y + issueBounds.height / 2;

  return issueCenterX >= modalBounds.x
    && issueCenterX <= modalBounds.x + modalBounds.width
    && issueCenterY >= modalBounds.y
    && issueCenterY <= modalBounds.y + modalBounds.height;
}

function normalizeBoundsToDocumentSpace(bounds: ElementBounds): ElementBounds | undefined {
  if (!Number.isFinite(bounds.x)
    || !Number.isFinite(bounds.y)
    || !Number.isFinite(bounds.width)
    || !Number.isFinite(bounds.height)) {
    return undefined;
  }
  return bounds;
}

function repeatedStateIssueKey(issue: DedupedIssue): string | undefined {
  const target = issue.selector || issue.file;
  if (!target || !issue.url) return undefined;
  return [
    issue.source,
    issue.ruleId,
    issue.url,
    target,
    issue.message,
    issue.colorScheme || ""
  ].join("::");
}

function stateNumericId(id: string): number {
  const match = id.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function buildAnnotationSeverityByKey(issues: DedupedIssue[]): Record<string, Severity> {
  return issues.reduce<Record<string, Severity>>((severityByKey, issue) => {
    const key = annotationSeverityKey(issue);
    const current = severityByKey[key];
    if (!current || severityValue(issue.severity) > severityValue(current)) {
      severityByKey[key] = issue.severity;
    }
    return severityByKey;
  }, {});
}

function buildAnnotationNumberByIssueKey(
  state: ExplorationState,
  issues: DedupedIssue[]
): Record<string, number> {
  const numberByIssueKey: Record<string, number> = {};
  let nextNumber = 1;
  const screenshotPaths = state.screenshot
    ? state.screenshotEvidence?.length
      ? state.screenshotEvidence.map((evidence) => evidence.path)
      : [state.screenshot]
    : [];

  for (const screenshot of screenshotPaths) {
    const matchingIssues = issues.filter((issue) => issue.screenshot === screenshot);
    const hasSpecificEvidence = Boolean(state.screenshotEvidence?.length);
    const sortedIssues = (matchingIssues.length > 0 || hasSpecificEvidence
      ? matchingIssues
      : issues)
      .filter((issue) => issue.elementBounds)
      .sort(compareIssuesForAnnotationOrder);
    const visibleIssues = sortedIssues
      .filter((issue, index) =>
        sortedIssues.findIndex((candidate) => annotationVisualKey(candidate) === annotationVisualKey(issue)) === index
      )
      .slice(0, 12);
    const visibleVisualKeys = new Set(visibleIssues.map((issue) => annotationVisualKey(issue)));
    const numberByVisualKey = new Map<string, number>();

    for (const issue of sortedIssues) {
      const key = annotationIssueKey(issue);
      if (numberByIssueKey[key]) continue;
      const visualKey = annotationVisualKey(issue);
      const existingNumber = numberByVisualKey.get(visualKey);
      if (existingNumber) {
        numberByIssueKey[key] = existingNumber;
        continue;
      }
      if (!visibleVisualKeys.has(visualKey)) continue;
      numberByVisualKey.set(visualKey, nextNumber);
      numberByIssueKey[key] = nextNumber;
      nextNumber += 1;
    }
  }

  return numberByIssueKey;
}

function compareIssuesForAnnotationOrder(a: DedupedIssue, b: DedupedIssue): number {
  const aBounds = a.elementBounds;
  const bBounds = b.elementBounds;
  if (!aBounds || !bBounds) return 0;

  const sameVisualRow = Math.abs(aBounds.y - bBounds.y) <= 3;

  return sameVisualRow
    ? aBounds.x - bBounds.x
      || aBounds.y - bBounds.y
      || severityValue(b.severity) - severityValue(a.severity)
      || a.ruleId.localeCompare(b.ruleId)
      || (a.selector || "").localeCompare(b.selector || "")
      || a.fingerprint.localeCompare(b.fingerprint)
    : aBounds.y - bBounds.y
    || aBounds.x - bBounds.x
    || severityValue(b.severity) - severityValue(a.severity)
    || a.ruleId.localeCompare(b.ruleId)
    || (a.selector || "").localeCompare(b.selector || "")
    || a.fingerprint.localeCompare(b.fingerprint);
}

function annotationIssueKey(issue: DedupedIssue): string {
  return issue.fingerprint || [
    issue.ruleId,
    issue.selector || issue.file || "unknown",
    issue.message,
    issue.screenshot || ""
  ].join("::");
}

function annotationSeverityKey(issue: DedupedIssue): string {
  return `${issue.selector || issue.file || "unknown"}`;
}

function annotationVisualKey(issue: DedupedIssue): string {
  const bounds = issue.elementBounds;
  if (!bounds) {
    return `${issue.screenshot || ""}::${issue.selector || issue.file || "unknown"}`;
  }
  return [
    issue.screenshot || "",
    bounds.coordinateSpace || "viewport",
    roundAnnotationCoordinate(bounds.x),
    roundAnnotationCoordinate(bounds.y),
    roundAnnotationCoordinate(bounds.width),
    roundAnnotationCoordinate(bounds.height)
  ].join("::");
}

function roundAnnotationCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}

function inferStateIdFromScreenshot(screenshot: string): string | undefined {
  return screenshot.match(/(?:^|\/)(state-\d+)(?:-|\.|_)/)?.[1];
}

function severityValue(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function wcagLevelRank(level?: string): number {
  if (level === "A") return 1;
  if (level === "AA") return 2;
  if (level === "AAA") return 3;
  return 99;
}

function issuePrimaryWcagLevelRank(issue: DedupedIssue): number {
  const ranks = (issue.wcagCriteria || []).map((criterion) => wcagLevelRank(criterion.level));
  return ranks.length > 0 ? Math.min(...ranks) : 99;
}

function compareIssuesForTriage(left: DedupedIssue, right: DedupedIssue): number {
  const severityDifference = severityValue(right.severity) - severityValue(left.severity);
  if (severityDifference) return severityDifference;
  const impactDifference = issueUserImpactValue(right) - issueUserImpactValue(left);
  if (impactDifference) return impactDifference;
  const ownershipDifference = issueOwnershipValue(right) - issueOwnershipValue(left);
  if (ownershipDifference) return ownershipDifference;
  const levelDifference = issuePrimaryWcagLevelRank(left) - issuePrimaryWcagLevelRank(right);
  if (levelDifference) return levelDifference;
  const confidenceDifference = issueConfidenceValue(right) - issueConfidenceValue(left);
  if (confidenceDifference) return confidenceDifference;
  const duplicateDifference = (right.duplicateCount || 0) - (left.duplicateCount || 0);
  if (duplicateDifference) return duplicateDifference;
  return left.ruleId.localeCompare(right.ruleId)
    || (left.selector || left.file || "").localeCompare(right.selector || right.file || "")
    || left.message.localeCompare(right.message);
}

function compareIssueGroupEntries(
  left: [string, DedupedIssue[]],
  right: [string, DedupedIssue[]]
): number {
  const leftIssues = left[1];
  const rightIssues = right[1];
  const leftHighestSeverity = Math.max(...leftIssues.map((issue) => severityValue(issue.severity)));
  const rightHighestSeverity = Math.max(...rightIssues.map((issue) => severityValue(issue.severity)));
  const severityDifference = rightHighestSeverity - leftHighestSeverity;
  if (severityDifference) return severityDifference;

  const impactDifference = maxIssueValue(rightIssues, issueUserImpactValue) - maxIssueValue(leftIssues, issueUserImpactValue);
  if (impactDifference) return impactDifference;

  const ownershipDifference = maxIssueValue(rightIssues, issueOwnershipValue) - maxIssueValue(leftIssues, issueOwnershipValue);
  if (ownershipDifference) return ownershipDifference;

  const leftLevelRank = Math.min(...leftIssues.map(issuePrimaryWcagLevelRank));
  const rightLevelRank = Math.min(...rightIssues.map(issuePrimaryWcagLevelRank));
  const levelDifference = leftLevelRank - rightLevelRank;
  if (levelDifference) return levelDifference;

  const confidenceDifference = maxIssueValue(rightIssues, issueConfidenceValue) - maxIssueValue(leftIssues, issueConfidenceValue);
  if (confidenceDifference) return confidenceDifference;

  const scoreDifference = sumSeverityScore(rightIssues) - sumSeverityScore(leftIssues);
  return scoreDifference || rightIssues.length - leftIssues.length || left[0].localeCompare(right[0]);
}

function maxIssueValue(issues: DedupedIssue[], valueOf: (issue: DedupedIssue) => number): number {
  return Math.max(...issues.map(valueOf));
}

function compareWcagCriteriaForTriage(
  left: DedupedIssue["wcagCriteria"][number],
  right: DedupedIssue["wcagCriteria"][number]
): number {
  return wcagLevelRank(left.level) - wcagLevelRank(right.level)
    || left.id.localeCompare(right.id);
}

function summarizeRules(issues: DedupedIssue[]): Array<{
  ruleId: string;
  findingType: DedupedIssue["findingType"];
  highestSeverity: Severity;
  wcagLevelRank: number;
  critical: number;
  warning: number;
  info: number;
  occurrenceCount: number;
  severityScore: number;
  pages: string[];
  targets: string[];
  states: string[];
  criteria: string[];
}> {
  const summaries = new Map<string, {
    ruleId: string;
    findingType: DedupedIssue["findingType"];
    highestSeverity: Severity;
    wcagLevelRank: number;
    critical: number;
    warning: number;
    info: number;
    occurrenceCount: number;
    severityScore: number;
    pages: Set<string>;
    targets: Set<string>;
    states: Set<string>;
    criteria: Set<string>;
  }>();

  for (const issue of issues) {
    const summary = summaries.get(issue.ruleId) || {
      ruleId: issue.ruleId,
      findingType: issue.findingType,
      highestSeverity: issue.severity,
      wcagLevelRank: issuePrimaryWcagLevelRank(issue),
      critical: 0,
      warning: 0,
      info: 0,
      occurrenceCount: 0,
      severityScore: 0,
      pages: new Set<string>(),
      targets: new Set<string>(),
      states: new Set<string>(),
      criteria: new Set<string>()
    };

    summary[issue.severity] += 1;
    summary.occurrenceCount += 1 + Math.max(0, issue.duplicateCount || 0);
    summary.severityScore += severityScore(issue.severity);
    if (severityValue(issue.severity) > severityValue(summary.highestSeverity)) {
      summary.highestSeverity = issue.severity;
    }
    summary.wcagLevelRank = Math.min(summary.wcagLevelRank, issuePrimaryWcagLevelRank(issue));
    if (issue.url) summary.pages.add(issue.url);
    addIssueTarget(summary.targets, issue);
    if (issue.stateId) summary.states.add(issue.stateId);
    for (const criterion of issue.wcagCriteria || []) {
      summary.criteria.add(`WCAG ${criterion.id} ${criterion.title}, Level ${criterion.level}`);
    }
    summaries.set(issue.ruleId, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      pages: [...summary.pages].sort(),
      targets: [...summary.targets].sort(),
      states: [...summary.states].sort(),
      criteria: [...summary.criteria].sort()
    }))
    .sort((a, b) => {
      const severityDifference = severityValue(b.highestSeverity) - severityValue(a.highestSeverity);
      if (severityDifference) return severityDifference;
      if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
      const levelDifference = a.wcagLevelRank - b.wcagLevelRank;
      if (levelDifference) return levelDifference;
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

function issueUserImpactValue(issue: DedupedIssue): number {
  if (issue.userImpact?.level === "blocker") return 4;
  if (issue.userImpact?.level === "significant") return 3;
  if (issue.userImpact?.level === "workaround") return 2;
  if (issue.userImpact?.level === "minor") return 1;
  return 0;
}

function issueOwnershipValue(issue: DedupedIssue): number {
  if (issue.ownership?.kind === "first-party") return 2;
  if (issue.ownership?.kind === "third-party-embed") return 0;
  return 1;
}

function issueConfidenceValue(issue: DedupedIssue): number {
  if (Number.isFinite(issue.confidenceScore)) return issue.confidenceScore || 0;
  if (issue.confidence === "high") return 95;
  if (issue.confidence === "medium") return 75;
  if (issue.confidence === "low") return 50;
  return 0;
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
