# v0.9.1 Release Notes

`a11y-shiftleft-cli` v0.9.1 is a stabilization release focused on evidence
handoff, local verification, and pre-1.0 release readiness. It does not change
the core `audit` workflow or publish a 1.0 release.

## Added

- Evidence package review-readiness metadata in `evidence-manifest.json` and
  `evidence-summary.md`.
- `evidence pack --format json` for scripts that need the generated package
  manifest and handoff-readiness status from stdout.
- `evidence verify --format json` for CI jobs, release checks, and local
  automation that need machine-readable verification results.
- `evidence verify --require-review-ready` for strict handoff gates. This can
  fail when checksums are valid but required review evidence is missing.
- Visible terminal readiness blockers in `evidence verify`, so reviewers can
  see what must be fixed without opening the summary file first.
- More journey-aware evidence summaries for planned critical journeys,
  including journey counts, severity totals, and top affected journey output.
- Draft v1.0.0 release notes to define the stable command surface,
  non-certification boundaries, and release validation checklist.

## Why It Matters

This release makes local evidence packages easier to review, archive, and use in
scripts without uploading report data. A package can now be checksum-valid while
still clearly marked as not ready for external handoff if manual-review,
keyboard, or evaluation-scope evidence is missing.

## Commands

```bash
npx a11y-shiftleft-cli evidence pack --reports reports --out a11y-evidence
npx a11y-shiftleft-cli evidence pack --reports reports --out a11y-evidence --format json
npx a11y-shiftleft-cli evidence verify --package a11y-evidence
npx a11y-shiftleft-cli evidence verify --package a11y-evidence --require-review-ready
npx a11y-shiftleft-cli evidence verify --package a11y-evidence --format json
```

## Notes

- Reports remain local by default.
- JSON output is intended for local automation and CI scripts.
- Review-readiness is not a compliance certificate; it is a practical evidence
  completeness signal before handoff.
