# Keyboard Focus Audit

The `keyboard` command records bounded Tab and Shift+Tab paths through one rendered page and
sends detected problems through the same WCAG, severity, confidence,
deduplication, and remediation pipeline as other checks.

## Quick Start

Start the application, then run:

```bash
export APP_URL=http://localhost:5173
npx a11y-shiftleft keyboard --url $APP_URL --out reports/keyboard
```

For a page with many controls:

```bash
npx a11y-shiftleft keyboard \
  --url $APP_URL/settings \
  --max-tabs 80 \
  --out reports/keyboard
```

## Generated Files

- `keyboard-path.md`: readable focus order, role, accessible name, visibility,
  focus-indicator, obscuration evidence, and deduplicated semantic page states.
- `keyboard-report.json`: complete structured traversal data.
- `a11y-comment.md`, `a11y-report.json`, `a11y-metrics.csv`, and
  `a11y-findings.csv`: findings and deterministic fix recommendations in the
  shared report format used by CI, dashboards, and later integrations.

## Page State Evidence

Every forward and reverse focus step references a stable state ID. Repeated
states are listed once in `keyboard-path.md` with their URL, document title,
H1, scroll position, viewport dimensions, open-dialog count, and
expanded-control count. The state ID also reacts to common semantic UI changes
such as opened dialogs, expanded disclosures, selected tabs, and pressed
toggle buttons.

These are compact semantic snapshots, not screenshots. The keyboard command
does not store form values, page HTML, or visual captures in this mode.

## Current Checks

- Positive `tabindex` values that can override logical source order.
- Focus that does not advance when `Tab` is pressed.
- Focus that remains on the document body after repeated `Tab` presses.
- A repeated focus cycle before all detected controls are reached.
- Specific focusable controls skipped by a completed focus cycle. Reporting is
  capped at ten targets per page to keep the result actionable.
- A reverse Shift+Tab order that does not mirror a complete forward Tab cycle.
- Focused elements outside the visible viewport or hidden from rendering.
- Focused elements obscured at their center point by other content.
- Missing outline or box-shadow while `:focus-visible` is active. Treat this as
  a review signal because custom border, background, or animated treatments may
  still provide a valid indicator.

## CI Baseline And Retesting

Create or refresh the dedicated keyboard baseline:

```bash
npx a11y-shiftleft keyboard --url $APP_URL --update-baseline --out reports/keyboard
```

On later runs, `--baseline --fail-on warning` fails only when new warning or
critical keyboard findings appear. The default file is
`.a11y-keyboard-baseline.json`, separate from the baseline used by `check`.
Use `--retest <previous-report-or-directory>` for a one-time comparison instead
of a committed baseline.

Keyboard findings also pass through scoped `a11y-ignore.json` rules and receive
matching statuses from `a11y-remediation.json`. These policies annotate or
filter the shared finding report without removing raw focus-path evidence from
`keyboard-report.json`.

## Safety And Limits

The initial runner only presses `Tab` and `Shift+Tab`. Reverse traversal runs
only after the forward path reaches every detected control and completes a
cycle, avoiding unsupported conclusions from partial scans. It does not click,
submit forms, accept
cookies, upload files, use camera or microphone controls, or activate payment,
delete, and logout actions. It also does not yet validate Enter, Space, Escape,
arrow-key widget behavior, modal focus restoration, or complete task flows.

Automated focus traversal supports WCAG review but does not certify keyboard
accessibility. Confirm logical order and representative tasks manually.
