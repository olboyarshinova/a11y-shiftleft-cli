# ADA Title II Recipe

Use this recipe when a state or local government project needs ADA Title II web
accessibility support evidence. The CLI can help collect automated findings,
manual-review prompts, and report metadata, but it does not certify legal
compliance.

As of 2026-06-09, ADA.gov describes WCAG 2.1 Level AA as the technical standard
for state and local government web content and mobile apps. ADA.gov also notes
that the 2026 Interim Final Rule extended compliance dates to April 26, 2027 for
state and local government entities with a total population of 50,000 or more,
and April 26, 2028 for entities with less than 50,000 people or special district
governments. Verify current dates on ADA.gov before relying on them.

Official reference:

```txt
https://www.ada.gov/resources/small-entity-compliance-guide/
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
  --standard ada-title-ii \
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

## What To Preserve

- tested URLs and route scope
- CLI version and adapter package versions
- CI run URL
- generated JSON, CSV, and Markdown reports
- manual keyboard review notes
- screen reader smoke-test notes
- screenshots or recordings for remediated issues when useful

## Guardrails

- Do not claim ADA compliance from automated results.
- Do not claim WCAG conformance unless a complete scoped conformance evaluation
  has been performed.
- Treat this workflow as accessibility risk detection, remediation tracking, and
  evidence collection.
