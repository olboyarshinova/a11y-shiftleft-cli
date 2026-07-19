# Agent Review

`agent review` is a local deterministic helper for the moment after an audit
finishes. It does not use an LLM and does not upload report data. It reads
`a11y-report.json`, summarizes the highest-priority findings, optionally
compares against a previous report, and suggests the next CLI command.

```bash
npx a11y-shiftleft-cli agent review --report reports
```

Compare with a previous run:

```bash
npx a11y-shiftleft-cli agent review \
  --report reports/current \
  --previous reports/previous
```

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
