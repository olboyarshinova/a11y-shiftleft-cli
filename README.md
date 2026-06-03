# a11y-shiftleft-cli

[![Quality](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml)
[![Accessibility Shift-Left](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml)
[![npm version](https://img.shields.io/npm/v/a11y-shiftleft-cli.svg)](https://www.npmjs.com/package/a11y-shiftleft-cli)

Framework-agnostic CLI orchestrator for shift-left accessibility validation.

The CLI is designed to run inside any web project. It combines dynamic axe scans,
static accessibility checks where supported, finding normalization,
deduplication, severity triage, and CI-friendly reporting.

## Why This Exists

Accessibility teams already have strong tools such as axe-core, Lighthouse,
WAVE, Pa11y, and eslint-plugin-jsx-a11y. This project is not trying to replace
them.

`a11y-shiftleft-cli` is an orchestration layer for development workflows. It
coordinates static and dynamic checks, normalizes findings into one schema,
deduplicates overlapping warnings, applies a consistent severity policy, and
exports reproducible metrics for CI, PR review, and empirical evaluation.

## Architecture

```txt
Target Project
  package.json
  .a11y-shiftleft.json
  running app URL

CLI
  init
  check
  ci

Adapters
  eslintAdapter
  axePlaywrightAdapter

Core Engine
  normalize
  wcagMap
  severity
  dedupe

Reporters
  a11y-report.json
  a11y-metrics.csv
  a11y-comment.md
```

## Use In Any Project

Install the CLI from [npm](https://www.npmjs.com/package/a11y-shiftleft-cli)
in the project you want to scan:

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init
```

Start your app in another terminal:

```bash
npm run dev
```

Run a dynamic scan against the app URL:

```bash
npx a11y-shiftleft check --dynamic --url http://127.0.0.1:3000 --out reports
```

Write specific report formats:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url http://127.0.0.1:3000 \
  --format json csv \
  --out reports
```

Run static checks where supported:

```bash
npx a11y-shiftleft check --static --framework react --out reports
```

Vue projects can use the basic fallback scanner too:

```bash
npx a11y-shiftleft check --static --framework vue --include "src/**/*.vue" --out reports
```

Limit static checks to specific files:

```bash
npx a11y-shiftleft check \
  --static \
  --framework react \
  --include "src/**/*.{js,jsx,ts,tsx}" \
  --out reports
```

Run both static and dynamic checks:

```bash
npx a11y-shiftleft check --url http://127.0.0.1:3000 --out reports
```

## Scan A Different Directory

Useful for monorepos or local testing:

```bash
npx a11y-shiftleft check \
  --cwd ./apps/web \
  --dynamic \
  --url http://127.0.0.1:3000 \
  --out reports
```

## Generate CI

```bash
npx a11y-shiftleft ci \
  --url http://127.0.0.1:3000 \
  --start-command "npm run dev -- --host 127.0.0.1 --port 3000" \
  --fail-on critical
```

This creates:

```txt
.github/workflows/a11y.yml
```

## IDE Feedback

The MVP does not include a custom IDE extension. For editor highlighting, use
your IDE's ESLint integration with accessibility lint rules enabled. The CLI is
the repository-level orchestration layer for CI reports, dynamic scans,
deduplication, and metrics.

See [docs/ide-integration.md](docs/ide-integration.md) for a React setup.

## Research Protocol

See [docs/empirical-validation.md](docs/empirical-validation.md) for the
baseline vs intervention study design, metrics, statistical tests, and data
collection template.

## Outputs

```txt
reports/a11y-report.json
reports/a11y-metrics.csv
reports/a11y-comment.md
```

## Reproducible Fixtures

The repository includes small intentionally flawed projects under
`examples/fixtures` for repeatable scanner validation:

```txt
examples/fixtures/react
examples/fixtures/vue
examples/fixtures/angular
```

Run the fixture smoke test:

```bash
npm run test:fixtures
```

## Metrics

Each run exports machine-readable metrics for CI and empirical analysis:

| Metric | Meaning |
|---|---|
| `rawCount` | Findings before deduplication |
| `uniqueCount` | Findings after deduplication |
| `duplicateCount` | Removed duplicate findings |
| `duplicateRate` | `duplicateCount / rawCount` |
| `critical`, `warning`, `info` | Severity counts |
| `scanDurationMs` | Runtime duration for the scan |
| `bySource` | Finding counts by adapter, such as `axe` or `eslint` |
| `bySeverity` | Finding counts by severity |
| `framework` | Detected or configured framework |
| `urls` | Dynamic scan target URLs |

## Competitive Positioning

| Tool | Best For | Gap This Project Targets |
|---|---|---|
| axe-core | Accessibility rules engine used by many integrations | Engine-level API, not a full PR metrics and orchestration workflow |
| @axe-core/playwright | Dynamic checks inside Playwright tests | Requires test code and does not merge static findings by default |
| Lighthouse | Quick page quality audits across performance, SEO, best practices, and accessibility | Score-oriented page audit, not static/dynamic correlation or PR dataset generation |
| WAVE | Visual review and manual inspection support | Browser/manual workflow, not npm-first CI orchestration |
| Pa11y | CLI accessibility scans for URLs | Strong page scanner, but not focused on static+dynamic dedupe and longitudinal metrics |
| eslint-plugin-jsx-a11y | React JSX static accessibility linting | Static React-only layer; cannot inspect rendered DOM states |
| wick-a11y | Cypress accessibility plugin with rich Cypress reports | Cypress-specific workflow rather than framework-agnostic CLI orchestration |

## Non-Goals

This project does not claim to prove full WCAG conformance. Automated tools only
catch part of accessibility defects and should be combined with manual review and
assistive technology testing.

Current MVP non-goals:

```txt
custom AST parsers
machine-learning triage
browser extension
SaaS dashboard
legal compliance certification
```

## Current Adapter Support

| Adapter | Status |
|---|---|
| Dynamic axe scan | Working for any reachable web URL |
| React static scan | Working fallback via `eslint-plugin-jsx-a11y` |
| Vue static scan | Basic fallback via `eslint-plugin-vue` template rules |
| Angular static scan | Uses the target project's ESLint setup; dedicated template fallback planned |

Dynamic scanning is the portable baseline: any React, Vue, Angular, Svelte,
Next.js, Nuxt, Astro, Rails, Django, or static HTML app can be scanned if it is
running at a URL.

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
node bin/cli.js check --dynamic --url http://127.0.0.1:3000 --out reports
```

## Release Readiness

Before publishing a public MVP, run:

```bash
npm test
npm run build:demo
npm_config_cache=.npm-cache npm pack --dry-run
```

See [docs/release-checklist.md](docs/release-checklist.md) for the full release
checklist.

Draft release notes are available in
[docs/release-notes-v0.1.0.md](docs/release-notes-v0.1.0.md).
