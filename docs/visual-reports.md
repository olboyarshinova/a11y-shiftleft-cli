# Visual Reports

For a complete report, use `audit`. It adds keyboard evidence and a manual
review checklist to the visual exploration results:

```bash
npx a11y-shiftleft audit --url $APP_URL --out reports
```

Open `reports/a11y-report.html`. Add `--excel`, `--pdf`, or `--raw` when those
optional exports are needed. Slow applications can use `--wait-ms 1000` or
`--wait-for-selector "[data-page-ready]"`; audit auto-scrolls before scanning
unless `--no-scroll` is passed.

Create `a11y-scope.json` before a run when the report should include planned
audit context:

```bash
npx a11y-shiftleft scope init \
  --url $APP_URL \
  --product-type "web application" \
  --sample-page "Core page:$APP_URL|Primary app entry"
```

The visual report then shows the planned product type, target standard, and
representative sample count next to the discovered browser scope. The same
planned scope is also embedded in `a11y-report.json`, `a11y-comment.md`, and
`evaluation-scope.json`.

Findings are linked to critical journeys when their URL matches a journey URL.
Markdown and JSON reports include a journey-impact summary, and the findings
CSV includes a `journeys` column for spreadsheet triage.

Use `explore` when you want the CLI to walk safe parts of a running app and
produce only the lower-level visual exploration artifacts:

```bash
npx a11y-shiftleft explore --url $APP_URL --depth 2 --out reports
```

`explore` opens the start URL, scans it with axe, then safely follows
same-origin links and low-risk UI expansion controls such as menu buttons,
tabs, disclosure widgets, and modal triggers.

`--depth` controls how many transitions may appear in one exploration path; it
does not mean "visit this many pages." The state and per-state action limits
also bound the run. Repeated links to the same normalized URL and links back to
the current page are not queued, and unique same-origin destinations are
prioritized before ordinary UI clicks. Compare `Pages visited`, `Rendered
states`, and `Unique screenshots` in the report: screenshot deduplication can
make the last number smaller without reducing scan coverage.

For every discovered state, `explore` automatically compares light and dark
system color schemes. When the rendered appearance changes, both variants are
scanned and shown as separate labeled states. If they are visually equivalent,
the state is scanned once. No theme-specific command is required. Recognizable
theme toggle controls are prioritized during bounded action discovery as well.

It saves:

```txt
reports/a11y-report.json
reports/a11y-comment.md
reports/a11y-findings.csv
reports/a11y-summary.csv
reports/a11y-pages.csv
reports/a11y-rules.csv
reports/exploration.html
reports/exploration.pdf       # only when --pdf is used
reports/exploration-graph.json
reports/screenshots/state-*.jpg
reports/screenshots/state-*-error-*.jpg   # focused crops on long pages
```

`exploration.html` shows summary metrics, checked states, screenshots, top
findings, recorded transitions, skipped actions, and reviewable overlays around
affected elements when Playwright can resolve their bounds.

The unified `a11y-report.html` also includes an audit coverage matrix and a
bounded Chromium accessibility-tree summary for each explored state. The
summary records exposed landmarks, headings, an interactive-node sample, and
the number of unnamed interactive nodes without storing the entire tree. This
is diagnostic evidence, not a substitute for NVDA, JAWS, or VoiceOver testing.

The coverage matrix is a bordered working checklist. Its compact state summary
shows how many review areas have failed evidence, need review, were not tested,
were unavailable, or passed automated evidence. Green locked checkboxes identify
evidence collected by the audit; yellow rows remain available for manual
confirmation. Its Findings column shows the number of issues associated with a
completed automated area; `0` means the area ran without a finding, while an em
dash means no automated result is available. Missing optional checks show a
copy-paste command in the next-step column. Manual selections are stored in
browser local storage under an identifier unique to the generated report. They
are not uploaded, written back into the report files, or treated as proof of
WCAG conformance.

The Evaluation Scope section includes a Report Completeness checklist. It shows
whether the visual artifact contains date, URL and state scope, automated-tool
evidence, keyboard evidence, manual-review records, optional Lighthouse
comparison, known limitations, and next steps. Items marked for review are
signals to add manual evidence, not automatic failures.

The manual checklist also includes a structured environment template for human
review. Record the operating system, browser, assistive technology and version,
input method, viewport or zoom level, and color mode used for each review.
The same fields are present in the generated JSON checklist for teams that
aggregate manual evidence later.

Each explored state also receives a bounded 400% reflow proxy at 320 CSS pixels. It
records document width, horizontal overflow, and text containers that appear to
clip meaningful content. These are heuristic WCAG 1.4.10 signals: confirm them
at 400% zoom before treating intentional truncation as a defect.

For modals reached through safe exploration, the report records the dialog
name, initial focused element, isolated Escape result, and focus restoration to
the trigger. The isolated page prevents the close test from changing the main
exploration path. This bounded evidence does not prove a complete focus trap or
all dialog workflows.

Safe click transitions also collect bounded dynamic-announcement evidence from
`aria-live` and implicit live-region roles such as `alert` and `status`. The
report records text and politeness when mutations occur, and explicitly records
actions with no observed live-region update. Absence is evidence, not an
automatic defect, because many visual changes do not require an announcement.

Rendered form states include counts and details for explicit invalid fields,
their `aria-errormessage` or `aria-describedby` references, exposed error text,
error summaries, and focus. The scanner does not submit forms or enter data.
It flags only explicit invalid fields whose referenced error is missing, hidden,
or empty; message usefulness and end-to-end correction remain manual checks.

Rendered image states summarize informative and decorative alternatives and
surface deterministic quality patterns such as filename-like text, exact
generic labels, nearby-text duplication, reuse across different sources, and
excessive length. The report labels these as medium-confidence review signals.
It cannot decide whether an image is informative or whether the alternative is
accurate in context, so WCAG 1.1.1 still requires human review.

Media and motion evidence lists rendered players with caption-track,
transcript-candidate, autoplay, muted, and controls state. It also records
active Web Animations and whether readable CSS contains
`prefers-reduced-motion`. Cross-origin stylesheets may be unreadable, so a
missing query is not reported as a failure. Caption accuracy, transcripts,
audio description, flashing, and motion comfort still require human review.

Iframe and canvas evidence records same-origin/cross-origin counts, whether the
browser could inspect each frame document, and whether canvas elements expose
fallback content or an accessible name. Frame URLs are stored without query
strings or fragments. Modern axe scans available frame documents recursively;
unavailable frames need a separate audit, and meaningful canvas pixels always
need contextual human review.

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

Use `Copy issue` on a finding group to copy a local Markdown draft in the
browser. The draft is intended for GitHub Issues, Jira, Linear, or team notes,
but the visual report does not send data to those trackers or create an external
issue automatically.

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
