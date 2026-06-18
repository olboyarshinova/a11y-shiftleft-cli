# Keyboard Focus Audit

The `keyboard` command records a bounded Tab path through one rendered page and
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
  focus-indicator, and obscuration evidence.
- `keyboard-report.json`: complete structured traversal data.
- `a11y-comment.md`, `a11y-report.json`, and `a11y-metrics.csv`: findings in the
  shared report format used by CI, dashboards, and later integrations.

## Current Checks

- Positive `tabindex` values that can override logical source order.
- Focus that does not advance when `Tab` is pressed.
- A repeated focus cycle before all detected controls are reached.
- Focused elements outside the visible viewport or hidden from rendering.
- Focused elements obscured at their center point by other content.
- Missing outline or box-shadow while `:focus-visible` is active. Treat this as
  a review signal because custom border, background, or animated treatments may
  still provide a valid indicator.

## Safety And Limits

The initial runner only presses `Tab`. It does not click, submit forms, accept
cookies, upload files, use camera or microphone controls, or activate payment,
delete, and logout actions. It also does not yet validate Enter, Space, Escape,
arrow-key widget behavior, modal focus restoration, or complete task flows.

Automated focus traversal supports WCAG review but does not certify keyboard
accessibility. Confirm logical order and representative tasks manually.
