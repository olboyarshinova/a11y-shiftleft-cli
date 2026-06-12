# Configuration

This page keeps the detailed setup rules out of the README while preserving the
parts teams need for CI, shared defaults, and report cleanup.

## Config Sources

The CLI reads configuration in this order:

1. `--config <file>`
2. `.a11y-shiftleft.json`
3. `.a11yrc.json`
4. `package.json#a11y`

Use `.a11y-shiftleft.json` for generated shared defaults. Use `.a11yrc.json`,
`package.json#a11y`, or `--config` when your project already keeps tool
settings elsewhere.

## Shared Vs Local

Commit `.a11y-shiftleft.json` when it contains shared project defaults:

```json
{
  "framework": "react",
  "wcagVersion": "2.2",
  "wcagLevel": "AA",
  "dynamic": {
    "enabled": true,
    "urls": ["/", "/settings"]
  }
}
```

Keep local-only URLs, experiments, credentials, private preview links, and
machine-specific paths out of git. Use a local config file with `--config` for
those cases.

## Gitignore

Generated reports should normally stay out of git:

```bash
npx a11y-shiftleft init --gitignore
```

This adds common report directories such as `reports/` and `.a11y-reports/` to
`.gitignore`.

Commit anonymized report samples only when they are intentionally part of docs,
demos, or release evidence.

## Report Lifecycle

- `check` overwrites `a11y-report.json`, `a11y-metrics.csv`, and
  `a11y-comment.md` in the selected output directory.
- `explore` cleans stale generated artifacts before a new run, including
  `a11y-report.json`, `a11y-comment.md`, `exploration.html`,
  `exploration-graph.json`, and generated state screenshots.
- After fixing an accessibility issue, rerun the same command. The fixed issue
  should disappear from the new report.
- Use `--no-clean` only when you intentionally want to keep previous generated
  artifacts for manual comparison.

## Baseline

Use baseline mode when adopting the CLI in a project that already has known
accessibility findings:

```bash
npx a11y-shiftleft check --dynamic --baseline --out reports
```

Commit `.a11y-baseline.json`. Later CI runs with `--baseline` compare current
findings against that file and fail only on new findings at the configured
`--fail-on` severity.

Refresh the baseline only when the current state is intentionally accepted:

```bash
npx a11y-shiftleft check --dynamic --update-baseline --out reports
```

## Scoped Ignores

Use `a11y-ignore.json` for temporary, reviewed exceptions:

```json
{
  "version": 1,
  "ignores": [
    {
      "ruleId": "color-contrast",
      "selector": ".legacy-muted-text",
      "reason": "Legacy theme is scheduled for replacement.",
      "owner": "@frontend-team",
      "expires": "2026-09-30"
    }
  ]
}
```

Every ignore must include `reason`, `owner`, `expires`, and at least one match
field such as `fingerprint`, `ruleId`, `source`, `severity`, `selector`,
`file`, `url`, `target`, or `wcag`. Expired or invalid entries do not hide
findings and are counted in the report summary.

## Retention

Use retention when you write timestamped output directories such as
`reports/run-2026-06-11`:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --out reports/run-2026-06-11 \
  --retention-max-runs 5 \
  --retention-max-age-days 14
```

Preview cleanup without deleting old report runs:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --out reports/run-2026-06-11 \
  --retention-max-runs 5 \
  --retention-max-age-days 14 \
  --retention-dry-run
```

Retention only removes sibling directories that contain a11y-shiftleft report
marker files and never removes the current output directory.
