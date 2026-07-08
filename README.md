# a11y-shiftleft-cli

[![Quality](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml)
[![Accessibility Shift-Left](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml)
[![npm version](https://img.shields.io/npm/v/a11y-shiftleft-cli.svg)](https://www.npmjs.com/package/a11y-shiftleft-cli)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org/)

Catch accessibility issues while you code, not after release.

`a11y-shiftleft-cli` is a local-first, shift-left accessibility audit tool for
frontend developers who are not accessibility specialists. Run one command
against a local, staging, or preview URL, and it will open your app in a
browser, safely explore UI states, check for WCAG-oriented issues, and generate
a visual HTML report with screenshots, keyboard evidence, and practical fix
guidance.

Use it locally during development or add it to CI/CD so pull requests get
repeatable accessibility feedback before issues reach production.

It works with any rendered web app or website, including React, Vue, Angular,
Next.js, Svelte, Astro, Rails, Django, and static HTML. Optional source-code
adapters add framework-aware checks for React, Vue, and Angular.

## Built On Known Tools

The CLI orchestrates established accessibility tooling instead of replacing
their rule engines:

- axe-core through [`@axe-core/playwright`](https://www.npmjs.com/package/@axe-core/playwright)
  scans the rendered page for automated accessibility rules.
- [Playwright](https://playwright.dev/) opens Chromium, explores bounded UI
  states, captures screenshots, and records keyboard evidence.
- [ESLint](https://eslint.org/) powers optional source checks for React, Vue,
  and Angular.
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) can be
  added with `--with-lighthouse` when teams want its familiar accessibility
  score next to detailed findings.

## 2-Minute Quick Start

Use this when your app already runs locally. You need Node.js 18 or newer, but
you do not need to configure a framework first.

1. Install the CLI and the Chromium browser used by Playwright:

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
```

2. Start your app in another terminal:

```bash
npm run dev
```

3. Run your first visual audit. Replace `YOUR_PORT` with the port printed by
   your dev server:

```bash
export APP_URL=http://localhost:YOUR_PORT
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open
```

4. If the report does not open automatically:

```bash
open reports/a11y-report.html
```

On Linux use `xdg-open reports/a11y-report.html`. On Windows PowerShell use
`start reports/a11y-report.html`.

The command saves screenshots while it runs. Wait for the terminal to print the
final `Open:` path before reviewing the report.

Privacy note: reports stay local by default. Screenshots mask common sensitive
fields such as passwords, emails, phone numbers, payment inputs, and elements
marked with `data-a11y-sensitive`. Use `--no-screenshots` for private,
authenticated, or production customer pages.

Local-first by default: the CLI runs in your project environment and does not
upload source code, screenshots, URLs, or report data to an external analysis
server.

## Add CI/CD

After the first local audit works, generate GitHub Actions workflow files:

```bash
npx a11y-shiftleft-cli ci --url $APP_URL --start-command "npm run dev"
```

This creates a pull-request workflow that installs the project, starts your app,
runs accessibility checks, and keeps the generated reports as CI artifacts. Use
this path when you want report-only adoption first, then tighten the quality
gate later.

Copy-paste CI examples are available for
[GitHub Actions](docs/recipes/github-actions.md) and
[GitLab CI](docs/recipes/gitlab-ci.md).

For an existing pipeline, the smallest integration is one npm script:

```json
{
  "scripts": {
    "test:a11y": "a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports"
  }
}
```

## Optional Framework Adapters

You do not need an adapter for the visual browser audit. `audit` and dynamic
`check` run against any rendered URL.

Adapters add source-code checks on top of the browser audit. Install only the
adapter for the framework your project uses:

| Project | Optional adapter | What it adds |
|---|---|---|
| React / Next.js | `@a11y-shiftleft/react` | JSX/TSX accessibility lint rules |
| Vue | `@a11y-shiftleft/vue` | Vue template accessibility lint support |
| Angular | `@a11y-shiftleft/angular` | Angular template accessibility lint support |

```bash
npm install --save-dev @a11y-shiftleft/react
npm install --save-dev @a11y-shiftleft/vue
npm install --save-dev @a11y-shiftleft/angular
```

If you are not sure, skip adapters first and run the browser audit. Add an
adapter later when you want static source findings in the same report.

## What You Get

- A local visual HTML report you can open in your browser.
- Annotated screenshots that show where issues were found.
- WCAG A/AA labels, severity, confidence, and user-impact hints.
- Fix guidance, including contrast ratios and color suggestions.
- Separate `needs review` findings when axe cannot prove a result automatically,
  such as text over images, gradients, video, or complex overlays.
- Keyboard evidence and manual-review tasks for things automation cannot prove.

## See The Visual Report

This is the main output of `audit`:

<a href="docs/assets/demo-report-overview.png">
  <img src="docs/assets/demo-report-overview.png" width="720" alt="Demo audit report showing summary metrics and quick review">
</a>

<a href="docs/assets/demo-report-coverage.png">
  <img src="docs/assets/demo-report-coverage.png" width="720" alt="Demo audit report showing the audit coverage table with automated and manual review checks">
</a>

<a href="docs/assets/demo-report-states.png">
  <img src="docs/assets/demo-report-states.png" width="720" alt="Demo audit report showing explored UI states, screenshots, WCAG labels, and collapsed fix guidance">
</a>

## Common Commands

Start with `audit`. Use `check` later for faster CI/PR checks.
The commands below assume `APP_URL` is set to your local, staging, or preview
URL.

| Need | Command |
|---|---|
| First local review | `npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open` |
| Quick risk triage | `npx a11y-shiftleft-cli audit --url $APP_URL --profile risk --out reports` |
| Broader local scan | `npx a11y-shiftleft-cli audit --url $APP_URL --max-depth 3 --limit 50 --out reports` |
| Check one component or page area | `npx a11y-shiftleft-cli audit --url $APP_URL --scope '#main' --out reports` |
| Hide noisy overlays | `npx a11y-shiftleft-cli audit --url $APP_URL --hide-elements ".cookie-banner,.chat-widget" --out reports` |
| Check a mobile browser profile | `npx a11y-shiftleft-cli audit --url $APP_URL --browser webkit --mobile --out reports` |
| Check a tablet browser profile | `npx a11y-shiftleft-cli audit --url $APP_URL --browser webkit --tablet --out reports` |
| Fuller evidence package | `npx a11y-shiftleft-cli audit --url $APP_URL --profile full --out reports` |
| Fast CI or PR check | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports` |
| Save current findings as an accepted baseline | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --update-baseline --out reports` |
| Fail only on new findings | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --baseline --out reports` |
| Legacy-project CI gate | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --gate new-critical-only --out reports` |
| Diagnose setup problems | `npx a11y-shiftleft-cli doctor --url $APP_URL` |
| Add config and report paths to `.gitignore` | `npx a11y-shiftleft-cli init --framework auto --gitignore` |
| Generate GitHub Actions workflow files | `npx a11y-shiftleft-cli ci --url $APP_URL --start-command "npm run dev"` |

Use `explore` only when you want to debug visual state discovery without the full
audit workflow.

Use baseline mode when an existing project already has known findings. First
save the current state with `--update-baseline`, commit `.a11y-baseline.json`,
then run later checks with `--baseline` so CI focuses on new regressions.

By default, `audit` explores up to 2 interaction levels from the start page.
`--max-depth` lets you change that safety limit; it does not mean "scan forever"
or "visit every possible page."

The audit automatically explores safe links, buttons, dialogs, forms, theme
states, and same-origin UI transitions within bounded depth and state limits.
It is designed to find issues earlier, not to certify that every page and every
WCAG criterion has been fully tested.

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --profile risk --out reports
npx a11y-shiftleft-cli audit --url $APP_URL --max-depth 1 --out reports
npx a11y-shiftleft-cli audit --url $APP_URL --max-depth 3 --limit 50 --out reports
npx a11y-shiftleft-cli audit --url $APP_URL --scope '#checkout' --out reports
```

Use `1` for a quick smoke test, the default `2` for most local reviews, and `3`
or more only when you intentionally want a broader scan.

Use `--scope <selector>` when you want browser checks and safe UI-state
exploration to stay inside one component, dialog, checkout step, or page
section.

Use `--hide-elements <selectors>` when cookie banners, sticky ads, chat widgets,
or other non-product overlays make screenshots noisy. Hidden selectors are
recorded in the visual and Markdown reports.

Use `--browser chromium|firefox|webkit` when you need evidence from another
browser engine. Use `--mobile` for the default phone profile, `--tablet` for the
default tablet profile, or `--device "<Playwright device>"` when you need an
exact Playwright preset. Install that browser first, for example:

```bash
npx playwright install webkit
```

Audit profiles are shortcuts:

- `risk`: faster triage with lower depth and fewer explored states.
- `validation`: the standard local evidence profile.
- `full`: broader scan with keyboard activation checks and Lighthouse comparison.
  Install `lighthouse` first when you want this comparison:

```bash
npm install --save-dev lighthouse
```

Explicit flags override profile defaults, for example:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --profile risk --max-depth 2 --out reports
```

If the first audit fails, run:

```bash
npx a11y-shiftleft-cli doctor --url $APP_URL
```

After the report opens:

1. Start with the "Fix First" and screenshot sections.
2. Check the manual-review tasks for keyboard, screen reader, content, and forms.
3. Re-run the same command after fixing issues.

Reports and screenshots usually should not be committed. Run `init --gitignore`
once to add common report paths. For private pages, add `--no-screenshots`.

## Standards

Use `--standard` for the reporting context you need:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --standard wcag22-aa --out reports
npx a11y-shiftleft-cli audit --url $APP_URL --standard section508 --out reports
npx a11y-shiftleft-cli audit --url $APP_URL --standard ada-title-ii --out reports
```

Standards presets adjust labels, evidence guidance, and report context. They do
not certify legal compliance. The CLI intentionally uses standards rather than
country flags because accessibility laws often reference WCAG while adding
different legal scope, procurement, documentation, PDF, mobile, or enforcement
requirements.

## Coverage And Limits

- Automated reports do not certify full WCAG, ADA, or Section 508 conformance.
- Use the report with manual keyboard, screen-reader, content, and task-flow
  review.
- It does not replace a full manual WCAG audit, but helps teams find and
  document issues earlier.
- Some public websites block automated scans with bot detection or CAPTCHA.
- Third-party embeds such as YouTube, Vimeo, Spotify, Google Maps, and CodePen
  are marked separately when ownership can be detected.

<details>
<summary>Run the local demo</summary>

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
npm run build
export APP_URL=http://localhost:YOUR_PORT
node bin/cli.js audit --url $APP_URL --out reports
```

For the demo command above, replace `YOUR_PORT` with `5173`.

</details>

## Learn More

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
