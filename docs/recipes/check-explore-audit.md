# Check, Explore, And Audit Recipe

Use this recipe when you need to choose the right command for a local app,
preview URL, or CI job.

Set the URL once:

```bash
export APP_URL=http://localhost:5173
```

## `check`

Use `check` for fast feedback in CI or pull requests. It can run dynamic browser
checks against one or more URLs and write machine-readable reports.

```bash
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports
```

## `explore`

Use `explore` when you want to debug bounded UI-state discovery without the full
audit workflow. It opens the start URL, tries safe interactions, and writes the
exploration report.

```bash
npx a11y-shiftleft-cli explore --url $APP_URL --max-depth 2 --out reports
```

## `audit`

Use `audit` for the first local review or a fuller evidence package. It combines
visual exploration with keyboard and manual-review evidence in one report.

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --profile risk --out reports --open
```

## Running Through Npm Scripts

When a project uses npm scripts, put command options after `--` so npm forwards
them to the script:

```bash
npm run check -- --dynamic --url $APP_URL --out reports
npm run explore -- --url $APP_URL --max-depth 2 --out reports
npm run audit -- --url $APP_URL --profile risk --out reports
```

Do not run `npm run check explore ...`. That still starts the `check` script and
can drop the intended `explore` URL or options.
