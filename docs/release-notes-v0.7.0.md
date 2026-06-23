# v0.7.0 Release Notes

`a11y-shiftleft-cli` v0.7.0 is a stable visual-audit release focused on the
unified `audit` workflow, safer exploration evidence, keyboard coverage, and a
cleaner HTML report.

## Added

- Unified `audit` command that creates one primary visual HTML report with
  dynamic exploration, static findings, screenshots, keyboard evidence, and a
  manual-review checklist.
- Audit coverage matrix showing automated evidence, manual-review gaps, and
  finding counts.
- Keyboard focus traversal evidence with visual Tab order, reverse traversal,
  focus visibility, focus loss, and activation checks.
- Rendered evidence for reflow at 400%, modal focus behavior, dynamic
  announcements, form error states, image alternatives, media/motion, iframes,
  canvas, and accessibility-tree signals.
- Retest, remediation tracking, evidence packaging, and ticket draft workflows
  for project teams.
- Tagged PDF export support for visual and dashboard reports.

## Improved

- Visual reports now use compact state cards, stable screenshot previews,
  full-page evidence scrolling, improved annotation alignment, and grouped fix
  guidance below each finding.
- `How to fix` and `Color recommendations` open as overlay panels so the report
  layout does not jump while reviewing fixes.
- Contrast findings show WCAG level, criterion links, measured ratios, color
  swatches, and suggested accessible text colors.
- Report tables and CSV exports are easier to use for team triage and
  spreadsheet analysis.
- Findings are filtered and classified more consistently across WCAG,
  best-practice, framework, keyboard, and layout sources.

## Fixed

- Restored complete WCAG metadata for supported axe-core A/AA rules.
- Reduced duplicate findings from equivalent static/dynamic evidence.
- Fixed full-page screenshot preview annotation drift.
- Prevented stale generated screenshot artifacts from surviving new report
  runs.

## Update

```bash
npm install --save-dev a11y-shiftleft-cli@0.7.0
```
