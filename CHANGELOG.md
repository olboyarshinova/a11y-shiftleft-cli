# Changelog

## Unreleased

- Fixed screenshot preview annotations so issue frames remain visible and align
  with images fitted inside the compact 16:9 preview.

### Changed

- Dynamic checks and visual exploration now automatically compare light and
  dark system color schemes when they produce different rendered appearances;
  no additional command or flag is required.
- Reports preserve color-scheme-specific findings, label affected visual
  states, and show which schemes are represented in likely root-cause groups.
- Regular dynamic checks merge identical light/dark findings so
  theme-independent structural defects do not inflate totals; findings with
  different evidence remain separated by color scheme.
- Visual exploration prioritizes recognizable theme controls and includes
  rendered appearance in state fingerprints so explicit theme toggles are not
  collapsed into the same state.
- Every finding now receives deterministic remediation guidance. Visual and
  Markdown reports show concrete steps, documentation links, and available
  framework examples; unknown rules receive conservative fallback guidance.
- Dynamic axe adapters preserve each violation's rule-specific `helpUrl` in
  JSON and use it in remediation links.
- Visual exploration now keeps short-page context but automatically replaces
  very tall screenshots with focused evidence crops around nearby findings.
  `--screenshot-full-page` remains available when complete-page evidence is
  explicitly required.
- `exploration.html` now includes overflow findings, root causes, transitions,
  and skipped actions in collapsed sections instead of requiring a second
  user-facing report.
- Explore cleanup removes the obsolete `exploration-visual-check.html` artifact;
  `exploration.html` is the single canonical visual report.
- Reports now distinguish mapped WCAG violations, axe best-practice guidance,
  and unmapped review items instead of presenting every finding as equivalent.
- JSON, Markdown, and visual reports group repeated occurrences into likely
  root causes while preserving per-page evidence.
- Removed the unsupported WCAG 1.3.1 mapping from axe `heading-order`; axe
  classifies this rule as best-practice guidance.
- The package now exposes both `a11y-shiftleft` and `a11y-shiftleft-cli` as
  executable names, so the npm package name works directly with `npx`.
- HTML reports display generated timestamps in a readable UTC format while
  retaining the original ISO value in semantic `time` metadata.
- Visual exploration stores pixel-identical screenshots once and shows compact
  references for duplicate states while preserving each state's findings and
  annotation view.
- Cookie consent controls are detected from their surrounding banner or dialog,
  so short labels such as `Accept` or `OK` are not clicked automatically.

## 0.6.0 - 2026-06-13

### Added

- Initial `watch` command for local development feedback. It watches common
  source folders, reruns the existing accessibility check pipeline after file
  changes, refreshes reports, and prints fixed/new/remaining finding counts.
- Dedicated `watch` documentation with quick start, custom source paths,
  static-only mode, dynamic URL mode, baseline usage, and current limits.
- Beginner-focused README rewrite with clearer project value, a 2-minute quick
  start, and copy-paste usage recipes.
- GitHub "Good first issue" template and contributor guidance for
  beginner-friendly tasks.
- Expanded contributor onboarding with clone/install/test/PR instructions,
  structured issue forms, and a pull request template.
- Seed script for creating five beginner-friendly GitHub issues with
  `good first issue`, `help wanted`, and `documentation` labels.
- Contributor guide sections for the first-PR path, test commands by change
  type, review expectations, and maintainer issue seeding.
- `explore --pdf` for generating `exploration.pdf` from the visual HTML report.
- `dashboard --pdf` for generating a portable PDF copy of the local historical
  dashboard.
- `ticket export` for creating dry-run Jira, Linear, or generic ticket drafts
  from `a11y-report.json` without connecting to external tracker APIs.
- Dedicated ticket export documentation with Markdown, JSON, Jira, and Linear
  dry-run examples.
- `explore --wait-ms` and `explore --wait-for-selector` for dynamic pages that
  need a short stabilization period before screenshots and axe scans.
- Bounded auto-scroll before dynamic and visual axe scans so lazy-loaded
  below-the-fold content can be checked without manually scrolling the page.
- Automatic full-page screenshot evidence for explored states with findings,
  while clean states keep compact viewport screenshots.
- Structured color-contrast evidence in JSON, Markdown, and HTML reports with
  measured and required ratios, color swatches, and passing text-color
  suggestions that preserve the current background.
- Severity-colored visual report cards and annotations without stacked gray
  overlays that obscure screenshots with multiple findings.
- Screenshot annotations now use a dedicated image-sized overlay, with layout
  stabilization and element bounds captured immediately before the screenshot.
