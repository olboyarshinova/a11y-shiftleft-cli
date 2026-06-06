# Section 508 Recipe

Use this recipe when a project needs Section 508 support evidence. The CLI can
help collect automated findings and report metadata, but it does not certify
legal compliance.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init --framework auto
```

## Run

```bash
npx a11y-shiftleft doctor --url http://localhost:3000
npx a11y-shiftleft check \
  --url http://localhost:3000 \
  --standard section508 \
  --semi-auto \
  --out reports
```

## Example Evidence Files

```txt
reports/a11y-report.json
reports/a11y-metrics.csv
reports/a11y-comment.md
reports/a11y-manual-checklist.md
```

## Example Summary

```json
{
  "standard": "section508",
  "automatedCoverage": "partial",
  "requiresManualReview": true
}
```

## Notes

Keep the generated reports with the release, pull request, or procurement
evidence packet. Add manual testing notes for keyboard navigation, screen reader
smoke checks, content clarity, and form-label quality.
