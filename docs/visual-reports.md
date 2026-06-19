# Visual Reports

Use `explore` when you want the CLI to walk safe parts of a running app and
produce a visual report:

```bash
npx a11y-shiftleft explore --url $APP_URL --depth 2 --out reports
```

`explore` opens the start URL, scans it with axe, then safely follows
same-origin links and low-risk UI expansion controls such as menu buttons,
tabs, disclosure widgets, and modal triggers.

For every discovered state, `explore` automatically compares light and dark
system color schemes. When the rendered appearance changes, both variants are
scanned and shown as separate labeled states. If they are visually equivalent,
the state is scanned once. No theme-specific command is required. Recognizable
theme toggle controls are prioritized during bounded action discovery as well.

It saves:

```txt
reports/a11y-report.json
reports/a11y-comment.md
reports/exploration.html
reports/exploration.pdf       # only when --pdf is used
reports/exploration-graph.json
reports/screenshots/state-*.jpg
reports/screenshots/state-*-error-*.jpg   # focused crops on long pages
```

`exploration.html` shows summary metrics, checked states, screenshots, top
findings, recorded transitions, skipped actions, and reviewable overlays around
affected elements when Playwright can resolve their bounds.

Findings are identified as WCAG violations, best-practice guidance, or unmapped
review items. The report also groups repeated occurrences into likely root
causes, such as one shared active-navigation style failing on several routes.
Root-cause grouping is heuristic and does not remove the evidence recorded for
each page or state.

Exploration compares titles across distinct page URLs and reports duplicated or
obvious starter-template titles. Multiple UI states and color schemes at the
same URL are treated as one page for this comparison.

Every finding in `exploration.html` includes an expanded `How to fix` section
with concrete steps, rule documentation, and a React, Vue, or Angular example
when one is available. Generic fallback guidance remains visible for unknown or
custom rules so no finding ends without a next action.

For `color-contrast` findings, the HTML report also shows the measured ratio,
required ratio, foreground and background swatches, font metadata, and options
for minimally changing the text color while preserving the current background.
Suggestions are calculated from WCAG relative luminance and should still be
checked against design tokens and hover, focus, disabled, and visited states.

## Waiting For Async UI

Some apps render the shell first and load cards, charts, or authenticated data
after a short delay. `explore` waits for network idle and a small settle delay by
default before taking screenshots and running axe.

`explore` also auto-scrolls each state before scanning. Auto-scroll helps load
below-the-fold content. Short affected pages can use one complete screenshot;
long pages are automatically split into focused crops around nearby findings.
Clean long states use compact viewport evidence.

Use `--wait-ms` when screenshots are captured before the UI finishes rendering:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --depth 2 \
  --wait-ms 1000 \
  --out reports
```

Use `--wait-for-selector` when the app has a stable "ready" element. This keeps
the scan more deterministic than adding a long fixed delay:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --wait-for-selector "[data-page-ready]" \
  --wait-ms 1000 \
  --out reports
```

Keep waits small for pull requests. A good starting point is `500-1000ms`; use a
larger wait only for scheduled full-site scans or pages with known slow data
loading.

## PDF Export

Use `--pdf` when you need a portable copy of the visual report for a pull
request, remediation ticket, or internal review:

```bash
npx a11y-shiftleft-cli explore --url $APP_URL --depth 2 --pdf --out reports
```

This writes:

```txt
reports/exploration.pdf
```

The PDF is generated from `exploration.html` with Playwright/Chromium. Export
enables tagged structure and a document outline, preserves the report language,
title, headings, image alternative text, and semantic table markup, and fails
when required structural metadata is missing. This makes the report more useful
with screen readers and keyboard navigation.

Tagged output is not the same as independent PDF/UA certification. Before a PDF
is used as a formal external deliverable, validate it with the organization's
PDF accessibility process and a dedicated checker such as PAC or an equivalent
PDF/UA validator. The report remains an evidence artifact, not a WCAG, ADA, or
Section 508 compliance certification.

## Screenshot Privacy