- Built-in high-risk action blocking for account/session, payment, cookie
  consent, camera/photo, microphone, location, notification, upload, and sharing
  controls, with cookie isolation between explored states.
- Updated release checklist with v0.6 smoke tests for PDF export, ticket drafts,
  dashboard PDF, and watch help.
- Updated framework, CI, ADA Title II, and Section 508 recipes to use clearer
  dev server URL examples and remind users to scan the URL printed by their own
  app.

### Changed

- Refactored `check` into a reusable `runCheck()` pipeline so future developer
  workflows can reuse the same normalization, triage, baseline, ignore, and
  reporting behavior without shelling out to the CLI.
- `explore` cleanup and report retention now treat `exploration.pdf` as a
  generated report artifact.
- `exploration.html` now keeps state transitions and skipped actions in a
  compact details section so the report focuses first on actionable findings.
- `exploration.html` now renders larger screenshots and provides an annotated
  screenshot view so issue frames remain visible when inspecting a screenshot.

### Fixed

- PR accessibility workflow no longer fails when GitHub blocks report comments
  for forked pull requests; the report artifact is still uploaded.

## 0.5.2 - 2026-06-12

### Added

- WCAG metadata and remediation hints for additional common axe findings,
  including document title, page language, ARIA validation, autocomplete
  purpose, input button names, select names, heading order, and list structure.
- Manual GitHub Actions workflow for publishing a GitHub Packages mirror as
  `@olboyarshinova/a11y-shiftleft-cli`.

### Changed

- Updated GitHub Actions workflows to use `actions/checkout@v6`,
  `actions/setup-node@v6`, and Node.js 22.
- Replaced older public documentation wording with clearer "works across web
  frameworks" phrasing.

## 0.5.1 - 2026-06-12

### Added

- Initial `dashboard` command for indexing generated `a11y-report.json` files
  and serving a local historical summary with trends, top rules, affected
  pages, and recent runs.
- Dedicated configuration documentation covering config source order,
  `.gitignore`, baseline files, scoped ignores, report lifecycle, and retention.
- Dedicated visual report documentation covering screenshot privacy, safe mode,
  screenshot formats, and advanced `explore` output controls.

### Changed

- Streamlined the README for new users by keeping the main file focused on
  install, first scan, visual reports, dashboard, CI, and outputs.
- Replaced the package description with clearer npm metadata for accessibility
  testing workflows.
- Clarified `APP_URL` as a terminal shortcut and added direct URL examples for
  users who prefer not to set an environment variable.

## 0.5.0 - 2026-06-12

### Added

- Post-release v0.4.0 consumer install verification notes.
- Public v0.4.0 adoption snapshot and promotion draft.
- v0.4.0 demo pull request playbook for before/after adoption evidence.
- v0.4.0 case study template for turning demo pull requests into publishable
  engineering evidence.
- Standalone React/Vite demo template for creating a public before/after
  accessibility CI repository.
- Multi-package adoption snapshot collector and weekly GitHub Actions artifact
  workflow.
- Experimental `explore` command for safe zero-config UI-state discovery with
  screenshots and an exploration graph artifact.
- Visual `exploration.html` report for `explore` runs, showing checked states,
  screenshots, findings, and state transitions.
- Safe cleanup for `explore` output artifacts so stale state screenshots do not
  remain in repeated report runs.
- Compressed JPEG state screenshots by default for `explore`, with configurable
  screenshot format, JPEG quality, and full-page capture.
- Default screenshot redaction for sensitive form fields in `explore`, with an
  explicit `--no-screenshot-redaction` escape hatch for local debugging.
- `init --gitignore` for adding generated report directories to a project's
  `.gitignore` without modifying files during package installation.
- Optional AI suggestions architecture documentation for a future separate
  `@a11y-shiftleft/ai` package.
- Baseline mode for `check`, including `.a11y-baseline.json`, `--baseline`,
  `--baseline-file`, and `--update-baseline` so CI can fail only on new
  accessibility findings.
- Roadmap notes for future real-time developer feedback via `watch`, local
  browser overlay, and a separate browser extension package.
- Roadmap notes for `watch` run-to-run deltas such as fixed, new, and remaining
  findings in terminal feedback.
- Roadmap notes for a future local metrics dashboard and Lighthouse comparison
  workflow.
- Roadmap notes for optional Lighthouse recommendation capture through the
  existing report and visual exploration workflow.
- Roadmap notes for a future documentation website privacy section covering
  screenshots, report artifacts, `.gitignore`, and baseline files.
