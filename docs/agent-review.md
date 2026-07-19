# Agent Review

`agent` is a local deterministic helper for the moment after an audit finishes.
It does not use an LLM and does not upload report data.

Use `agent run` when you want one command to run the audit and then summarize
the generated report:

```bash
npx a11y-shiftleft-cli agent run --url $APP_URL --out reports --open
```

Compare with a previous run:

```bash
npx a11y-shiftleft-cli agent run \
  --url $APP_URL \
  --out reports/current \
  --previous reports/previous \
  --open
```

Or let the agent find the previous report inside a local report-history folder:

```bash
npx a11y-shiftleft-cli agent run \
  --url $APP_URL \
  --out reports/history/run-2026-07-19 \
  --history reports/history \
  --open
```

Write the review next to the visual report:

```bash
npx a11y-shiftleft-cli agent run \
  --url $APP_URL \
  --out reports \
  --review-out reports/agent-review.md
```

Use `agent review` when the audit already exists. It reads `a11y-report.json`,
summarizes the highest-priority findings, optionally compares against a previous
report, and suggests the next CLI command.

```bash
npx a11y-shiftleft-cli agent review --report reports
```

Compare with a previous run:

```bash
npx a11y-shiftleft-cli agent review \
  --report reports/current \
  --previous reports/previous
```

When reports are stored as timestamped run folders, use `--history` instead of
passing the previous run by hand:

```bash
npx a11y-shiftleft-cli agent review \
  --report reports/history/run-2026-07-19 \
  --history reports/history
```

With `--history`, the text and JSON output include a compact history context:
how many local runs were indexed and how total, critical, warning, and info
counts changed from the first run in that folder.

Write the review to a file:

```bash
npx a11y-shiftleft-cli agent review \
  --report reports \
  --out reports/agent-review.md
```

Use JSON when another local script needs the summary:

```bash
npx a11y-shiftleft-cli agent review --report reports --json
```

The output focuses on:

- total, critical, warning, and info findings;
- fixed, new, and remaining findings when `--previous` is provided;
- a short "Fix first" list sorted by severity;
- practical next commands, such as rerunning `audit` or exporting ticket drafts.

This is intentionally smaller than a tracker integration. Use it when you want
quick local guidance before opening the visual report, creating tickets, or
pushing a CI update.
