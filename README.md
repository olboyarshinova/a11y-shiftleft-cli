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
  explore
  ci

Adapters
  eslintAdapter
  axePlaywrightAdapter
  explorePlaywrightAdapter

Core Engine
  normalize
  wcagMap
  severity
  dedupe

Reporters
  a11y-report.json
  a11y-metrics.csv
  a11y-comment.md
  exploration-graph.json
  screenshots/
```

## Source And Runtime

The project source is written in TypeScript under `src/`. The npm CLI runs the
compiled JavaScript and declaration files from `dist/`, while `bin/cli.js`
remains a small executable entrypoint for package consumers.

## Use In Any Project

Install the CLI from [npm](https://www.npmjs.com/package/a11y-shiftleft-cli)
in the project you want to scan:

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init --framework react
```

Use `--framework angular`, `--framework vue`, or `--framework auto` for other
projects. The selected framework is stored in `.a11y-shiftleft.json`.

Framework-specific static checks are lazy-loaded. Install only the adapter
dependencies your project needs:

```bash
npx a11y-shiftleft adapter add react
npm install --save-dev @a11y-shiftleft/react      # React
npm install --save-dev @a11y-shiftleft/vue        # Vue
npm install --save-dev @a11y-shiftleft/angular    # Angular
```

Check that the local setup is ready:

```bash
npx a11y-shiftleft doctor
```

Start your app in another terminal:

```bash
npm run dev
```

Then verify that the app URL is reachable:

```bash
npx a11y-shiftleft doctor --url http://localhost:3000
```

Run a dynamic scan against the app URL:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:3000 --out reports
```

Explore UI states without writing scenarios:

```bash
npx a11y-shiftleft explore --url http://localhost:3000 --depth 2 --out reports
```

`explore` opens the start URL, scans it with axe, then safely follows
same-origin links and low-risk UI expansion controls such as menu buttons,
tabs, disclosure widgets, and modal triggers. It saves:

- `reports/a11y-report.json`
- `reports/a11y-comment.md`
- `reports/exploration-graph.json`
- `reports/screenshots/state-*.png`

Safe mode skips submit/reset buttons, form buttons without an explicit safe
marker, external links, and actions whose labels look destructive or
transactional, such as delete, logout, save, checkout, or payment. Add
`data-a11y-skip` to any element that should never be clicked during automated
exploration. Add `data-a11y-explore` only when a form button or custom control
is safe to exercise in automated scans.

Short setup recipes are available for common workflows:

- [Angular](docs/recipes/angular.md)
- [React/Vite](docs/recipes/react-vite.md)
- [Vue/Vite](docs/recipes/vue-vite.md)
- [Next.js](docs/recipes/nextjs.md)
- [GitHub Actions](docs/recipes/github-actions.md)
- [ADA Title II](docs/recipes/ada-title-ii.md)
- [Section 508](docs/recipes/section-508.md)

Scan several known routes in one run:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url http://localhost:3000 http://localhost:3000/favorites http://localhost:3000/settings \
  --out reports
```

You can also separate URLs with commas:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url http://localhost:3000,http://localhost:3000/favorites,http://localhost:3000/settings \
  --out reports
```

For repeated project scans, store routes in `.a11y-shiftleft.json`:

```json
{
  "dynamic": {
    "enabled": true,
    "urls": [
      "http://localhost:3000",
      "http://localhost:3000/favorites",
      "http://localhost:3000/settings"
    ]
  }
}
```

Then run:

```bash
npx a11y-shiftleft check --dynamic --out reports
```

If a scan fails because of Node, Playwright, Chromium, config, or app startup
issues, run:

```bash
npx a11y-shiftleft doctor --url http://localhost:3000
```

Discover and scan same-origin pages from a starting URL:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url http://localhost:3000 \
  --crawl \
  --crawl-depth 1 \
  --crawl-limit 10 \
  --out reports
```

