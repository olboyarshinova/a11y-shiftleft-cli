# v0.1.0 Release Notes

`a11y-shiftleft-cli` v0.1.0 is the first public MVP release for a
framework-agnostic accessibility orchestration CLI.

## Highlights

- Run dynamic accessibility checks against any reachable web app URL.
- Run React static accessibility checks through `eslint-plugin-jsx-a11y`.
- Run basic Vue template static checks through `eslint-plugin-vue`.
- Normalize findings from multiple sources into one report format.
- Deduplicate overlapping findings.
- Apply severity triage for CI failure gates.
- Export JSON, CSV, and Markdown reports.
- Generate GitHub Actions workflow templates.
- Collect reproducible metrics for empirical validation.

## Example

```bash
npx a11y-shiftleft init
npx a11y-shiftleft check \
  --dynamic \
  --url http://localhost:3000 \
  --out reports
```

## Reports

```txt
reports/a11y-report.json
reports/a11y-metrics.csv
reports/a11y-comment.md
```

## Current Scope

The MVP focuses on orchestration rather than replacing existing accessibility
engines. It uses axe and ESLint-based tooling underneath and adds CI workflow,
deduplication, severity, and metrics layers.

## Known Limitations

- Vue static checks are intentionally limited to basic template fallback rules.
- Angular static checks currently rely on the target project's ESLint setup.
- Dynamic scans require a running application URL.
- The project does not claim full WCAG conformance or legal compliance.
- PR comments need end-to-end validation in a real pull request.