- Roadmap notes for future manual PR comments, GitHub Action artifacts, preview
  URL inputs, and severity labels.
- Roadmap notes for CLI quality-of-life improvements including quiet/verbose
  output, broader config discovery, progress output, and screenshot annotations.
- Roadmap notes for future Git hook setup, incremental scans, smart ignores,
  and colorized local severity output.
- Roadmap notes for additional `explore` state-explosion safeguards,
  configurable safe-mode policies, and generated report retention.
- README preview showing how the generated `exploration.html` visual report is
  structured.
- TypeScript source for the CLI program registration, fixture verification
  script, and Vite demo config while preserving stable JavaScript runtime
  wrappers for npm consumers.
- TypeScript test sources with a dedicated `tsconfig.test.json` build and
  `dist-test` execution path.
- Adoption telemetry collector support for separately recording manual npm
  website download snapshots alongside npm API periods.
- Split CI generation profiles for fast PR accessibility crawls and separate
  scheduled full-site accessibility crawls.
- Repository CI now uses a bounded accessibility PR crawl plus a separate
  scheduled full-site accessibility workflow artifact.
- Confidence scoring, confidence reasons, and issue-category metadata for
  findings and report summaries.
- Evidence methodology documentation for validating false positives,
  confidence precision, and issue-category reporting.
- `check --quiet` and `check --verbose` output controls for CI-friendly runs
  and local troubleshooting.
- Scoped `a11y-ignore.json` support with required `reason`, `owner`, and
  `expires` metadata for temporary reviewed exceptions.
- Configurable `explore.safeMode` rules for project-specific blocked text,
  roles, URLs, selectors, allowed selectors, and browser dialog auto-dismiss.
- Config discovery for `.a11yrc.json` and `package.json#a11y` in addition to
  the existing `.a11y-shiftleft.json` and `--config` path.
- `explore --quiet` and `explore --verbose` output controls for CI-friendly
  visual scans and local troubleshooting.
- `exploration-graph.json` and `exploration.html` now include skipped
  exploration actions with reviewable safe-mode reasons.
- Opt-in report retention cleanup for timestamped output directories via
  config or `--retention-max-runs` / `--retention-max-age-days`.
- Generated JSON, CSV, and Markdown reports now include retention evidence when
  retention cleanup is enabled.
- `check` and `explore` now support `--retention-dry-run` to preview historical
  report cleanup without deleting old runs.
- Retention evidence in generated reports now omits local filesystem paths and
  stores only cleanup counters and mode.
- Readable local `check` summary with severity counts, top rules, affected
  pages, report paths, and `--json-summary` for scripts that parse stdout.
- `doctor` now autodetects React, Vue, and Angular from `package.json` and
  recommends the matching `@a11y-shiftleft/*` adapter bundle for optimized
  static checks.
- Readable local `explore` progress and final summary output, with
  `--json-summary` for scripts that parse stdout.
- Compact interactive `check --crawl` progress output for crawl discovery and
  per-page dynamic scans.
- Triage overview in `exploration.html`, including most affected states, top
  rules, severity scores, state anchors, and WCAG metadata where available.
- Best-effort screenshot annotations in `exploration.html` using selector
  bounding boxes stored in issue evidence instead of modifying screenshot files.

### Changed

- Adapter packages now declare optional framework runtime peer dependencies
  (`react`, `vue`, and `@angular/core`) so npm metadata signals the intended
  host framework without installing framework runtimes.
- Deduplication now separates matching selectors across different URLs and
  matching static findings across different source locations.
- `check --static` and `check --dynamic` now behave as explicit scan modes.
- ESLint adapter output is filtered to accessibility-related rules so ordinary
  project lint findings do not appear in accessibility reports.
- Dynamic axe scans now continue across remaining URLs when one page fails.
- GitHub PR reporting now updates an existing accessibility comment instead of
  posting a new comment on every run.
- React/Vite demo now includes a stateful modal with intentional accessibility
  issues for `explore` scans.
- CSV report export now recursively flattens nested evidence fields.
- Compliance preset filtering now limits mapped findings by preset WCAG
  version/level while preserving unmapped best-practice findings separately.
- README and recipes now use current compliance-support wording, include an ADA
  Title II evidence recipe, and provide a simpler beginner quick start.
- Command help for `--cwd` no longer prints the caller's local working
  directory as a default value.

## 0.4.0 - 2026-06-06

### Added

- Compliance evidence summary in JSON, CSV, and Markdown reports, including
  WCAG-mapped findings, unmapped findings, affected pages, top affected pages,
  and manual-review status.
