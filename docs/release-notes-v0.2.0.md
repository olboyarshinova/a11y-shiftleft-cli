# v0.2.0 Release Notes

`a11y-shiftleft-cli` v0.2.0 expands the MVP into a more reproducible
accessibility validation package with stronger TypeScript internals, richer
WCAG reporting, and research/adoption telemetry.

## Highlights

- TypeScript source migration with generated declaration files in `dist/`.
- WCAG criterion metadata in reports, including POUR principle and conformance
  level summaries.
- `--wcag-filter` for filtering findings by WCAG level.
- `check --semi-auto` for generating a manual accessibility review checklist.
- Angular template static fallback and Angular fixture coverage.
- Metrics analysis script for baseline vs intervention summaries.
- Adoption metrics collector for npm downloads and optional GitHub traffic
  snapshots.
- TypeScript implementations for release-support scripts while preserving
  stable JavaScript entrypoints.

## Verification

- `npm test`
- `npm run test:fixtures`
- `npm pack --dry-run`

## Compatibility

The package still targets Node.js 18+. Existing CLI commands and npm script
entrypoints remain compatible with v0.1.0 workflows.
