# v0.8.0 Release Notes

`a11y-shiftleft-cli` v0.8.0 is a comparative-scoring release focused on optional
Lighthouse evidence. The CLI still uses axe, Playwright, keyboard evidence,
static adapters, screenshots, and manual-review prompts as its primary audit
workflow; Lighthouse is added as a familiar score-oriented comparison layer.

## Added

- Optional `--with-lighthouse` support for both `check` and `audit`.
- Lighthouse accessibility score, failed audits, manual audits, and
  documentation links in generated reports.
- Lighthouse-vs-pipeline comparison metadata showing matching rule IDs,
  Lighthouse-only failed audits, and pipeline-only rules.
- Lighthouse recommendation cards in the visual HTML report.
- Lighthouse recommendation details in Markdown reports for pull requests and
  local review.
- Historical Lighthouse summaries in the local dashboard, including runs with
  Lighthouse, latest score, average score, failed audit totals, manual audit
  totals, and tool-difference counts.
- Lighthouse score trend bars in the dashboard alongside the existing findings
  trend.

## Why It Matters

Lighthouse is widely recognized, but its score is not a WCAG conformance
certificate. This release lets teams use the score as a shared reference while
still seeing detailed rule evidence, keyboard findings, visual screenshots,
manual-review gaps, and WCAG metadata from the normal a11y-shiftleft pipeline.

## Try It

Install Lighthouse only in projects that want the comparison:

```bash
npm install --save-dev lighthouse
```

Run a full visual audit with Lighthouse comparison:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --with-lighthouse --out reports
```

Run a faster CI-style check with Lighthouse comparison:

```bash
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --with-lighthouse --out reports
```

After several saved reports, open the local dashboard:

```bash
npx a11y-shiftleft-cli dashboard --reports reports
```

## Update

```bash
npm install --save-dev a11y-shiftleft-cli@0.8.0
```
