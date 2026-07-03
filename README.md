# a11y-shiftleft-cli

[![Quality](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml)
[![Accessibility Shift-Left](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml)
[![npm version](https://img.shields.io/npm/v/a11y-shiftleft-cli.svg)](https://www.npmjs.com/package/a11y-shiftleft-cli)

[Install from npm](https://www.npmjs.com/package/a11y-shiftleft-cli):
`npm install --save-dev a11y-shiftleft-cli`

Visual accessibility audit reports for web apps.

`a11y-shiftleft-cli` runs accessibility checks against a local or preview URL and
creates a visual HTML report with screenshots, WCAG metadata, keyboard evidence,
user-impact labels, and fix guidance.

Browser checks work with any rendered web app or website. Source checks are
currently optimized for React, Vue, and Angular through optional adapters.

## Quick Start

Use this when your app already runs locally.

1. Install the CLI and the Chromium browser used by Playwright:

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
```

2. Start your app in another terminal:

```bash
npm run dev
```

3. Run your first visual audit. Replace the URL with the one printed by your dev
   server:

```bash
npx a11y-shiftleft-cli audit --url http://localhost:5173 --out reports --open
```

4. If the report does not open automatically:

```bash
open reports/a11y-report.html
```

On Linux use `xdg-open reports/a11y-report.html`. On Windows PowerShell use
`start reports/a11y-report.html`.

The audit writes screenshots while browser exploration is running. The combined
HTML report is created after exploration, keyboard checks, and report processing
finish. Wait for the terminal to print the final `Open:` path before reviewing
the report.

<details>
<summary>Common local development URLs</summary>

| Framework / Tool | Default URL |
|---|---|
| Vite (React, Vue, Svelte) | `http://localhost:5173` |
| Next.js | `http://localhost:3000` |
| Create React App | `http://localhost:3000` |
| Angular CLI | `http://localhost:4200` |
| Astro | `http://localhost:4321` |
| Webpack Dev Server | `http://localhost:8080` |

When in doubt, use the URL printed by `npm run dev`.

</details>

## What You Get

- A visual HTML report with annotated screenshots.
- WCAG A/AA metadata, severity, confidence, and user-impact labels.
- Fix guidance for common issues, including contrast ratios and color options.
- Keyboard evidence and manual-review tasks for checks automation cannot finish.
- JSON and Markdown outputs for CI, pull requests, and integrations.

## See The Visual Report

The `audit` command creates one local visual HTML report with summary metrics,
quick triage, screenshots, WCAG metadata, keyboard evidence, manual review
steps, and fix recommendations. It safely discovers UI states, including opened
dialogs with annotated accessibility findings.

[![Demo audit report showing summary metrics, quick review, and evaluation scope](docs/assets/demo-report-overview.png)](docs/assets/demo-report-overview.png)

[![Demo audit report showing explored UI states, screenshots, WCAG labels, and collapsed fix guidance](docs/assets/demo-report-states.png)](docs/assets/demo-report-states.png)

## Which Command Should I Use?

Start with `audit`. Use `check` later when you need a faster CI/PR gate without
visual screenshots.

| Need | Command |
|---|---|
| First local review | `npx a11y-shiftleft-cli audit --url http://localhost:5173 --out reports --open` |
| Fast CI or PR check | `npx a11y-shiftleft-cli check --dynamic --url http://localhost:5173 --out reports` |
| Diagnose setup problems | `npx a11y-shiftleft-cli doctor --url http://localhost:5173` |
| Add config and report paths to `.gitignore` | `npx a11y-shiftleft-cli init --framework auto --gitignore` |
| Generate GitHub Actions workflow files | `npx a11y-shiftleft-cli ci --url http://localhost:5173 --start-command "npm run dev"` |

If the first audit fails, run:

```bash
npx a11y-shiftleft-cli doctor --url http://localhost:5173
```

## Report Files

The default audit stays compact:

```txt
reports/a11y-report.html
reports/a11y-report.json
reports/a11y-comment.md
reports/evaluation-scope.json
reports/screenshots/
```

Generated reports usually should not be committed. Run this once to add common
report directories to `.gitignore`:

```bash
npx a11y-shiftleft-cli init --framework auto --gitignore
```

For private apps, use `--no-screenshots` when screenshots could capture
personal data, logins, or payment information:

```bash
npx a11y-shiftleft-cli audit --url http://localhost:5173 --out reports --no-screenshots
```

## Built On Trusted Tools

The CLI combines established open-source tools instead of replacing their rule
engines:

- [axe-core through `@axe-core/playwright`](https://www.npmjs.com/package/@axe-core/playwright)
  runs automated accessibility rules against the rendered page.
- [Playwright](https://playwright.dev/) drives Chromium, explores bounded UI
  states, captures screenshots, and collects keyboard and accessibility-tree
  evidence.
- [ESLint](https://eslint.org/) powers optional source checks for React, Vue,
  and Angular.
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) can be
  enabled with `--with-lighthouse` when teams want its familiar accessibility
  score alongside detailed findings.

<details>
<summary>More copy-paste commands</summary>

Use a URL shortcut if you do not want to repeat the URL:

```bash
export APP_URL=http://localhost:5173
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open
```

In Windows PowerShell:

```powershell
$env:APP_URL = "http://localhost:5173"
npx a11y-shiftleft-cli audit --url $env:APP_URL --out reports --open
```

Audit options:

| Goal | Command |
|---|---|
| Audit a slower app | `npx a11y-shiftleft-cli audit --url $APP_URL --wait-ms 1000 --out reports` |
| Show only WCAG-mapped findings | `npx a11y-shiftleft-cli audit --url $APP_URL --wcag-only --out reports` |
| Add Lighthouse score | `npm install --save-dev lighthouse && npx a11y-shiftleft-cli audit --url $APP_URL --with-lighthouse --out reports` |
| Add CSV and PDF exports | `npx a11y-shiftleft-cli audit --url $APP_URL --out reports --excel --pdf` |

CI and machine-readable checks:

| Goal | Command |
|---|---|
| Static source checks only | `npx a11y-shiftleft-cli check --static --out reports` |
| Scan several known pages | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL $APP_URL/settings $APP_URL/checkout --out reports` |
| Discover same-origin pages | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --crawl --crawl-depth 1 --crawl-limit 10 --out reports` |
| Compare only new findings | `npx a11y-shiftleft-cli check --url $APP_URL --baseline --out reports` |

Advanced tools:

| Goal | Command |
|---|---|
| Explore visual UI states only | `npx a11y-shiftleft-cli explore --url $APP_URL --depth 2 --out reports` |
| Audit only keyboard focus | `npx a11y-shiftleft-cli keyboard --url $APP_URL --out reports/keyboard` |
| Generate a VoiceOver smoke checklist | `npx a11y-shiftleft-cli screen-reader --profile voiceover --url $APP_URL --out reports/screen-reader` |
| Refresh reports while coding | `npx a11y-shiftleft-cli watch --url $APP_URL --out reports/watch` |
| View saved run trends | `npx a11y-shiftleft-cli dashboard --reports reports` |
| Create ticket drafts | `npx a11y-shiftleft-cli ticket export --report reports/a11y-report.json --out reports/tickets.md` |

</details>

<details>
<summary>How to read the report</summary>

After an audit, start with `reports/a11y-report.html`. It combines visual states,
annotated screenshots, severity and WCAG metadata, fix recommendations, keyboard
evidence, user-impact labels, and manual checks that automation cannot complete.

Each finding is labeled as a `WCAG violation`, `best practice`, or
`unmapped review`. Reports group repeated occurrences, mark known third-party
embeds, call out human-verification blockers, and separate automated evidence
from manual review tasks.

| File | Use it for | Commit it? |
|---|---|---|
| `reports/a11y-report.html` | Primary visual review | Usually no |
| `reports/a11y-comment.md` | Human review and PR comments | Usually no |
| `reports/a11y-report.json` | Automation, debugging, integrations | Usually no |
| `reports/evaluation-scope.json` | Reproducibility scope inspired by WCAG-EM | Usually no |
| `reports/screenshots/` | Screenshots from visual exploration | No |
| `reports/a11y-report.pdf` | Optional portable report from `audit --pdf` | Usually no |
| `.a11y-shiftleft.json` | Shared project config | Usually yes |
| `.a11y-baseline.json` | Accepted known findings | Yes, when using baseline mode |
| `a11y-ignore.json` | Temporary reviewed exceptions | Yes, when intentionally used |

Severity answers: "How risky is this finding?"

Confidence answers: "How strong is the tool evidence?"

User impact answers: "Who is likely affected in practice?"

For `color-contrast` findings, JSON, Markdown, and visual reports include the
measured and required ratios, text and background colors, font metadata, and
deterministic color suggestions.

</details>

## Coverage And Limits

Automated reports do not certify full WCAG, ADA, or Section 508 conformance. Use
them with manual keyboard review, screen-reader checks, content review, and your
organization's compliance process.

Some public websites may block automated scans with bot detection, CAPTCHA, IP
rules, or security middleware. Embedded third-party content such as YouTube,
Vimeo, Spotify, Google Maps, and CodePen is marked separately when ownership can
be detected.

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
node bin/cli.js audit --url http://localhost:5173 --out reports
```

## Documentation

- [FAQ](docs/faq.md)
- [Recipes](docs/recipes/index.md)
- [Configuration](docs/configuration.md)
- [Visual reports](docs/visual-reports.md)
- [Report sharing and privacy](docs/report-sharing.md)
- [Keyboard focus audit](docs/keyboard-audit.md)
- [WCAG 2.2 coverage](docs/wcag-coverage.md)
- [Evidence methodology](docs/evidence-methodology.md)
- [Roadmap](docs/roadmap.md)
- [Contributing](CONTRIBUTING.md)