- Adoption strategy document covering low-friction npm scripts, generated
  GitHub Actions workflows, future Marketplace Action support, documentation
  website priorities, outreach targets, and channels that should wait for
  stronger adoption evidence.
- Adoption roadmap items for demo repositories, before/after case studies,
  copy-paste recipes, trust badges, issue templates, a future `doctor` command,
  community surfaces, engineering posts, and selected external pull requests.
- `doctor` command for pre-flight setup checks covering Node.js, project
  directory access, config presence, Playwright resolution, Chromium
  installation, CI detection, and target URL reachability.
- CLI version output now reads from `package.json` instead of a hard-coded
  value.
- Copy-paste recipe docs for Angular, React/Vite, Vue/Vite, Next.js, GitHub
  Actions, and Section 508 workflows.
- GitHub issue templates for bug reports, framework support requests, rule
  mapping requests, and adoption stories.
- Framework-aware setup via `init --framework react|vue|angular|auto|unknown`.
- `doctor` now checks framework-specific adapter package availability based on
  the selected framework.
- Framework static plugins are lazy-loaded and moved from required dependencies
  to optional peer dependencies, preparing the future adapter package split.
- `adapter list` and `adapter add <framework>` commands for copy-paste static
  adapter dependency guidance.
- Companion adapter package scaffolds for `@a11y-shiftleft/react`,
  `@a11y-shiftleft/vue`, and `@a11y-shiftleft/angular`.

## 0.3.0 - 2026-06-05

### Added

- WCAG version filtering for mapped findings via config `wcagVersion` and CLI
  flag `--wcag-version`.
- Bounded same-origin crawling for dynamic scans via `--crawl`,
  `--crawl-depth`, and `--crawl-limit`.
- Page-level risk ranking in JSON, CSV, and Markdown reports.
- Remediation hints with documentation links and common framework examples for
  frequently emitted accessibility rules.
- Axe tags and unmapped-rule summaries for best-practice checks that do not map
  directly to WCAG criteria.
- Multi-URL dynamic scans via repeated, space-separated, or comma-separated
  `--url` values.
- WCAG-based compliance support presets via `--standard wcag22-aa`,
  `--standard ada-title-ii`, and `--standard section508`, with report metadata
  and legal-safe disclaimers.
- GitHub Actions workflow generation now supports multiple URLs and
  `--standard` presets.

## 0.2.1 - 2026-06-04

### Changed

- Polished README release instructions and latest-release copy after publishing
  v0.2.0.

## 0.2.0 - 2026-06-04

### Added

- Angular template static fallback with `@angular-eslint/eslint-plugin-template`.
- Angular fixture smoke-test coverage.
- PR metrics CSV template and synthetic sample dataset.
- Metrics analysis script for baseline vs intervention summaries.
- JSON export support for metrics analysis output.
- IMRaD research paper outline.
- TypeScript source migration with compiled `dist/` runtime and declaration
  files.
- WCAG criterion metadata in reports, POUR/level summary counts, and
  `--wcag-filter`.
- Roadmap document for semi-automated review, WCAG version filtering, crawling,
  Lighthouse, and stronger Vue/Angular support.
- Adoption metrics collector for npm downloads and optional GitHub traffic
  evidence snapshots.
- Semi-automated manual accessibility review checklist via `check --semi-auto`.
- TypeScript implementations for metrics, adoption telemetry, and PR comment
  scripts while keeping stable JavaScript entrypoints for npm users.

## 0.1.0 - 2026-06-03

Initial public MVP release.

### Added

- CLI commands: `init`, `check`, and `ci`.
- Dynamic accessibility scanning with Playwright and axe.
- React static scanning fallback with `eslint-plugin-jsx-a11y`.
- Normalized issue schema for static and dynamic findings.
- Severity triage: `critical`, `warning`, and `info`.
- Deduplication by rule, target, and severity.
- JSON, CSV, and Markdown report outputs.
- Metrics export for `rawCount`, `uniqueCount`, `duplicateCount`,
  `duplicateRate`, `scanDurationMs`, `bySource`, and `bySeverity`.
- GitHub Actions workflow generation.
- Demo React/Vite app with intentional accessibility findings.
- Core, adapter, reporter, and CLI gate tests.

### Known Limitations

- Vue static checks are intentionally limited to basic template fallback rules.
- Angular static checks rely on the target project's ESLint setup in v0.1.0.
- Dynamic scans require the target app to already be running at a reachable URL.
- The CLI does not certify WCAG conformance; automated checks cover only part of
  accessibility review.
- PR comment behavior should be validated in real pull request workflows.
