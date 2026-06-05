# v0.3.0 Release Notes

`a11y-shiftleft-cli` v0.3.0 focuses on practical project adoption: multi-page
scans, clearer remediation guidance, page-level risk ranking, and
WCAG-based compliance-support metadata for ADA Title II and Section 508
workflows.

## Highlights

- Multi-URL dynamic scans via repeated, space-separated, or comma-separated
  `--url` values.
- Bounded same-origin crawling with `--crawl`, `--crawl-depth`, and
  `--crawl-limit`.
- Page-level risk ranking in JSON, CSV, and Markdown reports.
- Remediation hints with documentation links and framework examples for common
  React, Vue, and Angular findings.
- Axe tags and unmapped-rule summaries for best-practice findings that do not
  map directly to WCAG criteria.
- WCAG version filtering via config `wcagVersion` and `--wcag-version`.
- Compliance-support presets:
  - `--standard wcag22-aa`
  - `--standard ada-title-ii`
  - `--standard section508`
- GitHub Actions workflow generation with multiple URLs and `--standard`
  support.

## Compliance Note

The compliance presets support accessibility risk detection, remediation
tracking, and evidence collection. They do not certify legal compliance with
ADA, Section 508, or WCAG. Manual review, keyboard testing, screen reader
testing, and organizational compliance review are still required.

## Verification

- `npm test`
- `npm run test:fixtures`
- `npm pack --dry-run`

## Compatibility

The package still targets Node.js 18+. Existing v0.2.x workflows remain
compatible. New flags are additive.
