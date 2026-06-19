# a11y-shiftleft-cli

[![Quality](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml)
[![Accessibility Shift-Left](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml)
[![npm version](https://img.shields.io/npm/v/a11y-shiftleft-cli.svg)](https://www.npmjs.com/package/a11y-shiftleft-cli)

[Install from npm](https://www.npmjs.com/package/a11y-shiftleft-cli):
`npm install --save-dev a11y-shiftleft-cli`

Accessibility checks for web apps, pull requests, visual reports, and local
dashboards.

`a11y-shiftleft-cli` helps teams find accessibility issues earlier, before they
ship. It scans a running web app in a real browser, optionally adds
framework-specific static checks, removes duplicate findings, assigns severity
and confidence, and writes reports that are useful for developers, QA, CI, and
trend tracking.

You can use it with React, Vue, Angular, Next.js, Svelte, Astro, Rails, Django,
static HTML, or any app that can run at a local or preview URL.

## Why Use It?

Most accessibility tools solve one part of the workflow:

- axe-core finds browser-rendered issues.
- ESLint plugins catch framework-specific patterns.
- Lighthouse gives a score.
- CI tells you whether a pull request should pass.

This project connects those pieces into one repeatable developer workflow:

- Run static and dynamic checks from one command.
- Deduplicate repeated findings.
- Map findings to WCAG metadata when available.
- Prioritize by severity and confidence.
- Export Markdown, JSON, CSV, visual HTML, and dashboard reports.
- Add bounded checks to pull requests.
- Track whether accessibility is getting better or worse over time.

## 2-Minute Quick Start

Use this when your app already runs locally.

1. Install the CLI:

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
```

The examples below use the published package name
`npx a11y-shiftleft-cli`. After local installation, the shorter
`npx a11y-shiftleft` alias also works inside the project.

2. Start your app in another terminal:

```bash
npm run dev
```

Common dev server URLs by framework or tool:

| Framework / Tool | Default URL |
|---|---|
| Vite (React, Vue, Svelte) | `http://localhost:5173` |
| Next.js | `http://localhost:3000` |
| Create React App | `http://localhost:3000` |
| Angular CLI | `http://localhost:4200` |
| Astro | `http://localhost:4321` |
| Webpack Dev Server | `http://localhost:8080` |

When in doubt, use the URL your terminal prints after `npm run dev`.

3. Run your first scan. Replace the URL with the URL printed by your dev server:

```bash
npx a11y-shiftleft-cli check --dynamic --url http://localhost:5173 --out reports
```

4. Open the human-readable report with your editor, or use the command for your
operating system:

```bash
# macOS
open reports/a11y-comment.md

# Linux
xdg-open reports/a11y-comment.md

# Windows PowerShell
start reports/a11y-comment.md
```

The same run also creates:

```txt
reports/a11y-report.json
reports/a11y-metrics.csv
```

## Optional Project Setup

Create a config file and add generated reports to `.gitignore`:

```bash
npx a11y-shiftleft-cli init --framework auto --gitignore
```

Then use a URL shortcut in your terminal. The examples below use macOS/Linux
shell syntax:

```bash
export APP_URL=http://localhost:5173
npx a11y-shiftleft-cli doctor --url $APP_URL
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports
```

In Windows PowerShell, set `$env:APP_URL = "http://localhost:5173"` and use
`$env:APP_URL` in place of `$APP_URL`. You can also avoid environment variables
and pass the URL directly on every operating system.

`APP_URL` is only a shortcut. You can always pass the URL directly:

```bash
npx a11y-shiftleft-cli check --dynamic --url http://localhost:4200 --out reports
```

## Copy-Paste Recipes

| Goal | Command |
|---|---|
| Scan one running app URL | `npx a11y-shiftleft-cli check --dynamic --url http://localhost:5173 --out reports` |
| Scan several known pages | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL $APP_URL/settings $APP_URL/checkout --out reports` |
| Let the CLI discover same-origin pages | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --crawl --crawl-depth 1 --crawl-limit 10 --out reports` |
| Trigger lazy-loaded below-the-fold content | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --scroll-step 800 --scroll-max-steps 25 --out reports` |
| Audit the keyboard focus path | `npx a11y-shiftleft-cli keyboard --url $APP_URL --out reports/keyboard` |
| Create a visual state report | `npx a11y-shiftleft-cli explore --url $APP_URL --depth 2 --out reports` |
| Force complete page screenshots | `npx a11y-shiftleft-cli explore --url $APP_URL --depth 2 --screenshot-full-page --out reports` |
| Keep reports refreshed while coding | `npx a11y-shiftleft-cli watch --url $APP_URL --out reports/watch` |
| Generate a fast PR workflow | `npx a11y-shiftleft-cli ci --url $APP_URL --start-command "npm run dev"` |
| View historical trends | `npx a11y-shiftleft-cli dashboard --reports reports` |

## What The Reports Mean

After a scan, start with `reports/a11y-comment.md`. It contains a compact table
and a list of findings with severity, WCAG metadata, confidence, and remediation
hints.

Each finding is labeled as a `WCAG violation`, `best practice`, or
`unmapped review`. Reports also group repeated occurrences into likely root
causes when the same rule and component state appear across routes. This grouping is
heuristic: per-page evidence remains available for review.

Every finding includes a deterministic `How to fix` recommendation. Known rules
provide specific steps, official guidance links, and framework examples when
available. Unknown rules still receive safe review steps instead of an empty
recommendation; axe findings also preserve their rule-specific help link.

| File | Use it for | Commit it? |
|---|---|---|
| `reports/a11y-comment.md` | Human review and PR comments | Usually no |
| `reports/a11y-report.json` | Automation, debugging, integrations | Usually no |
| `reports/a11y-metrics.csv` | Trends and empirical validation | Usually no |
| `reports/exploration.html` | Visual review of explored UI states | Usually no |
| `reports/exploration.pdf` | Portable visual report artifact when `--pdf` is used | Usually no |
| `reports/keyboard-path.md` | Human-readable Tab order and focus evidence | Usually no |
| `reports/keyboard-report.json` | Structured keyboard traversal data | Usually no |
| `reports/screenshots/` | Screenshots from visual exploration | No |
| `.a11y-shiftleft.json` | Shared project config | Usually yes |
| `.a11y-baseline.json` | Accepted known findings | Yes, when using baseline mode |
| `a11y-ignore.json` | Temporary reviewed exceptions | Yes, when intentionally used |

Each finding can include:

```json
{
  "ruleId": "color-contrast",
  "severity": "critical",
  "confidence": "high",
  "confidenceScore": 95,
  "category": "contrast",
  "findingType": "wcag",
  "contrast": {
    "actualRatio": 2.32,
    "requiredRatio": 4.5,
    "foreground": "#aaaaaa",
    "background": "#ffffff",
    "suggestions": [
      { "target": "foreground", "purpose": "minimum", "color": "#767676", "contrastRatio": 4.54 },
      { "target": "foreground", "purpose": "recommended", "color": "#6F6F6F", "contrastRatio": 5.02 },
      { "target": "foreground", "purpose": "enhanced", "color": "#595959", "contrastRatio": 7 }
    ]
  },
  "wcag": ["1.4.3"],
  "wcagCriteria": [
    {
      "id": "1.4.3",
      "title": "Contrast (Minimum)",
      "level": "AA",
      "principle": "perceivable",
      "url": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    }
  ]
}
```

Severity answers: "How risky is this finding?"

Confidence answers: "How strong is the tool evidence?"

For axe `color-contrast` findings, JSON, Markdown, and visual reports include
the measured and required ratios, text and background colors, font metadata,
and deterministic suggestions that meet the reported threshold. Treat suggested
colors as starting points and verify shared design tokens and interactive states.

When a dynamic run checks multiple pages, the CLI also compares document
titles. It reports common starter placeholders such as `Vite + React` and titles
reused across distinct URLs, while repeated dialogs, themes, and other states of
the same URL are not treated as duplicate pages.

## Static Checks For React, Vue, And Angular

Dynamic browser scans work without a framework adapter. Static checks are
optional and add framework-specific lint findings.

Install only the adapter package you need:

| Project | Install |
|---|---|
| React | `npm install --save-dev @a11y-shiftleft/react` |
| Vue | `npm install --save-dev @a11y-shiftleft/vue` |
| Angular | `npm install --save-dev @a11y-shiftleft/angular` |

Ask the CLI for a recommendation:

```bash
npx a11y-shiftleft-cli adapter add react
npx a11y-shiftleft-cli adapter add vue
npx a11y-shiftleft-cli adapter add angular
```

Run static checks only:

```bash
npx a11y-shiftleft-cli check --static --framework react --out reports
```

Run static and dynamic checks together:

```bash
npx a11y-shiftleft-cli check --url $APP_URL --out reports
```

## Visual Exploration

**Screenshot privacy:** `explore` captures screenshots of every page it visits.
If the app you are scanning contains personal data, login screens, payment details,
or production customer records, use `--no-screenshots` to skip them entirely.
See [Visual reports](docs/visual-reports.md) for privacy and safe-mode details.

Use `explore` when you do not want to list every route manually or when you
want screenshots of checked states:

```bash
npx a11y-shiftleft-cli explore --url $APP_URL --depth 2 --out reports
```

Dynamic scans and visual exploration auto-scroll pages before running axe. This
helps trigger lazy-loaded sections below the first viewport. The scan still
stays bounded for CI with a default maximum of 25 scroll steps per page. Use
`--no-scroll` only when a project needs to avoid scroll-triggered behavior.

The same commands automatically compare the rendered light and dark system
color schemes when the page actually changes between them. Findings and visual
states are labeled by color scheme in the reports. Pages that render identically
are scanned once, so no theme option or second command is needed.

Screenshots are compact by default. Short affected pages can be captured in
full, while long pages are automatically split into focused crops around
nearby errors. This keeps below-the-fold evidence without storing thousands of
unrelated pixels. Force complete pages only when an audit specifically needs
that context:

```bash
npx a11y-shiftleft-cli explore \
  --url $APP_URL \
  --depth 2 \
  --screenshot-full-page \
  --out reports
```

Pixel-identical screenshots are stored only once. Repeated UI states remain in
the exploration graph, but the HTML report replaces duplicate thumbnails with
a link to the shared visual evidence.

For apps that render data after the first page load, add a short settle wait:

```bash
npx a11y-shiftleft-cli explore --url $APP_URL --depth 2 --wait-ms 1000 --out reports
```

If your app exposes a stable loaded-state selector, wait for that instead of
guessing a long timeout:

```bash
npx a11y-shiftleft-cli explore \
  --url $APP_URL \
  --wait-for-selector "[data-page-ready]" \
  --wait-ms 1000 \
  --out reports
```

It safely follows same-origin links and low-risk UI expansion controls such as
menu buttons, tabs, disclosure widgets, and modal triggers. Cookie consent
controls are never clicked automatically, including short buttons such as
`Accept` or `OK` when they appear inside a recognized consent banner.
Recognizable theme switches are checked early so explicit app themes are less
likely to be skipped by the bounded action limit.

It creates:

```txt
reports/exploration.html
reports/exploration.pdf       # only when --pdf is used
reports/exploration-graph.json
reports/screenshots/state-*.jpg
reports/screenshots/state-*-error-*.jpg   # focused crops on long pages
```

Screenshots are compressed, and sensitive form fields are masked by default.
Use `--no-screenshots` for apps with personal data, login screens, payment
details, or production records:

```bash
npx a11y-shiftleft-cli explore --url $APP_URL --depth 2 --no-screenshots --out reports
```

Add `--pdf` when you need a portable copy of the visual report for a PR,
ticket, or internal review:

```bash
npx a11y-shiftleft-cli explore --url $APP_URL --depth 2 --pdf --out reports
```

Generated PDFs include tagged structure, document language and title metadata,
heading bookmarks, image alternative text from the HTML report, and semantic
table headers where tables are present. Generation fails if the required PDF
structure is missing. This improves screen-reader and keyboard navigation, but
does not claim independent PDF/UA conformance certification.

See [Visual reports](docs/visual-reports.md) for privacy and safe-mode details.

## Watch Mode

Use `watch` during local development:

```bash
npx a11y-shiftleft-cli watch --url $APP_URL --out reports/watch
```

It watches common source folders such as `src`, `app`, `pages`, and
`components`, reruns checks after file changes, and prints what changed between
runs:

```txt
fixed 2, new 1, remaining 4
```

Use custom paths when your UI code lives somewhere else:

```bash
npx a11y-shiftleft-cli watch \
  --url $APP_URL \
  --watch-path src shared/ui packages/app \
  --out reports/watch
```

See [Watch mode](docs/watch-mode.md) for more examples and current limits.

## Baseline Mode

Use baseline mode when adopting the CLI in a project that already has known
findings. The first run records the current findings:

```bash
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --baseline --out reports
```

Commit `.a11y-baseline.json`. Later CI runs with `--baseline` fail only on new
findings at the configured severity:

```bash
npx a11y-shiftleft-cli check \
  --dynamic \
  --url $APP_URL \
  --baseline \
  --fail-on warning \
  --out reports
```

## Temporary Ignores

Use `a11y-ignore.json` only for reviewed temporary exceptions:

```json
{
  "version": 1,
  "ignores": [
    {
      "ruleId": "color-contrast",
      "selector": ".legacy-muted-text",
      "reason": "Legacy theme is scheduled for replacement.",
      "owner": "@frontend-team",
      "expires": "2026-09-30"
    }
  ]
}
```

Ignores require a reason, owner, and expiration date so they do not become
permanent hidden risk.

## GitHub Actions

Generate a pull request workflow:

```bash
npx a11y-shiftleft-cli ci \
  --url $APP_URL \
  --start-command "npm run dev" \
  --fail-on critical \
  --standard wcag22-aa
```

`--start-command` must be the command that starts your project at `APP_URL`.
For example, a Vite project on a non-default port can use
`"npm run dev -- --host localhost --port 5173"`.

This creates:

```txt
.github/workflows/a11y.yml
```

For a fast PR workflow plus a broader scheduled scan:

```bash
npx a11y-shiftleft-cli ci \
  --profile split \
  --url $APP_URL \
  --start-command "npm run dev" \
  --fail-on critical \
  --full-fail-on none \
  --crawl-limit 10 \
  --full-crawl-depth 3 \
  --full-crawl-limit 100 \
  --standard wcag22-aa
```

This creates:

```txt
.github/workflows/a11y-pr.yml
.github/workflows/a11y-full.yml
```

## Dashboard

After several saved runs, open a local dashboard:

```bash
npx a11y-shiftleft-cli dashboard --reports reports
```

Or write a static dashboard file:

```bash
npx a11y-shiftleft-cli dashboard --reports reports --no-serve
```

Add `--pdf` when the dashboard should be attached to a ticket, review, or
internal report:

```bash
npx a11y-shiftleft-cli dashboard --reports reports --pdf
```

The dashboard summarizes trends, top rules, affected pages, and recent runs.

## Ticket Drafts

Create dry-run Jira, Linear, or generic ticket drafts from an existing
`a11y-report.json`:

```bash
npx a11y-shiftleft-cli ticket export \
  --report reports/a11y-report.json \
  --tracker linear \
  --out reports/a11y-tickets.md
```

The export groups findings by severity, rule, page, and target. It does not
connect to Jira or Linear yet, so teams can review the draft before creating
real tickets.

## Keyboard Focus Audit

Run a bounded keyboard-only traversal on a page:

```bash
npx a11y-shiftleft-cli keyboard --url $APP_URL --out reports/keyboard
```

The runner presses `Tab` and, after a complete forward cycle, `Shift+Tab`
without clicking controls or submitting forms. It
records selectors, roles, accessible names, visibility, focus indicators, and
obscuration for up to 40 steps. It reports common positive `tabindex`, stuck or
incomplete focus cycles, forward/reverse order mismatches, missing visible
focus, and focus hidden behind other content, with mappings to WCAG 2.1.1,
2.1.2, 2.4.3, 2.4.7, and 2.4.11.

Use `--max-tabs 80` for a larger page. The generated `keyboard-path.md` and
`keyboard-report.json` are accompanied by the normal Markdown, JSON, and CSV
finding reports. This bounded traversal does not replace manual testing of
Enter, Space, Escape, arrow-key widgets, modal behavior, or complete user tasks.

See [Keyboard focus audit](docs/keyboard-audit.md) for report details and
current limits.

## Manual Review Checklist

Automated tools do not catch every accessibility issue. Generate a manual
review checklist when you need human follow-up:

```bash
npx a11y-shiftleft-cli check --url $APP_URL --semi-auto --out reports
```

This adds:

```txt
reports/a11y-manual-checklist.md
```

The checklist covers areas such as keyboard flow, screen reader smoke testing,
form labels, content clarity, 200% zoom and reflow, alternative-text and logo quality,
media and motion, skip links, and representative-user task testing that
automated tools cannot fully judge.

## WCAG And Compliance Support

Filter mapped findings by WCAG level or version:

```bash
npx a11y-shiftleft-cli check --url $APP_URL --wcag-filter AA --out reports
npx a11y-shiftleft-cli check --url $APP_URL --wcag-version 2.0 --out reports
```

Use a report metadata preset:

```bash
npx a11y-shiftleft-cli check --url $APP_URL --standard wcag22-aa --out reports
npx a11y-shiftleft-cli check --url $APP_URL --standard section508 --out reports
npx a11y-shiftleft-cli check --url $APP_URL --standard ada-title-ii --out reports
```

Automated reports do not certify full WCAG, ADA, or Section 508 conformance.
Use them with manual keyboard review, screen reader checks, content review, and
your organization's compliance process.

## Troubleshooting

If a scan fails because of Node, Playwright, Chromium, config, or a target URL,
run:

```bash
npx a11y-shiftleft-cli doctor --url $APP_URL
```

For CI or scripts:

```bash
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --json-summary --out reports
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --quiet --out reports
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --verbose --out reports
```

## Local Demo

This repository includes a React/Vite demo with intentional accessibility
defects.

```bash
nvm use
npm install
npm run demo -- --port 5173
```

In another terminal:

```bash
nvm use
node bin/cli.js check --dynamic --url http://localhost:5173 --out reports
```

## More Documentation

- [FAQ](docs/faq.md): Common questions about installing, running, and reading reports.
- [Recipes](docs/recipes/index.md): React, Vue, Angular, Next.js, multiple URL
  scans, GitHub Actions, ADA Title II, and Section 508 setup guides.
- [Configuration](docs/configuration.md): config files, `.gitignore`,
  baseline files, ignores, cleanup, and retention.
- [Visual reports](docs/visual-reports.md): screenshot privacy, safe mode, and
  advanced `explore` options.
- [Report sharing](docs/report-sharing.md): GitHub Actions artifacts, privacy
  review, and the planned sanitized export path.
- [Keyboard focus audit](docs/keyboard-audit.md): bounded Tab traversal,
  generated focus-path evidence, and current limitations.
- [Watch mode](docs/watch-mode.md): local development feedback after file
  changes.
- [Ticket export](docs/ticket-export.md): dry-run Jira, Linear, or generic
  ticket drafts from `a11y-report.json`.
- [Evidence methodology](docs/evidence-methodology.md): confidence scoring,
  issue categories, false-positive review, and metrics definitions.
- [WCAG 2.2 coverage](docs/wcag-coverage.md): criterion-by-criterion automated,
  manual, and missing coverage.
- [Empirical validation](docs/empirical-validation.md): baseline vs
  intervention study design and analysis commands.
- [Adoption strategy](docs/adoption-strategy.md): npm scripts, generated CI,
  future GitHub Action wrapper, docs-site plan, and outreach ideas.
- [Roadmap](docs/roadmap.md): Lighthouse comparison, browser overlay,
  dashboard improvements, and future tracker integrations.
- [Contributing](CONTRIBUTING.md): first PR path, local setup, testing, issue
  templates, and pull request checklist.
- [GitHub About setup](docs/github-about.md): recommended repository
  description, website, and topics.

## Release Notes

Current release:

- [v0.6.3](docs/release-notes-v0.6.3.md)

Previous releases:

- [v0.6.2](docs/release-notes-v0.6.2.md)
- [v0.6.1](docs/release-notes-v0.6.1.md)
- [v0.6.0](docs/release-notes-v0.6.0.md)
- [v0.5.2](docs/release-notes-v0.5.2.md)
- [v0.5.1](docs/release-notes-v0.5.1.md)
- [v0.5.0](docs/release-notes-v0.5.0.md)
- [v0.4.0](docs/release-notes-v0.4.0.md)
