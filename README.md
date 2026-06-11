# a11y-shiftleft-cli

[![Quality](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/quality.yml)
[![Accessibility Shift-Left](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml/badge.svg)](https://github.com/olboyarshinova/a11y-shiftleft-cli/actions/workflows/a11y.yml)
[![npm version](https://img.shields.io/npm/v/a11y-shiftleft-cli.svg)](https://www.npmjs.com/package/a11y-shiftleft-cli)

Framework-agnostic CLI orchestrator for shift-left accessibility validation.

The CLI is designed to run inside any web project. It combines dynamic axe scans,
static accessibility checks where supported, finding normalization,
deduplication, severity triage, confidence scoring, issue categorization, and
CI-friendly reporting.

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
  classification
  dedupe

Reporters
  a11y-report.json
  a11y-metrics.csv
  a11y-comment.md
  exploration.html
  exploration-graph.json
  screenshots/
```

## Source And Runtime

The project source is written in TypeScript under `src/`. The npm CLI runs the
compiled JavaScript and declaration files from `dist/`, while `bin/cli.js`
remains a small executable entrypoint for package consumers.

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

4. Check that the setup and URL are ready:

```bash
npx a11y-shiftleft doctor --url http://localhost:3000
```

5. Run your first accessibility scan:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:3000 --out reports
```

6. Read the terminal summary, then open the generated report files:

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

| Goal | Command |
|---|---|
| Scan one running app URL | `npx a11y-shiftleft check --dynamic --url http://localhost:3000 --out reports` |
| Scan several known pages | `npx a11y-shiftleft check --dynamic --url http://localhost:3000 http://localhost:3000/settings --out reports` |
| Let the CLI discover safe same-origin pages | `npx a11y-shiftleft check --dynamic --url http://localhost:3000 --crawl --crawl-depth 1 --crawl-limit 10 --out reports` |
| Create a visual state report with screenshots | `npx a11y-shiftleft explore --url http://localhost:3000 --depth 2 --out reports` |
| Add a fast PR workflow | `npx a11y-shiftleft ci --url http://localhost:3000 --start-command "npm run dev -- --host localhost --port 3000"` |

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
npx a11y-shiftleft doctor --url http://localhost:3000
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
npx a11y-shiftleft check --url http://localhost:3000 --out reports
```

## What Gets Created

| Path | Purpose | Commit it? |
|---|---|---|
| `.a11y-shiftleft.json` | Project config for framework, WCAG target, URLs, and scan options | Yes |
| `.a11y-baseline.json` | Accepted known findings for baseline mode | Yes, when using `--baseline` |
| `a11y-ignore.json` | Temporary scoped ignores with reason, owner, and expiration | Yes, when intentionally used |
| `reports/a11y-comment.md` | Human-readable report for local review or PR comments | Usually no |
| `reports/a11y-report.json` | Machine-readable findings and evidence | Usually no |
| `reports/a11y-metrics.csv` | Run metrics for trend analysis | Usually no |
| `reports/exploration.html` | Visual state report from `explore` | Usually no |
| `reports/screenshots/` | Generated screenshots from `explore` | No |

`npx a11y-shiftleft init --gitignore` adds common report directories such as
`reports/` and `.a11y-reports/` to `.gitignore`.

Config discovery order:

1. `--config <file>`
2. `.a11y-shiftleft.json`
3. `.a11yrc.json`
4. `package.json` field named `a11y`

Use `.a11y-shiftleft.json` for the clearest generated setup. Use `.a11yrc.json`
or `package.json#a11y` when your project already keeps tool settings in those
places.

## Visual Exploration

Use `explore` when you do not want to list every route manually:

```bash
npx a11y-shiftleft explore --url http://localhost:3000 --depth 2 --out reports
```

`explore` opens the start URL, scans it with axe, then safely follows
same-origin links and low-risk UI expansion controls such as menu buttons,
tabs, disclosure widgets, and modal triggers. It saves:

- `reports/a11y-report.json`
- `reports/a11y-comment.md`
- `reports/exploration.html`
- `reports/exploration-graph.json`
- `reports/screenshots/state-*.jpg`

Open `reports/exploration.html` to review checked states visually. Each state
includes its screenshot, issue summary, top findings, and recorded transitions.
The report also includes skipped actions with reasons, such as submit buttons,
payment links, destructive controls, external links, or project-specific
safe-mode blocklist matches.

A typical visual report is organized like this:

```txt
Accessibility Exploration
States visited: 4 | Screenshots: 4 | Actions tried: 7

State state-1
URL: http://localhost:3000/
Issues: critical 0, warning 2, info 0

[ screenshot preview ]

Top findings:
- warning button-name button.icon-close
- warning page-has-heading-one html

Transitions:
- Click: Open filters -> state-2
- Navigate: Favorites -> state-3

Skipped actions:
- Submit order: blocked by safe mode
- Checkout: matched destructive or transactional action pattern
```

The real HTML report renders this as a local dashboard with summary metrics,
state cards, compressed screenshots, top findings, and navigation/action edges.
Private screenshots are not committed to the repository; they are generated
inside the selected report output directory.

Report lifecycle:

- `check` overwrites `a11y-report.json`, `a11y-metrics.csv`, and
  `a11y-comment.md` in the selected output directory.
- `explore` cleans stale generated artifacts before a new run, including
  `a11y-report.json`, `a11y-comment.md`, `exploration.html`,
  `exploration-graph.json`, and generated state screenshots.
- After fixing an accessibility issue, rerun the same command. The fixed issue
  should disappear from the new report; do not edit old report files by hand.
- Use `--no-clean` only when you intentionally want to keep previous generated
  artifacts for manual comparison.
- Keep generated report directories out of git by running
  `npx a11y-shiftleft init --gitignore`. Commit anonymized sample reports only
  when they are intentionally part of docs, demos, or release evidence.
- Commit `.a11y-baseline.json` when using `--baseline`; it is the accepted
  known-findings file that lets CI block only new accessibility regressions.
- Use report retention when you write timestamped output directories such as
  `reports/run-2026-06-11`. Retention only removes sibling directories that
  contain a11y-shiftleft report marker files and never removes the current
  output directory.

Enable retention from the command line:

```bash
npx a11y-shiftleft explore \
  --url http://localhost:3000 \
  --out reports/run-2026-06-11 \
  --retention-max-runs 5 \
  --retention-max-age-days 14
```

Or keep it in config:

```json
{
  "retention": {
    "enabled": true,
    "maxRuns": 5,
    "maxAgeDays": 14
  }
}
```

Screenshots are compressed by default as viewport JPEG files at quality `70` to
keep reports small:

```bash
npx a11y-shiftleft explore --url http://localhost:3000 --out reports
```

Use PNG or full-page screenshots only when the extra detail is worth the larger
artifact size:

```bash
npx a11y-shiftleft explore \
  --url http://localhost:3000 \
  --screenshot-format png \
  --screenshot-full-page \
  --out reports
```

Sensitive form fields are masked in screenshots by default. The redaction covers
common password, email, phone, token, card, address, and one-time-code inputs, as
well as elements marked with `data-a11y-sensitive`, `data-a11y-redact`, or
`data-private`.

For applications that may expose real personal data, login screens, payment
details, or production customer records, disable screenshots entirely:

```bash
npx a11y-shiftleft explore --url http://localhost:3000 --no-screenshots --out reports
```

If you intentionally need raw local screenshots for debugging, disable masking:

```bash
npx a11y-shiftleft explore \
  --url http://localhost:3000 \
  --no-screenshot-redaction \
  --out reports
```

Safe mode skips submit/reset buttons, form buttons without an explicit safe
marker, external links, and actions whose labels look destructive or
transactional, such as delete, logout, save, checkout, or payment. Add
`data-a11y-skip` to any element that should never be clicked during automated
exploration. Add `data-a11y-explore` only when a form button or custom control
is safe to exercise in automated scans.

You can add project-specific safe-mode rules in `.a11y-shiftleft.json`:

```json
{
  "explore": {
    "safeMode": {
      "blockedText": ["logout", "delete", "pay*", "confirm"],
      "blockedRoles": ["menuitem"],
      "blockedUrls": ["*/checkout*", "*/account/billing*"],
      "blockedSelectors": ["[data-danger]", "[data-payment]"],
      "allowedSelectors": ["[data-a11y-explore]"],
      "dismissDialogs": true
    }
  }
}
```

Safe-mode patterns are case-insensitive strings with optional `*` wildcards.
They are not executable JavaScript regexes.

You can also add one-off rules from the command line:

```bash
npx a11y-shiftleft explore \
  --url http://localhost:3000 \
  --safe-block-text logout delete pay \
  --safe-block-url "*/checkout*" \
  --safe-block-selector "[data-danger]" \
  --out reports
```

Suppress `explore` progress logs and console summary while still writing report
files:

```bash
npx a11y-shiftleft explore --url http://localhost:3000 --quiet --out reports
```

Print exploration limits, screenshot settings, safe-mode settings, and output
formats before progress logs:

```bash
npx a11y-shiftleft explore --url http://localhost:3000 --verbose --out reports
```

Short setup recipes are available for common workflows:

- [Angular](docs/recipes/angular.md)
- [React/Vite](docs/recipes/react-vite.md)
- [Vue/Vite](docs/recipes/vue-vite.md)
- [Next.js](docs/recipes/nextjs.md)
- [GitHub Actions](docs/recipes/github-actions.md)
- [ADA Title II](docs/recipes/ada-title-ii.md)
- [Section 508](docs/recipes/section-508.md)

## More Check Options

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

Use baseline mode when adopting the CLI in a project that already has known
accessibility findings. The first run creates `.a11y-baseline.json` from the
current unique findings:

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

After intentionally accepting the current state, refresh the baseline:

```bash
npx a11y-shiftleft check --dynamic --update-baseline --out reports
```

Use a custom baseline path when needed:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --baseline \
  --baseline-file config/a11y-baseline.json \
  --out reports
```

Use scoped ignores for temporary, reviewed exceptions. The CLI automatically
applies `a11y-ignore.json` when the file exists:

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

Every ignore must include `reason`, `owner`, `expires`, and at least one match
field such as `fingerprint`, `ruleId`, `source`, `severity`, `selector`,
`file`, `url`, `target`, or `wcag`. Expired or invalid entries do not hide
findings and are counted in the report summary.

Use a custom ignore file or disable ignores for a run:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:3000 --ignore-file config/a11y-ignore.json --out reports
npx a11y-shiftleft check --dynamic --url http://localhost:3000 --no-ignore --out reports
```

If a scan fails because of Node, Playwright, Chromium, config, or app startup
issues, run:

```bash
npx a11y-shiftleft doctor --url http://localhost:3000
```

Interactive local runs print a readable terminal summary. Ask for JSON when a
script needs to parse stdout:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:3000 --json-summary --out reports
```

Suppress console output in CI while still writing report files and preserving
the exit code:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:3000 --quiet --out reports
```

Print scan modes, adapter timings, URL context, baseline settings, and output
formats before the normal summary:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:3000 --verbose --out reports
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

Generate the default fast PR workflow:

```bash
npx a11y-shiftleft ci \
  --url http://localhost:3000 \
  --start-command "npm run dev -- --host localhost --port 3000" \
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
  --url http://localhost:3000 \
  --start-command "npm run dev -- --host localhost --port 3000" \
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
  --url http://localhost:4200 http://localhost:4200/favorites http://localhost:4200/settings \
  --start-command "npm run dev -- --host localhost --port 4200" \
  --fail-on warning \
  --standard section508
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
paper/capstone outline. See
[docs/evidence-methodology.md](docs/evidence-methodology.md) for confidence
scoring, issue-category reporting, and false-positive validation rules.

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
| `byConfidence` | High, medium, and low confidence counts |
| `byCategory` | Finding counts by accessibility family, such as `forms`, `focus`, `aria`, and `contrast` |
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

Adoption counts are captured as reproducible JSON snapshots instead of being
hard-coded in the README. npm download counts change over time and can include
humans, CI systems, package mirrors, security scanners, and bots.

Collect npm and GitHub activity:

```bash
npm run collect:adoption -- \
  --package a11y-shiftleft-cli \
  --repo olboyarshinova/a11y-shiftleft-cli \
  --period last-month \
  --out analysis/adoption.json
```

The npm downloads API does not expose country or person-level data. Use npm
downloads as ecosystem activity and GitHub unique views, unique clones, and
referrers as stronger human-adoption signals.

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
optional Lighthouse score and recommendation capture, broader remediation
coverage, stronger Vue/Angular static coverage, and WCAG-based
compliance-support presets for ADA Title II and Section 508 workflows.

See [docs/ai-suggestions.md](docs/ai-suggestions.md) for the future optional
`@a11y-shiftleft/ai` package plan. AI-assisted remediation is intentionally
separate from the core CLI and opt-in only.

See [docs/adoption-strategy.md](docs/adoption-strategy.md) for the adoption
plan covering npm scripts, generated GitHub Actions workflows, future
Marketplace Action support, documentation-site priorities, and outreach targets.

## Competitive Positioning

| Tool | Best For | Gap This Project Targets |
|---|---|---|
| axe-core | Accessibility rules engine used by many integrations | Engine-level API, not a full PR metrics and orchestration workflow |
| @axe-core/playwright | Dynamic checks inside Playwright tests | Requires test code and does not merge static findings by default |
| Lighthouse | Quick page quality audits across performance, SEO, best practices, and accessibility | Score-oriented page audit; future integration can bring Lighthouse recommendations into the static+dynamic report workflow |
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

## Release Notes

Latest release:

- [v0.4.0](docs/release-notes-v0.4.0.md)
