# Watch Mode

`watch` is for local development. It watches source files, reruns the existing
accessibility check pipeline after changes, refreshes reports, and prints a
small run-to-run delta.

## Quick Start

Start your app first, then run:

```bash
npx a11y-shiftleft-cli watch --url $APP_URL --out reports/watch
```

Example without an environment variable:

```bash
npx a11y-shiftleft-cli watch --url http://localhost:5173 --out reports/watch
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
```

Add `--format csv` or `--format all` if you also want spreadsheet exports during
watch mode.

## Custom Source Paths

Use `--watch-path` when your project keeps UI code somewhere else:

```bash
npx a11y-shiftleft-cli watch \
  --url $APP_URL \
  --watch-path src shared/ui packages/app \
  --out reports/watch
```

## Static-Only Feedback

For fast lint-style feedback without opening the browser:

```bash
npx a11y-shiftleft-cli watch --static --out reports/watch
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
npx a11y-shiftleft-cli watch --dynamic --url http://localhost:5173 --out reports/watch
```

Use multiple URLs when the app has important routes:

```bash
npx a11y-shiftleft-cli watch \
  --dynamic \
  --url http://localhost:5173 http://localhost:5173/settings \
  --out reports/watch
```

## Baseline Adoption

For an existing project with known findings:

```bash
npx a11y-shiftleft-cli check --url $APP_URL --baseline --out reports
npx a11y-shiftleft-cli watch --url $APP_URL --baseline --out reports/watch
```

The first command creates `.a11y-baseline.json`. Later `watch` runs show new
findings separately from findings already accepted in the baseline.

## Output

After each scan, `watch` prints:

```txt
a11y-shiftleft watch run 2
Reason: file changes
Changed files: 1
Changed groups: added 0, modified 1, deleted 0
Findings: total 4 | critical 0 | warning 3 | info 1
Delta: fixed 2, new 1, remaining 4, total delta -1
Duration: 842ms
Reports: reports/watch/a11y-comment.md
Affected route hints: http://localhost:5173/account
```

Use `--verbose` to include a small changed-file sample and the number of
changed files that could not be mapped to a route hint.

Route hints are conservative. `watch` can infer common route files such as
`src/pages/account.tsx`, `src/app/account/page.tsx`, and
`src/routes/account.svelte`. Shared components do not have one reliable URL, so
keep representative smoke-test routes in `--url` for important flows.

## Current Limits

- `watch` reruns the configured check pipeline. Route hints help with triage,
  but they do not replace explicit `--url` coverage for shared components.
- `watch` refreshes check reports, not the visual `exploration.html` report.
- For CI, use `check` or a generated workflow instead of `watch`.
- Browser overlay and DevTools-style highlighting are planned separately after
  the watch workflow is stable.
