# v0.5.1 Release Notes

`a11y-shiftleft-cli` v0.5.1 is a small patch release focused on making the npm
README easier for new users and publishing the local dashboard command that was
added after v0.5.0.

## Highlights

- New `dashboard` command for viewing historical trends across saved
  `a11y-report.json` runs.
- Shorter README focused on install, first scan, visual reports, dashboard, CI,
  outputs, and project docs.
- Clearer `APP_URL` explanation with a direct URL example for users who do not
  want to set a terminal variable.
- New [configuration docs](configuration.md) for config files, `.gitignore`,
  baseline files, scoped ignores, report cleanup, and retention.
- New [visual report docs](visual-reports.md) for screenshot privacy, safe mode,
  screenshot formats, and advanced `explore` options.
- Updated npm package description to match the current product positioning.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init --framework auto --gitignore
```

## Quick Start

Set the URL printed by your dev server:

```bash
export APP_URL=http://localhost:5173
```

Run a dynamic scan:

```bash
npx a11y-shiftleft check --dynamic --url $APP_URL --out reports
```

Or pass the URL directly:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:5173 --out reports
```

Open a historical dashboard after saving several report runs:

```bash
npx a11y-shiftleft dashboard --reports reports
```

## Notes

- This release does not change adapter package versions.
- The dashboard reads generated reports from disk and serves a local summary.
- Generated visual reports can include screenshots. Use `--no-screenshots` for
  sensitive flows or CI runs where image artifacts should not be stored.
