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
- Clearer visual-report handling for axe `incomplete` findings. Potential
  contrast issues over images, gradients, video, or complex overlays are shown
  as `needs review` evidence instead of confirmed violations.
- Screenshot marker summaries for grouped findings, including a note when only
  part of a large group is numbered on the screenshot.
- Automatic scrollable full-page screenshots for states with many findings,
  while keeping focused crops for smaller or extremely long states.
- Optional `share prepare --include-html` export for a self-contained visual
  HTML copy with embedded screenshots, intended for carefully reviewed local
  sharing.

## Why It Matters

Lighthouse is widely recognized, but its score is not a WCAG conformance
certificate. This release lets teams use the score as a shared reference while
still seeing detailed rule evidence, keyboard findings, visual screenshots,
manual-review gaps, and WCAG metadata from the normal a11y-shiftleft pipeline.

The visual report also separates confirmed violations from items that need
human review, so teams can investigate likely problems without inflating defect
counts or hiding uncertainty.

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

Prepare a sanitized share package. Add `--include-html` only after reviewing
that screenshots are approved for sharing:

```bash
npx a11y-shiftleft-cli share prepare --report reports --out a11y-share
npx a11y-shiftleft-cli share prepare --report reports --out a11y-share --include-html
```

## Update

```bash
npm install --save-dev a11y-shiftleft-cli@0.8.0
```
