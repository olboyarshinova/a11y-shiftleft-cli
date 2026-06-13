# Section 508 Recipe

Use this recipe when a project needs Section 508 support evidence. The CLI can
help collect automated findings and report metadata, but it does not certify
legal compliance.

Section508.gov explains that the Revised 508 Standards incorporate WCAG 2.0
Level AA success criteria and conformance requirements for web and non-web
electronic content. Verify current procurement requirements with the relevant
agency or counsel.

Official reference:

```txt
https://www.section508.gov/develop/applicability-conformance/
```

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init --framework auto
```

## Run

```bash
export APP_URL=http://localhost:5173
npx a11y-shiftleft doctor --url $APP_URL
npx a11y-shiftleft check \
  --url $APP_URL \
  --standard section508 \
  --semi-auto \
  --out reports
```

Use the URL printed by your local dev server or preview environment.

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
