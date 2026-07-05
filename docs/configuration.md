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

## Explore Timing

Use `explore.waitMs` when screenshots or axe scans happen before a dynamic page
has finished rendering:

```json
{
  "explore": {
    "waitMs": 1000,
    "waitForSelector": "[data-page-ready]"
  }
}
```

Keep shared waits small for pull requests. Prefer a stable `waitForSelector`
over large fixed delays when the app can expose a loaded-state marker.

## Auto-Scroll Before Scans

Dynamic browser scans and visual exploration scroll each page before running
axe. This helps trigger lazy-loaded content below the first viewport:

```json
{
  "dynamic": {
    "scroll": {
      "enabled": true,
      "stepPx": 800,
      "maxSteps": 25,
      "waitMs": 100
    }
  },
  "explore": {
    "scroll": {
      "enabled": true,
      "stepPx": 800,
      "maxSteps": 25,
      "waitMs": 100
    }
  }
}
```

Use `--no-scroll` only when scrolling triggers project-specific side effects.
For long pages, scheduled full-site scans can increase `--scroll-max-steps`;
pull request checks should keep the limit bounded.

## Scoped Browser Checks

Use `--scope <selector>` when you want browser checks to stay inside one
component, dialog, checkout step, or page section:

```bash
npx a11y-shiftleft audit --url $APP_URL --scope '#checkout' --out reports
npx a11y-shiftleft check --dynamic --url $APP_URL --scope '#main' --out reports
```

For shared defaults, use `dynamic.scopeSelector` for `check` and
`explore.scopeSelector` for visual exploration and `audit`:

```json
{
  "dynamic": {
    "scopeSelector": "#main"
  },
  "explore": {
    "scopeSelector": "#main"
  }
}
```

Scoped checks limit axe scans and safe action discovery to the selected area.
Page-level and manual-review evidence should still be interpreted with the
overall page context in mind.

## Hiding Noisy Overlays

Use `--hide-elements <selectors>` when a cookie banner, sticky ad, chat widget,
survey prompt, or other overlay makes visual evidence hard to read:

```bash
npx a11y-shiftleft audit --url $APP_URL --hide-elements ".cookie-banner,.chat-widget" --out reports
npx a11y-shiftleft check --dynamic --url $APP_URL --hide-elements ".cookie-banner" --out reports
```

For shared defaults, use `dynamic.hideElements` for `check` and
`explore.hideElements` for visual exploration and `audit`:

```json
{
  "dynamic": {
    "hideElements": [".cookie-banner"]
  },
  "explore": {
    "hideElements": [".cookie-banner", ".chat-widget"]
  }
}
```

The elements are hidden with CSS during the scan and screenshots. They are not
deleted from the page, and the selectors are recorded in generated reports.

## Browser And Device Presets

By default, browser checks run in Chromium. Use `--browser` when you need
evidence from another browser engine:

```bash
npx a11y-shiftleft audit --url $APP_URL --browser firefox --out reports
npx a11y-shiftleft audit --url $APP_URL --browser webkit --device "iPhone 13" --out reports
npx a11y-shiftleft check --dynamic --url $APP_URL --browser chromium --device "Pixel 5" --out reports
```

Supported browser engines are `chromium`, `firefox`, and `webkit`. Device names
come from Playwright device presets, such as `Desktop Chrome`, `Desktop Safari`,
`iPhone 13`, and `Pixel 5`.

Install the browser engine before using it:

```bash
npx playwright install firefox
npx playwright install webkit
```

For shared defaults:

```json
{
  "dynamic": {
    "browser": "chromium",
    "device": "Pixel 5"
  },
  "explore": {
    "browser": "webkit",
    "device": "iPhone 13"
  }
}
```

Lighthouse comparison still runs through Chromium because Lighthouse depends on
Chrome DevTools behavior.

## Explore Safety

`explore.safeMode.isolateCookies` is enabled by default. It clears browser
cookies between replayed states so one explored action cannot silently change
later states:

```json
{
  "explore": {
    "safeMode": {
      "isolateCookies": true
    }
  }
}
```

Leave it enabled for CI and pull requests. Disable it only for local debugging
when you intentionally need cookies to persist across explored states.

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

- `check` overwrites `a11y-report.json`, `a11y-comment.md`, and
  `evaluation-scope.json` in the selected output directory. Add
  `--format csv` or `--format all` only when spreadsheet exports are needed.
- `audit` writes the primary `a11y-report.html`, JSON, Markdown, and screenshots.
  Excel, PDF, and raw exploration data are created only with `--excel`, `--pdf`,
  and `--raw`.
- `explore` cleans stale generated artifacts before a new run, including
  `a11y-report.json`, `a11y-comment.md`, `evaluation-scope.json`,
  `exploration.html`, `exploration-graph.json`, optional CSV exports, and
  generated state screenshots.
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

For legacy projects that need a gentle first gate, use the built-in quality
gate profile:

```bash
npx a11y-shiftleft check --dynamic --gate new-critical-only --out reports
```

This is shorthand for baseline comparison plus a critical-only failure gate. It
allows teams to track existing findings while blocking only newly introduced
critical issues.

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
