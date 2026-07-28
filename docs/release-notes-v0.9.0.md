# v0.9.0 Release Notes

`a11y-shiftleft-cli` v0.9.0 adds bounded responsive and cross-browser audit
profiles. The release keeps the default `audit` command focused, while giving
teams opt-in commands for comparing desktop, mobile, tablet, Chromium, Firefox,
and WebKit evidence with local Markdown and JSON summaries.

## Added

- Multi-device visual audits:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --devices desktop mobile tablet --out reports/devices
```

This creates separate visual reports for each responsive profile plus:

- `reports/devices/a11y-device-audit.md`
- `reports/devices/a11y-device-audit.json`

- Cross-browser visual audits:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --browsers chromium firefox webkit --out reports/browsers
```

This creates separate visual reports for each browser engine plus:

- `reports/browsers/a11y-browser-audit.md`
- `reports/browsers/a11y-browser-audit.json`

- Summary tables now include:
  - status per profile
  - total findings
  - critical, warning, and info counts
  - explored state counts
  - links to each generated visual report
- Hover/focus content inventory in visual, Markdown, and manual checklist
  outputs. The scanner now surfaces likely tooltip, popover, menu, disclosure,
  and described-by triggers for WCAG 1.4.13 review while keeping final behavior
  confirmation manual.
- Pointer-interaction inventory in visual, Markdown, and manual checklist
  outputs. The scanner now surfaces sliders, range inputs, carousels, maps,
  canvas regions, draggable controls, swipe regions, sortable controls, and
  inline pointer handlers for WCAG 2.5 review without performing unsafe
  gestures.
- Text-spacing override evidence in visual, Markdown, WCAG evidence, and manual
  checklist outputs. The scanner now temporarily applies WCAG text-spacing
  overrides and records overflow or clipped-text candidates for WCAG 1.4.12
  review.
- Sensory-instruction evidence in visual, Markdown, WCAG evidence, and manual
  checklist outputs. The scanner now surfaces visible instructions that appear
  to rely on color, position, shape, icon, or sound cues for manual WCAG 1.3.3,
  1.4.1, and 3.3.2 review.
- Focus/input context-change evidence in visual, Markdown, WCAG evidence, and
  manual checklist outputs. The scanner now inventories inline focus, blur,
  input, change, select, and autofocus triggers for WCAG 3.2.1 and 3.2.2
  review without executing risky navigation or submission behavior.
- Multiple Ways assisted review in visual and Markdown Audit Coverage. The
  checklist now asks reviewers to confirm that important pages can be found
  through at least two supported paths for WCAG 2.4.5.

## Changed

- README and configuration docs now explain when to use:
  - `--mobile`
  - `--tablet`
  - `--device`
  - `--devices`
  - `--browser`
  - `--browsers`
- Roadmap now treats responsive and cross-browser profile runs as implemented
  foundations, with richer comparison/diff summaries left as future work.

## Fixed

- Fixed `Checklist ready` links in the visual report Audit Coverage table. The
  report initialization script no longer replaces those links with plain text
  after the page loads.

## Why It Matters

- Teams can compare responsive accessibility evidence without manually rerunning
  the same command three times.
- Teams can collect bounded browser-specific evidence without changing the
  default fast audit workflow.
- Markdown and JSON summaries make the new profile runs usable in CI artifacts,
  local review, dashboards, and future trend reports.

## Try It

Responsive profile comparison:

```bash
npx a11y-shiftleft-cli audit \
  --url $APP_URL \
  --devices desktop mobile tablet \
  --out reports/devices
```

Browser-engine comparison:

```bash
npx a11y-shiftleft-cli audit \
  --url $APP_URL \
  --browsers chromium firefox webkit \
  --out reports/browsers
```

Install extra Playwright browsers before cross-browser runs:

```bash
npx playwright install firefox webkit
```

## Update

```bash
npm install --save-dev a11y-shiftleft-cli@0.9.0
```
