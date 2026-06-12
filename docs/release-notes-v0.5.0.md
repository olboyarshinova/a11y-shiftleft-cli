# v0.5.0 Release Notes

`a11y-shiftleft-cli` v0.5.0 focuses on visual exploration, safer report
artifacts, baseline-based CI adoption, and clearer local developer feedback.

## Highlights

- New `explore` command for bounded UI-state discovery with Playwright.
- Visual `exploration.html` report with checked states, screenshots, findings,
  transitions, triage overview, and best-effort screenshot annotations.
- Baseline mode for CI with `.a11y-baseline.json`, `--baseline`, and
  `--update-baseline` so teams can block new findings without failing on
  accepted existing findings.
- Screenshot privacy controls: JPEG compression by default, sensitive field
  redaction, `--no-screenshots`, `--no-screenshot-redaction`, and configurable
  screenshot format/quality.
- `init --gitignore` for adding generated report directories to a target
  project's `.gitignore`.
- Report retention for timestamped report folders, including
  `--retention-dry-run` previews and generated report evidence without local
  filesystem paths.
- Readable local summaries for `check`, `check --crawl`, and `explore`, plus
  `--quiet`, `--verbose`, and `--json-summary` controls.
- Scoped `a11y-ignore.json` support with `reason`, `owner`, and `expires`
  metadata for reviewed temporary exceptions.
- Confidence scoring, issue categories, expanded WCAG evidence, and richer CSV
  flattening for empirical analysis.
- Config discovery from `.a11y-shiftleft.json`, `.a11yrc.json`, and
  `package.json#a11y`.
- PR comment posting now updates the existing accessibility comment instead of
  creating a new comment on every run.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init --framework auto --gitignore
```

For optimized static checks, add the adapter bundle for your framework:

```bash
npm install --save-dev @a11y-shiftleft/react
npm install --save-dev @a11y-shiftleft/vue
npm install --save-dev @a11y-shiftleft/angular
```

## Quick Start

Run a dynamic scan against a local app:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:3000
```

Scan several pages:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url http://localhost:3000 http://localhost:3000/settings
```

Let the tool explore safe UI states and generate a visual report:

```bash
npx a11y-shiftleft explore \
  --url http://localhost:3000 \
  --limit 20 \
  --depth 2
```

Open the generated visual report:

```bash
open reports/exploration.html
```

Use baseline mode in CI:

```bash
npx a11y-shiftleft check --url http://localhost:3000 --baseline
```

Preview report retention cleanup:

```bash
npx a11y-shiftleft explore \
  --url http://localhost:3000 \
  --out reports/run-2026-06-12 \
  --retention-max-runs 5 \
  --retention-dry-run
```

## Notes

- Automated tools find only part of accessibility risk. Use `--semi-auto` to
  generate a manual review checklist for issues that need human validation.
- Visual reports can contain screenshots. Use `--no-screenshots` for sensitive
  flows or CI runs where image artifacts should not be stored.
- Generated reports support remediation and evidence tracking, but they do not
  certify legal compliance with WCAG, ADA, or Section 508.