Screenshots are compressed by default as JPEG files at quality `70`. On long
pages, the CLI stores only focused regions around resolved error elements and
shows them as a small evidence gallery:

```bash
npx a11y-shiftleft explore --url $APP_URL --out reports
```

Exact visual duplicates are fingerprinted after capture and stored only once.
The state remains in `exploration-graph.json`, while `exploration.html` shows a
compact reference to the original screenshot instead of repeating the same
thumbnail. Each state can still open its own annotation layer.

Sensitive form fields are masked in screenshots by default. The redaction covers
common password, email, phone, token, card, address, and one-time-code inputs, as
well as elements marked with `data-a11y-sensitive`, `data-a11y-redact`, or
`data-private`.

For applications that may expose real personal data, login screens, payment
details, or production customer records, disable screenshots entirely:

```bash
npx a11y-shiftleft explore --url $APP_URL --no-screenshots --out reports
```

If you intentionally need raw local screenshots for debugging, disable masking:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --no-screenshot-redaction \
  --out reports
```

Use PNG only when the extra detail is worth the larger artifact size. Force
full-page evidence only when the complete surrounding page is required:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --screenshot-format png \
  --screenshot-full-page \
  --out reports
```

Automatic crops retain context padding, issue annotations, and sensitive-field
masking. Keep `--no-screenshots` for sensitive pages.

## Safe Mode

Safe mode skips submit/reset buttons, form buttons without an explicit safe
marker, external links, and actions whose labels look destructive,
transactional, privacy-sensitive, or permission-changing.

Some actions are hard-blocked even when `--no-safe-mode` is used. The built-in
multilingual blocklist covers common labels for account/session actions,
payments, cookie consent, camera/photo, microphone/audio recording, location,
notifications, file upload, and sharing controls. This is a safety layer, not a
complete translation system; add project-specific patterns when your product
uses custom wording.

Advertising and sponsored content are also hard-blocked. Exploration recognizes
common ad labels in multiple languages, `rel="sponsored"`, standard ad data
attributes and container names, and common advertising network URLs. External
links remain blocked, and script-opened popup pages are closed automatically.

Cookie controls are also detected from their surrounding banner or dialog.
This keeps short labels such as `Accept`, `Allow`, or `OK` from changing consent
when the button itself does not mention cookies. Recognized cookie consent
controls are never clicked by automatic exploration.

Cookies are isolated between explored states by default, so a cookie-setting
click in one state does not change later replay attempts. Use
`--no-isolate-cookies` only when you intentionally need cookie persistence
during local debugging.

Add `data-a11y-skip` to any element that should never be clicked during
automated exploration. Add `data-a11y-explore` only when a form button or custom
control is safe to exercise in automated scans.

Project-specific rules can live in `.a11y-shiftleft.json`:

```json
{
  "explore": {
    "safeMode": {
      "blockedText": ["logout", "delete", "pay*", "confirm"],
      "blockedRoles": ["menuitem"],
      "blockedUrls": ["*/checkout*", "*/account/billing*"],
      "blockedSelectors": ["[data-danger]", "[data-payment]"],
      "allowedSelectors": ["[data-a11y-explore]"],
      "dismissDialogs": true,
      "isolateCookies": true
    }
  }
}
```

Safe-mode patterns are case-insensitive strings with optional `*` wildcards.
They are not executable JavaScript regexes.

You can also add one-off rules from the command line:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --safe-block-text logout delete pay \
  --safe-block-url "*/checkout*" \
  --safe-block-selector "[data-danger]" \
  --out reports
```

## Output Modes

Suppress progress logs and console summary while still writing report files:

```bash
npx a11y-shiftleft explore --url $APP_URL --quiet --out reports
```

Ask for JSON when a script needs to parse stdout:

```bash
npx a11y-shiftleft explore --url $APP_URL --json-summary --out reports
```

Print exploration limits, screenshot settings, safe-mode settings, and output
formats before progress logs and the final summary:

```bash
npx a11y-shiftleft explore --url $APP_URL --verbose --out reports
```
