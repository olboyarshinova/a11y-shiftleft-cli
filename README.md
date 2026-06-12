# a11y-shiftleft-cli

[![Quality](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml)
[![Accessibility Shift-Left](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml)
[![npm version](https://img.shields.io/npm/v/a11y-shiftleft-cli.svg)](https://www.npmjs.com/package/a11y-shiftleft-cli)

Accessibility testing CLI for web apps, pull requests, and local reports.

The CLI is designed to run inside any web project. Dynamic checks work with any
web framework because they scan the rendered page in a browser. For React, Vue,
and Angular projects, optional adapters can add framework-specific static
checks.

Severity answers "how risky is this finding?" Confidence answers "how strong is
the tooling evidence?" so teams can prioritize high-confidence critical findings
without losing lower-confidence review leads.

## Why This Exists

Accessibility teams already have strong tools such as axe-core, Lighthouse,
WAVE, Pa11y, and eslint-plugin-jsx-a11y. This project is not trying to replace
them.

`a11y-shiftleft-cli` is an orchestration layer for development workflows. It
coordinates static and dynamic checks, normalizes findings into one schema,
deduplicates overlapping warnings, applies a consistent severity policy, and
exports reproducible metrics for CI, PR review, and empirical evaluation.

It produces several report surfaces from the same normalized findings:

- terminal summaries for local development and CI logs
- `a11y-comment.md` for pull request comments and human review
- `a11y-report.json` for automation and debugging
- `a11y-metrics.csv` for trend analysis and empirical validation
- `a11y-manual-checklist.md` for semi-automated manual review
- `exploration.html` with screenshots, checked states, and visual annotations
- `dashboard` for historical trends across saved report runs

## Quick Start

Use this flow when you already have a web app that can run on `localhost`.
Dynamic scans work with any framework because the CLI tests the rendered page in
a browser.

1. Install the CLI in the project you want to scan:

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
```

2. Add the default config and keep generated reports out of git:

```bash
npx a11y-shiftleft init --framework auto --gitignore
```

3. Start your app in another terminal:

```bash
npm run dev
```

4. Set the URL printed by your dev server. `APP_URL` is just a terminal
   shortcut for "the URL where my app is running":

```bash
export APP_URL=http://localhost:5173
```

Use whatever your app prints. For example, if your dev server says
`Local: http://localhost:4200`, run:

```bash
export APP_URL=http://localhost:4200
```

You can also skip `APP_URL` and pass the URL directly:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:4200 --out reports
```

5. Check that the setup and URL are ready:

```bash
npx a11y-shiftleft doctor --url $APP_URL
```

6. Run your first accessibility scan:

```bash
npx a11y-shiftleft check --dynamic --url $APP_URL --out reports
```

7. Read the terminal summary, then open the generated report files:

```txt
reports/a11y-comment.md
reports/a11y-report.json
reports/a11y-metrics.csv
```

`a11y-comment.md` is the easiest file to read first. `a11y-report.json` is for
automation and deeper debugging. `a11y-metrics.csv` is for trend tracking.

In an interactive terminal, `check` prints a readable summary with severity
counts, top rules, affected pages, and report paths. Use `--json-summary` when a
script needs the stdout summary as JSON.

## Pick Your Setup

Commands below use `APP_URL` to avoid hard-coding one port. Replace it with
your real local URL or preview URL if you prefer.

| Goal | Command |
|---|---|
| Scan one running app URL | `npx a11y-shiftleft check --dynamic --url $APP_URL --out reports` |
| Scan several known pages | `npx a11y-shiftleft check --dynamic --url $APP_URL $APP_URL/settings --out reports` |
| Let the CLI discover safe same-origin pages | `npx a11y-shiftleft check --dynamic --url $APP_URL --crawl --crawl-depth 1 --crawl-limit 10 --out reports` |
| Create a visual state report with screenshots | `npx a11y-shiftleft explore --url $APP_URL --depth 2 --out reports` |
| View historical report trends | `npx a11y-shiftleft dashboard --reports reports` |
| Add a fast PR workflow | `npx a11y-shiftleft ci --url $APP_URL --start-command "npm run dev -- --host localhost --port 5173"` |

Dynamic scanning is the portable baseline: React, Vue, Angular, Svelte, Next.js,
Nuxt, Astro, Rails, Django, static HTML, and other apps can be scanned if they
are running at a URL.

## Static Checks

Static checks are optional. They add framework-specific lint findings on top of
the dynamic browser scan. Install only the adapter package for your project:

| Project | Install |
|---|---|
| React | `npm install --save-dev @a11y-shiftleft/react` |
| Vue | `npm install --save-dev @a11y-shiftleft/vue` |
| Angular | `npm install --save-dev @a11y-shiftleft/angular` |

You can also ask the CLI to print the recommended install command:

```bash
npx a11y-shiftleft adapter add react
npx a11y-shiftleft adapter add vue
npx a11y-shiftleft adapter add angular
```

`doctor` can also detect React, Vue, or Angular from `package.json` and print a
framework-specific adapter recommendation when optimized static checks are not
installed yet:

```bash
npx a11y-shiftleft doctor --url $APP_URL
```

Then initialize the matching framework config:

```bash
npx a11y-shiftleft init --framework react --gitignore
```

Run static checks:

```bash
npx a11y-shiftleft check --static --framework react --out reports
```

Run static and dynamic checks together:

```bash
npx a11y-shiftleft check --url $APP_URL --out reports
```

## What Gets Created

| Path | Purpose | Commit it? |
|---|---|---|
| `.a11y-shiftleft.json` | Project config for framework, WCAG target, URLs, and scan options | Usually yes, when it is shared team config |
| `.a11y-baseline.json` | Accepted known findings for baseline mode | Yes, when using `--baseline` |
| `a11y-ignore.json` | Temporary scoped ignores with reason, owner, and expiration | Yes, when intentionally used |
| `reports/a11y-comment.md` | Human-readable report for local review or PR comments | Usually no |
| `reports/a11y-report.json` | Machine-readable findings and evidence | Usually no |
| `reports/a11y-metrics.csv` | Run metrics for trend analysis | Usually no |
| `reports/exploration.html` | Visual state report from `explore` | Usually no |
| `reports/screenshots/` | Generated screenshots from `explore` | No |

`npx a11y-shiftleft init --gitignore` adds generated report directories to
`.gitignore`.

Commit `.a11y-shiftleft.json` only when it defines shared project defaults that
CI and teammates should reuse. Keep local-only URLs, experiments, and
machine-specific paths out of git.

Config can live in `.a11y-shiftleft.json`, `.a11yrc.json`, `package.json#a11y`,
or a file passed with `--config`.

## Visual Exploration

Use `explore` when you do not want to list every route manually or want a
graphical report of visited states:

```bash
npx a11y-shiftleft explore --url $APP_URL --depth 2 --out reports
```

`explore` opens the start URL, scans it with axe, then safely follows
same-origin links and low-risk UI expansion controls such as menu buttons,
tabs, disclosure widgets, and modal triggers. It saves:

- `reports/a11y-report.json`
- `reports/a11y-comment.md`
- `reports/exploration.html`
- `reports/exploration-graph.json`
- `reports/screenshots/state-*.jpg`

Open `reports/exploration.html` to review checked states visually. The report
shows a triage overview, state screenshots, top findings, recorded transitions,
skipped actions, and reviewable overlays around affected elements when their
bounds are available.

Screenshots are compressed and sensitive form fields are masked by default. Use
`--no-screenshots` for apps that may expose personal data, login screens,
payment details, or production records.

See [docs/visual-reports.md](docs/visual-reports.md) for screenshot privacy,
safe-mode blocklists, and advanced `explore` options.

## Historical Dashboard

Use `dashboard` after you have several `check` or `explore` runs saved in a
report directory. It indexes nested `a11y-report.json` files and serves a local
summary with trend, top rules, affected pages, and recent runs:

```bash
npx a11y-shiftleft dashboard --reports reports
```

For a static file that can be attached to internal docs or opened later:

```bash
npx a11y-shiftleft dashboard --reports reports --no-serve
```

The dashboard data uses paths relative to the selected reports directory rather
than absolute local filesystem paths. Use timestamped output folders when you
want dashboard trends across multiple runs.

## More Check Options

Scan several known routes in one run:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url $APP_URL $APP_URL/favorites $APP_URL/settings \
  --out reports
```

Let the CLI discover safe same-origin pages:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url $APP_URL \
  --crawl \
  --crawl-depth 1 \
  --crawl-limit 10 \
  --out reports
```

Use baseline mode when adopting the CLI in a project with known findings. The
first run creates `.a11y-baseline.json` from the current unique findings:

```bash
npx a11y-shiftleft check --dynamic --baseline --out reports
```

Commit `.a11y-baseline.json` with the project. Later CI runs with `--baseline`
compare current findings against that file and fail only on new findings at the
configured `--fail-on` severity:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --baseline \
  --fail-on warning \
  --out reports
```

Use `a11y-ignore.json` only for temporary, reviewed exceptions:

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

If a scan fails because of Node, Playwright, Chromium, config, or app startup
issues, run:

```bash
npx a11y-shiftleft doctor --url $APP_URL
```

For scripts and CI logs:

```bash
npx a11y-shiftleft check --dynamic --url $APP_URL --json-summary --out reports
npx a11y-shiftleft check --dynamic --url $APP_URL --quiet --out reports
npx a11y-shiftleft check --dynamic --url $APP_URL --verbose --out reports
```

Write specific report formats:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url $APP_URL \
  --format json csv \
  --out reports
```

Limit static checks to specific files:

```bash
npx a11y-shiftleft check \
  --static \
  --framework react \
  --include "src/**/*.{js,jsx,ts,tsx}" \
  --out reports
```

Filter by WCAG target:

```bash
npx a11y-shiftleft check --url $APP_URL --wcag-filter AA --out reports
npx a11y-shiftleft check --url $APP_URL --wcag-version 2.0 --out reports
```

Use a WCAG-based compliance support preset:

```bash
npx a11y-shiftleft check --url $APP_URL --standard section508 --out reports
npx a11y-shiftleft check --url $APP_URL --standard ada-title-ii --out reports
npx a11y-shiftleft check --url $APP_URL --standard wcag22-aa --out reports
```

The presets configure report metadata and WCAG filtering defaults. Mapped
findings are limited to the selected WCAG version and Level AA target, while
unmapped best-practice findings remain visible in a separate report section.

Generate a semi-automated manual review checklist alongside automated reports:

```bash
npx a11y-shiftleft check --url $APP_URL --semi-auto --out reports
```

See [docs/configuration.md](docs/configuration.md) for config sources,
baseline refresh, scoped ignore rules, report cleanup, and retention settings.

## Scan A Different Directory

Useful for monorepos or local testing:

```bash
npx a11y-shiftleft check \
  --cwd ./apps/web \
  --dynamic \
  --url $APP_URL \
  --out reports
```

## Generate CI

Generate the default fast PR workflow:

```bash
npx a11y-shiftleft ci \
  --url $APP_URL \
  --start-command "npm run dev -- --host localhost --port 5173" \
  --fail-on critical \
  --standard wcag22-aa
```

This creates a pull-request workflow that runs a bounded dynamic crawl:

```txt
.github/workflows/a11y.yml
```

By default the PR workflow uses `--crawl-depth 1` and `--crawl-limit 10`, so it
is intended to give quick feedback instead of scanning every reachable page.

Generate separate workflows for quick PR checks and scheduled full-site checks:

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

The PR workflow runs on `pull_request`, posts the report comment, and keeps the
scan bounded for review speed. The full-site workflow runs on
`workflow_dispatch` and a weekly schedule, uploads a separate artifact, and
does not comment on pull requests.

Generate CI for a known route set and a compliance-support preset:

```bash
npx a11y-shiftleft ci \
  --url $APP_URL $APP_URL/favorites $APP_URL/settings \
  --start-command "npm run dev -- --host localhost --port 5173" \
  --fail-on warning \
  --standard section508
```

## IDE Feedback

The package does not include a custom IDE extension. For editor highlighting,
use your IDE's ESLint integration with accessibility lint rules enabled. The CLI
is the repository-level orchestration layer for CI reports, dynamic scans,
deduplication, and metrics.

See [docs/ide-integration.md](docs/ide-integration.md) for a React setup.

## Outputs

```txt
reports/a11y-report.json
reports/a11y-metrics.csv
reports/a11y-comment.md
reports/a11y-manual-checklist.md
```

`a11y-manual-checklist.md` is only created when `--semi-auto` is used. It
covers review areas that automated tools cannot fully validate, such as content
clarity, logical navigation, form label quality, complex widget focus behavior,
and screen reader smoke testing.

Each normalized finding includes WCAG references where the adapter or rule map
can identify them, plus confidence and category metadata for triage:

```json
{
  "ruleId": "color-contrast",
  "severity": "critical",
  "confidence": "high",
  "confidenceScore": 95,
  "confidenceReason": "Detected by axe on the rendered DOM with a concrete selector and WCAG mapping.",
  "category": "contrast",
  "wcag": ["1.4.3"],
  "wcagCriteria": [
    {
      "id": "1.4.3",
      "title": "Contrast (Minimum)",
      "level": "AA",
      "principle": "perceivable",
      "introducedIn": "2.0",
      "url": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
    }
  ]
}
```

Set `wcagVersion` in `.a11y-shiftleft.json` to keep mapped findings aligned
with the standard version your team targets:

```json
{
  "wcagVersion": "2.2",
  "wcagLevel": "AA"
}
```

Automated reports do not certify full WCAG, ADA, or Section 508 conformance.
Use them with manual keyboard review, screen reader checks, content review, and
your organization's compliance process.

## Project Docs

- [Recipes](docs/recipes/index.md): setup guides for React, Vue, Angular,
  Next.js, GitHub Actions, ADA Title II, and Section 508 workflows.
- [Configuration](docs/configuration.md): config files, gitignore, baseline,
  ignores, cleanup, and retention.
- [Visual reports](docs/visual-reports.md): screenshot privacy, safe mode, and
  advanced `explore` options.
- [Roadmap](docs/roadmap.md): planned Lighthouse, watch mode, dashboard, and
  remediation improvements.
- [IDE feedback](docs/ide-integration.md): how to use existing ESLint IDE
  integrations for inline accessibility hints.
- [Evidence methodology](docs/evidence-methodology.md): confidence scoring,
  issue categories, false-positive review, and metrics definitions.
- [Empirical validation](docs/empirical-validation.md): baseline vs
  intervention study design and analysis commands.
- [Adoption strategy](docs/adoption-strategy.md): npm scripts, generated CI,
  future GitHub Action wrapper, docs-site plan, and outreach ideas.
- [AI suggestions plan](docs/ai-suggestions.md): future optional
  `@a11y-shiftleft/ai` package.

## Local Demo

This repository also includes a React/Vite demo with intentional accessibility
defects.

```bash
nvm use
npm install
npm run demo -- --port 3000
```

In another terminal:

```bash
nvm use
export APP_URL=http://localhost:3000
node bin/cli.js check --dynamic --url $APP_URL --out reports
```

## Release Notes

Latest release:

- [v0.5.2](docs/release-notes-v0.5.2.md)

Previous releases:

- [v0.5.1](docs/release-notes-v0.5.1.md)
- [v0.5.0](docs/release-notes-v0.5.0.md)
- [v0.4.0](docs/release-notes-v0.4.0.md)