Write specific report formats:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url http://localhost:3000 \
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
npx a11y-shiftleft check --url http://localhost:3000 --out reports
```

Filter findings to criteria included in WCAG Level AA conformance:

```bash
npx a11y-shiftleft check --url http://localhost:3000 --wcag-filter AA --out reports
```

Limit mapped findings to a specific WCAG version:

```bash
npx a11y-shiftleft check --url http://localhost:3000 --wcag-version 2.0 --out reports
```

Use a WCAG-based compliance support preset:

```bash
npx a11y-shiftleft check --url http://localhost:3000 --standard section508 --out reports
npx a11y-shiftleft check --url http://localhost:3000 --standard ada-title-ii --out reports
npx a11y-shiftleft check --url http://localhost:3000 --standard wcag22-aa --out reports
```

The presets configure report metadata and WCAG filtering defaults. Mapped
findings are limited to the selected WCAG version and Level AA target, while
unmapped best-practice findings remain visible in a separate report section.

| Preset | Report meaning | WCAG target |
|---|---|---|
| `section508` | Section 508 web accessibility support mode | WCAG 2.0 AA |
| `ada-title-ii` | ADA Title II web accessibility support mode | WCAG 2.1 AA |
| `wcag22-aa` | WCAG 2.2 Level AA support mode | WCAG 2.2 AA |

Generate a semi-automated manual review checklist alongside automated reports:

```bash
npx a11y-shiftleft check --url http://localhost:3000 --semi-auto --out reports
```

## Scan A Different Directory

Useful for monorepos or local testing:

```bash
npx a11y-shiftleft check \
  --cwd ./apps/web \
  --dynamic \
  --url http://localhost:3000 \
  --out reports
```

## Generate CI

```bash
npx a11y-shiftleft ci \
  --url http://localhost:3000 \
  --start-command "npm run dev -- --host localhost --port 3000" \
  --fail-on critical \
  --standard wcag22-aa
```

Generate CI for a known route set and a compliance-support preset:

```bash
npx a11y-shiftleft ci \
  --url http://localhost:4200 http://localhost:4200/favorites http://localhost:4200/settings \
  --start-command "npm run dev -- --host localhost --port 4200" \
  --fail-on warning \
  --standard section508
