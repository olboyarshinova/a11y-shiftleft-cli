# Changelog

## Unreleased

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
