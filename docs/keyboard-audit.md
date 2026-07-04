# Keyboard Focus Audit

The recommended `audit --url $APP_URL --out reports` workflow embeds keyboard
evidence in the primary `a11y-report.html` and `a11y-report.json`. Use the
standalone command below for a keyboard-only run, keyboard-specific baselines,
or detailed traversal tuning.

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
- `a11y-comment.md` and `a11y-report.json`: findings and deterministic fix
  recommendations in the shared format used by CI and later integrations.

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

## Safe Activation Checks

Add `--activation` to exercise a bounded set of role-specific keys:

```bash
npx a11y-shiftleft keyboard \
  --url $APP_URL \
  --activation \
  --max-activations 6 \
  --out reports/keyboard
```

The initial activation runner covers `Enter` and `Space` for buttons and
stateful controls, horizontal arrows for tabs and radios, `ArrowDown` for
combobox/listbox patterns, and `Escape` when a dialog state is already open.
Each attempt reloads the initial URL inside a separate browser context so
cookies and web storage do not leak into another attempt.

The shared exploration safe-mode rejects links, submissions, file inputs,
advertising, destructive or transactional labels, account/payment/cookie
controls, media and permission controls, and configured blocked patterns.
After initial rendering, navigation and XHR/fetch requests are aborted. Skipped
targets remain visible in the activation evidence table with a reason.

`keyboard-activation-no-effect` is emitted only when a stateful role is
expected to change checked, selected, expanded, pressed, dialog, or focus state
but no observable change occurs. A normal button with no visible DOM change is
recorded as evidence without being treated as a failure.

## Safety And Limits

The default runner only presses `Tab` and `Shift+Tab`; `--activation` adds the
bounded isolated interactions described above. Reverse traversal runs
only after the forward path reaches every detected control and completes a
cycle, avoiding unsupported conclusions from partial scans. Activation mode
does not use pointer clicks, submit forms, accept cookies, upload files, request
camera or microphone access, or activate payment, delete, and logout actions.
It does not yet prove complete widget behavior, modal focus restoration, or
complete task flows.

Automated focus traversal supports WCAG review but does not certify keyboard
accessibility. Confirm logical order and representative tasks manually.