```

This creates:

```txt
.github/workflows/a11y.yml
```

## IDE Feedback

The package does not include a custom IDE extension. For editor highlighting,
use your IDE's ESLint integration with accessibility lint rules enabled. The CLI
is the repository-level orchestration layer for CI reports, dynamic scans,
deduplication, and metrics.

See [docs/ide-integration.md](docs/ide-integration.md) for a React setup.

## Research Protocol

See [docs/empirical-validation.md](docs/empirical-validation.md) for the
baseline vs intervention study design, metrics, statistical tests, and data
collection template. See
[docs/research-paper-outline.md](docs/research-paper-outline.md) for the IMRaD
paper/capstone outline.

Run the sample analysis:

```bash
npm run analyze:metrics -- data/sample-pr-metrics.csv
npm run analyze:metrics -- data/sample-pr-metrics.csv --out analysis/summary.json
```

Collect public adoption telemetry for evidence snapshots:

```bash
npm run collect:adoption -- --out analysis/adoption.json
```

Set `GITHUB_TOKEN` to include GitHub traffic data such as views, clones, and
referrers:

```bash
GITHUB_TOKEN=<github-token> npm run collect:adoption -- --out analysis/adoption.json
```

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
can identify them:

```json
{
  "ruleId": "color-contrast",
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
| `standard` | Selected WCAG-based support preset and compliance note metadata |
| `complianceEvidence` | Evidence summary for WCAG-mapped findings, unmapped findings, affected pages, and manual-review status |
| `bySource` | Finding counts by adapter, such as `axe` or `eslint` |
| `bySeverity` | Finding counts by severity |
| `byPour` | Finding counts grouped by WCAG POUR principle |
| `byWcagLevel` | Finding counts grouped by WCAG conformance level |
| `byWcagVersion` | Finding counts grouped by WCAG version introduced |
| `byUnmappedRule` | Finding counts for useful rules that do not map directly to WCAG criteria |
| `byPage` | Page-level ranking by total findings and severity score |
| `framework` | Detected or configured framework |
| `urls` | Dynamic scan target URLs, including discovered crawl URLs |

Each finding can include remediation metadata with a short fix summary,
documentation links, and framework-specific examples for common React, Vue, and
Angular rules. These hints are included in JSON output and surfaced in the
Markdown PR comment for the top findings.

Some axe and ESLint rules are best-practice checks rather than direct WCAG
success-criterion mappings, such as page heading and landmark checks. The report
keeps those findings visible under `byUnmappedRule` instead of forcing a false
WCAG mapping.

When dynamic scans include URLs, reports also include a page risk ranking. The
score weights `critical` as 5, `warning` as 2, and `info` as 1 so teams can
prioritize the highest-risk pages first.

## Adoption Metrics

The project can collect adoption evidence snapshots for npm and GitHub:

```bash
npm run collect:adoption -- \
  --package a11y-shiftleft-cli \
  --repo olboyarshinova/a11y-shiftleft-cli \
  --period last-month \
  --out analysis/adoption.json
```

The npm downloads API reports download counts, but it does not expose country
or person-level data. Treat npm downloads as ecosystem activity because they can
include humans, CI systems, package mirrors, security scanners, and bots. Use
GitHub unique views/clones and referrers as stronger human-adoption signals.

If you also record the visible download count from the npm package page, store
it as a separate website snapshot so it is not mixed with API periods:

```bash
npm run collect:adoption -- \
  --package a11y-shiftleft-cli \
  --period last-month \
  --npm-website-downloads 586 \
  --npm-website-captured-at 2026-06-07 \
  --out analysis/adoption-cli.json
```

To collect one snapshot across the CLI and framework adapter packages:

```bash
npm run collect:adoption:snapshot -- \
  --period last-month \
  --out analysis/adoption-snapshot.json
```

The scheduled `Adoption Snapshot` GitHub Actions workflow runs weekly and
uploads this JSON as a workflow artifact. It does not rewrite the README
automatically, so public docs stay stable while evidence snapshots remain
reproducible.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for planned improvements such as
Lighthouse score collection, broader remediation coverage, stronger Vue/Angular
static coverage, and WCAG-based compliance-support presets for ADA Title II and
Section 508 workflows.

See [docs/adoption-strategy.md](docs/adoption-strategy.md) for the adoption
plan covering npm scripts, generated GitHub Actions workflows, future
Marketplace Action support, documentation-site priorities, and outreach targets.

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

This project does not claim to prove full WCAG, ADA, or Section 508 conformance.
Automated tools only catch part of accessibility defects and should be combined
with manual review, keyboard testing, screen reader testing, and organizational
compliance review.

Current compliance-support presets align scans and report metadata with
WCAG-based workflows, such as ADA Title II using WCAG 2.1 A/AA and Section 508
using WCAG 2.0 A/AA. They support evidence collection and remediation tracking,
not legal certification.

Current non-goals:

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
| Angular static scan | Working fallback via `@angular-eslint/eslint-plugin-template` accessibility rules |

Framework static adapters are lazy-loaded and represented as optional peer
dependencies. This keeps the CLI path framework-aware today and prepares the
framework adapter packages `@a11y-shiftleft/react`, `@a11y-shiftleft/vue`, and
`@a11y-shiftleft/angular`.

Use `npx a11y-shiftleft adapter list` or
`npx a11y-shiftleft adapter add <framework>` to print the recommended adapter
dependencies for a project.

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
node bin/cli.js check --dynamic --url http://localhost:3000 --out reports
```

## Release Verification

For release checks, run:

```bash
npm test
npm run test:fixtures
npm run build:demo
npm_config_cache=.npm-cache npm pack --dry-run
npm_config_cache=.npm-cache npm pack --workspace @a11y-shiftleft/react --dry-run --ignore-scripts
npm_config_cache=.npm-cache npm pack --workspace @a11y-shiftleft/vue --dry-run --ignore-scripts
npm_config_cache=.npm-cache npm pack --workspace @a11y-shiftleft/angular --dry-run --ignore-scripts
```

See [docs/release-checklist.md](docs/release-checklist.md) for the full release
checklist.

Latest release:

- [v0.4.0](docs/release-notes-v0.4.0.md)
