# a11y-shiftleft-cli

[![Quality](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml)
[![Accessibility Shift-Left](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml)
[![npm version](https://img.shields.io/npm/v/a11y-shiftleft-cli.svg)](https://www.npmjs.com/package/a11y-shiftleft-cli)

[npm package](https://www.npmjs.com/package/a11y-shiftleft-cli)

Accessibility checks for web apps, pull requests, and local reports.

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
npx a11y-shiftleft check --dynamic --url http://localhost:5173 --out reports
```

4. Open the human-readable report:

```bash
open reports/a11y-comment.md
```

The same run also creates:

```txt
reports/a11y-report.json
reports/a11y-metrics.csv
```

## Optional Project Setup

Create a config file and add generated reports to `.gitignore`:

```bash
npx a11y-shiftleft init --framework auto --gitignore
```

Then use a URL shortcut in your terminal:

```bash
export APP_URL=http://localhost:5173
npx a11y-shiftleft doctor --url $APP_URL
npx a11y-shiftleft check --dynamic --url $APP_URL --out reports
```

`APP_URL` is only a shortcut. You can always pass the URL directly:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:4200 --out reports
```

## Copy-Paste Recipes

| Goal | Command |
|---|---|
| Scan one running app URL | `npx a11y-shiftleft check --dynamic --url http://localhost:5173 --out reports` |
| Scan several known pages | `npx a11y-shiftleft check --dynamic --url $APP_URL $APP_URL/settings $APP_URL/checkout --out reports` |
| Let the CLI discover same-origin pages | `npx a11y-shiftleft check --dynamic --url $APP_URL --crawl --crawl-depth 1 --crawl-limit 10 --out reports` |
| Create a visual state report | `npx a11y-shiftleft explore --url $APP_URL --depth 2 --out reports` |
| Keep reports refreshed while coding | `npx a11y-shiftleft watch --url $APP_URL --out reports/watch` |
| Generate a fast PR workflow | `npx a11y-shiftleft ci --url $APP_URL --start-command "npm run dev -- --host localhost --port 5173"` |
| View historical trends | `npx a11y-shiftleft dashboard --reports reports` |

## What The Reports Mean

After a scan, start with `reports/a11y-comment.md`. It contains a compact table
and a list of findings with severity, WCAG metadata, confidence, and remediation
hints.

| File | Use it for | Commit it? |
|---|---|---|
| `reports/a11y-comment.md` | Human review and PR comments | Usually no |
| `reports/a11y-report.json` | Automation, debugging, integrations | Usually no |
| `reports/a11y-metrics.csv` | Trends and empirical validation | Usually no |
| `reports/exploration.html` | Visual review of explored UI states | Usually no |
| `reports/exploration.pdf` | Portable visual report artifact when `--pdf` is used | Usually no |
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
npx a11y-shiftleft adapter add react
npx a11y-shiftleft adapter add vue
npx a11y-shiftleft adapter add angular
```

Run static checks only:

```bash
npx a11y-shiftleft check --static --framework react --out reports
```

Run static and dynamic checks together:

```bash
npx a11y-shiftleft check --url $APP_URL --out reports
```

## Visual Exploration

Use `explore` when you do not want to list every route manually or when you
want screenshots of checked states.

**Screenshot privacy:** `explore` captures screenshots of every page it visits.
If the app you are scanning contains personal data, login screens, payment details,
or production customer records, use `--no-screenshots` to skip them entirely.
See [Visual reports](docs/visual-reports.md) for privacy and safe-mode details.

Use `explore` when you do not want to list every route manually or when you
want screenshots of checked states:

```bash
npx a11y-shiftleft explore --url $APP_URL --depth 2 --out reports
```

It safely follows same-origin links and low-risk UI expansion controls such as
menu buttons, tabs, disclosure widgets, and modal triggers.

It creates:

```txt
reports/exploration.html
reports/exploration.pdf       # only when --pdf is used
reports/exploration-graph.json
reports/screenshots/state-*.jpg
```

Screenshots are compressed, and sensitive form fields are masked by default.
Use `--no-screenshots` for apps with personal data, login screens, payment
details, or production records:

```bash
npx a11y-shiftleft explore --url $APP_URL --depth 2 --no-screenshots --out reports
```

Add `--pdf` when you need a portable copy of the visual report for a PR,
ticket, or internal review:

```bash
npx a11y-shiftleft explore --url $APP_URL --depth 2 --pdf --out reports
```

See [Visual reports](docs/visual-reports.md) for privacy and safe-mode details.

## Watch Mode

Use `watch` during local development:

```bash
npx a11y-shiftleft watch --url $APP_URL --out reports/watch
```

It watches common source folders such as `src`, `app`, `pages`, and
`components`, reruns checks after file changes, and prints what changed between
runs:

```txt
fixed 2, new 1, remaining 4
```

Use custom paths when your UI code lives somewhere else:

```bash
npx a11y-shiftleft watch \
  --url $APP_URL \
  --watch-path src shared/ui packages/app \
  --out reports/watch
```

See [Watch mode](docs/watch-mode.md) for more examples and current limits.

## Baseline Mode

Use baseline mode when adopting the CLI in a project that already has known
findings. The first run records the current findings:

```bash
npx a11y-shiftleft check --dynamic --url $APP_URL --baseline --out reports
```

Commit `.a11y-baseline.json`. Later CI runs with `--baseline` fail only on new
findings at the configured severity:

```bash
npx a11y-shiftleft check \
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
npx a11y-shiftleft ci \
  --url $APP_URL \
  --start-command "npm run dev -- --host localhost --port 5173" \
  --fail-on critical \
  --standard wcag22-aa
```

This creates:

```txt
.github/workflows/a11y.yml
```

For a fast PR workflow plus a broader scheduled scan:

```bash
npx a11y-shiftleft ci \
  --profile split \
  --url $APP_URL \
  --start-command "npm run dev -- --host localhost --port 5173" \
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
npx a11y-shiftleft dashboard --reports reports
```

Or write a static dashboard file:

```bash
npx a11y-shiftleft dashboard --reports reports --no-serve
```

Add `--pdf` when the dashboard should be attached to a ticket, review, or
internal report:

```bash
npx a11y-shiftleft dashboard --reports reports --pdf
```

The dashboard summarizes trends, top rules, affected pages, and recent runs.

## Ticket Drafts

Create dry-run Jira, Linear, or generic ticket drafts from an existing
`a11y-report.json`:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --tracker linear \
  --out reports/a11y-tickets.md
```

The export groups findings by severity, rule, page, and target. It does not
connect to Jira or Linear yet, so teams can review the draft before creating
real tickets.

## Manual Review Checklist

Automated tools do not catch every accessibility issue. Generate a manual
review checklist when you need human follow-up:

```bash
npx a11y-shiftleft check --url $APP_URL --semi-auto --out reports
```

This adds:

```txt
reports/a11y-manual-checklist.md
```

The checklist covers areas such as keyboard flow, screen reader smoke testing,
form label quality, content clarity, and complex widget behavior.

## WCAG And Compliance Support

Filter mapped findings by WCAG level or version:

```bash
npx a11y-shiftleft check --url $APP_URL --wcag-filter AA --out reports
npx a11y-shiftleft check --url $APP_URL --wcag-version 2.0 --out reports
```

Use a report metadata preset:

```bash
npx a11y-shiftleft check --url $APP_URL --standard wcag22-aa --out reports
npx a11y-shiftleft check --url $APP_URL --standard section508 --out reports
npx a11y-shiftleft check --url $APP_URL --standard ada-title-ii --out reports
```

Automated reports do not certify full WCAG, ADA, or Section 508 conformance.
Use them with manual keyboard review, screen reader checks, content review, and
your organization's compliance process.

## Troubleshooting

If a scan fails because of Node, Playwright, Chromium, config, or a target URL,
run:

```bash
npx a11y-shiftleft doctor --url $APP_URL
```

For CI or scripts:

```bash
npx a11y-shiftleft check --dynamic --url $APP_URL --json-summary --out reports
npx a11y-shiftleft check --dynamic --url $APP_URL --quiet --out reports
npx a11y-shiftleft check --dynamic --url $APP_URL --verbose --out reports
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

- [Recipes](docs/recipes/index.md): React, Vue, Angular, Next.js, multiple URL
  scans, GitHub Actions, ADA Title II, and Section 508 setup guides.
- [Configuration](docs/configuration.md): config files, `.gitignore`,
  baseline files, ignores, cleanup, and retention.
- [Visual reports](docs/visual-reports.md): screenshot privacy, safe mode, and
  advanced `explore` options.
- [Watch mode](docs/watch-mode.md): local development feedback after file
  changes.
- [Ticket export](docs/ticket-export.md): dry-run Jira, Linear, or generic
  ticket drafts from `a11y-report.json`.
- [Evidence methodology](docs/evidence-methodology.md): confidence scoring,
  issue categories, false-positive review, and metrics definitions.
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

Upcoming release:

- [v0.6.0](docs/release-notes-v0.6.0.md)

Latest published release:

- [v0.5.2](docs/release-notes-v0.5.2.md)

Previous releases:

- [v0.5.1](docs/release-notes-v0.5.1.md)
- [v0.5.0](docs/release-notes-v0.5.0.md)
- [v0.4.0](docs/release-notes-v0.4.0.md)
