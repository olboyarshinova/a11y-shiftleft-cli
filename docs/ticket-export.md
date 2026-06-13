# Ticket Export

Use `ticket export` when an accessibility report should become remediation
work for a team, but you are not ready to connect Jira or Linear APIs.

The command reads `a11y-report.json`, groups related findings, and writes
dry-run ticket drafts in Markdown or JSON.

## Quick Start

Run an accessibility scan first:

```bash
npx a11y-shiftleft check --url $APP_URL --out reports
```

Then create Markdown ticket drafts:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --out reports/a11y-tickets.md
```

The output is a reviewable document. It does not create real tracker issues.

## Jira Or Linear Style

Use `--tracker` to adjust labels and wording for a target tracker:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --tracker jira \
  --out reports/a11y-jira-drafts.md
```

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --tracker linear \
  --out reports/a11y-linear-drafts.md
```

Supported tracker styles:

- `generic`
- `jira`
- `linear`

## JSON Export

Use JSON when another script should read the draft tickets:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --tracker linear \
  --format json \
  --out reports/a11y-tickets.json
```

## Triage Options

Export only critical findings:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --min-severity critical \
  --out reports/a11y-critical-tickets.md
```

Limit the number of drafts:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --max-tickets 10 \
  --out reports/a11y-tickets.md
```

Drafts are sorted by severity first, then by finding count.

## Grouping

Findings are grouped by:

- severity
- rule ID
- page or file
- selector or target

Each draft includes:

- title
- severity
- rule ID
- source
- page or file
- target selector
- WCAG metadata when available
- confidence level
- remediation hints when available

## Privacy

Ticket drafts may include URLs, selectors, file paths, rule messages, and
remediation text. Review the output before sharing it outside the team.

Generated ticket files usually should not be committed to git. Keep them with
other generated reports, or upload them as CI artifacts when needed.

## Current Limits

- No Jira or Linear API calls are made.
- No tracker authentication is required.
- Duplicate detection is local to one report file.
- The output is a draft and should be reviewed before creating real tickets.
