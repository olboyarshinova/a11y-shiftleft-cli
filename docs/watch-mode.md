# Watch Mode

`watch` is for local development. It watches source files, reruns the existing
accessibility check pipeline after changes, refreshes reports, and prints a
small run-to-run delta.

## Quick Start

Start your app first, then run:

```bash
npx a11y-shiftleft watch --url $APP_URL --out reports/watch
```

Example without an environment variable:

```bash
npx a11y-shiftleft watch --url http://localhost:5173 --out reports/watch
```

The command watches common source folders:

- `src`
- `app`
- `pages`
- `components`

Each run refreshes:

```txt
reports/watch/a11y-comment.md
reports/watch/a11y-report.json
reports/watch/a11y-metrics.csv
reports/watch/a11y-findings.csv
```

## Custom Source Paths

Use `--watch-path` when your project keeps UI code somewhere else:

```bash
npx a11y-shiftleft watch \
  --url $APP_URL \
  --watch-path src shared/ui packages/app \
  --out reports/watch
```

## Static-Only Feedback

For fast lint-style feedback without opening the browser:

```bash
npx a11y-shiftleft watch --static --out reports/watch
```

If your project uses React, Vue, or Angular static checks, install the matching
adapter package first:

```bash
npm install --save-dev @a11y-shiftleft/react
```

## Dynamic Feedback

For browser-based checks, keep your dev server running:

```bash
npm run dev
npx a11y-shiftleft watch --dynamic --url http://localhost:5173 --out reports/watch
```

Use multiple URLs when the app has important routes:

```bash
npx a11y-shiftleft watch \
  --dynamic \
  --url http://localhost:5173 http://localhost:5173/settings \
  --out reports/watch
```

## Baseline Adoption

For an existing project with known findings:

```bash
npx a11y-shiftleft check --url $APP_URL --baseline --out reports
npx a11y-shiftleft watch --url $APP_URL --baseline --out reports/watch
```

The first command creates `.a11y-baseline.json`. Later `watch` runs show new
findings separately from findings already accepted in the baseline.

## Output

After each scan, `watch` prints:

```txt
a11y-shiftleft watch run 2
Reason: file changes
Changed files: 1
Findings: total 4 | critical 0 | warning 3 | info 1
Delta: fixed 2, new 1, remaining 4, total delta -1
Duration: 842ms
Reports: reports/watch/a11y-comment.md
```

Use `--verbose` to include a small changed-file sample.

## Current Limits

- `watch` reruns the configured check pipeline; it does not yet map changed
  files to affected routes automatically.
- `watch` refreshes check reports, not the visual `exploration.html` report.
- For CI, use `check` or a generated workflow instead of `watch`.
- Browser overlay and DevTools-style highlighting are planned separately after
  the watch workflow is stable.
