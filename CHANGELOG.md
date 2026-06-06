# Changelog

## Unreleased

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
- React companion adapter package scaffold at `@a11y-shiftleft/react`.

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
