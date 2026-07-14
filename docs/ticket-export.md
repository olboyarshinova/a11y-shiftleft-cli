# Ticket Export

Use `ticket export` when an accessibility report should become remediation
work for a team, but you are not ready to connect Jira, Linear, or GitHub
Issues APIs.

The command reads `a11y-report.json`, groups related findings, and writes
dry-run ticket drafts in Markdown or JSON.

It also adds a stable ticket fingerprint to each draft and redacts
sensitive-looking values from URLs, selectors, and messages before export.

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

## Jira, Linear, Or GitHub Style

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

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --tracker github \
  --out reports/a11y-github-drafts.md
```

Supported tracker styles:

- `generic`
- `jira`
- `linear`
- `github`

## JSON Export

Use JSON when another script should read the draft tickets. Each draft includes
the same stable `fingerprint` value shown in Markdown, so later tracker
integrations can detect duplicates without relying on title text alone:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --tracker linear \
  --format json \
  --out reports/a11y-tickets.json
```

## Dry-run Payload Preview

Use `--format payloads` when you want to inspect the issue payload shape before
connecting any tracker API:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --tracker github \
  --format payloads \
  --out reports/a11y-github-payloads.json
```

The output includes `dryRun: true`, the draft fingerprint, an endpoint hint,
and the tracker-specific payload. It still does not make network requests or
create real issues.

## Duplicate Lookup

Compare a new export with a previous JSON or payload export before creating
issues:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --known-tickets reports/previous-a11y-tickets.json \
  --out reports/a11y-tickets.md
```

Known matches are detected by stable ticket fingerprint and marked in the
Markdown table, ticket body, JSON drafts, and payload previews.

Skip known drafts when you only want new work:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --known-tickets reports/previous-a11y-tickets.json \
  --skip-known \
  --out reports/a11y-new-tickets.md
```

This lookup is local-only. It does not query Jira, Linear, GitHub Issues, or any
external tracker.

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
- stable ticket fingerprint
- severity
- rule ID
- source
- owner hint for triage
- page or file
- target selector
- WCAG metadata when available
- confidence level
- remediation hints when available

## Owner Hints

Ticket drafts include a deterministic `ownerHint` such as `Frontend
interaction`, `Design system or visual design`, `Content structure`, or
`Third-party embed owner`.

These hints help teams route drafts during triage. They do not assign a real
person, create tracker ownership, or replace human review.

## Privacy

Ticket drafts may include URLs, selectors, file paths, rule messages, and
remediation text. Before export, the CLI redacts common sensitive values such
as email addresses, auth/session/token/password query parameters, and selector
values like `[value="..."]`.

Review the output before sharing it outside the team. Redaction is a safety
net, not a substitute for human review.

Generated ticket files usually should not be committed to git. Keep them with
other generated reports, or upload them as CI artifacts when needed.

## Current Limits

- No Jira, Linear, or GitHub Issues API calls are made.
- No tracker authentication is required.
- Duplicate lookup is local to one report file or a previous ticket export
  supplied with `--known-tickets`.
- Fingerprints are stable draft identifiers, not proof that a tracker issue
  already exists.
- The output is a draft and should be reviewed before creating real tickets.
