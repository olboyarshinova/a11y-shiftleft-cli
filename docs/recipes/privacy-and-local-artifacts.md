# Privacy And Local Artifacts

Use this recipe when a scan may touch private routes, authenticated pages,
customer data, payment forms, internal preview URLs, or screenshots that should
not be committed.

## Privacy Defaults

| Artifact | Default handling | Commit it? |
|---|---|---|
| `reports/` | Generated locally or as CI artifacts | No |
| `.a11y-reports/` | Generated local report directory | No |
| Screenshots | Stored in the report folder when enabled | No |
| `.a11y-auth/` | Local Playwright auth state | No |
| `playwright/.auth/` | Common custom auth-state location | No |
| `.a11y-baseline.json` | Accepted known findings for CI comparison | Yes, after review |
| `.a11y-shiftleft.json` | Project configuration | Yes |
| CI workflow files | Generated setup files | Yes |

The CLI does not upload source code, URLs, DOM evidence, screenshots, cookies,
auth state, or report data to an a11y-shiftleft service. Reports stay in your
project, local output folder, or CI artifact store unless you explicitly share
or export them.

## Add Report Paths To `.gitignore`

Use setup for new projects:

```bash
npx a11y-shiftleft-cli setup --url $APP_URL --start-command "npm run dev"
```

Or add only common ignore entries:

```bash
npx a11y-shiftleft-cli init --gitignore
```

At minimum, keep generated reports and auth state out of Git:

```gitignore
reports/
.a11y-reports/
.a11y-auth/
playwright/.auth/
```

## Screenshots

Screenshots are useful for visual triage, but they can contain sensitive page
content. By default, common sensitive inputs are masked before capture:

- passwords
- emails
- phone numbers
- payment/card fields
- token and one-time-code fields
- address-like fields
- elements marked with `data-a11y-sensitive`, `data-a11y-redact`, or
  `data-private`

For private, authenticated, or production customer pages, disable screenshots:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --no-screenshots
```

Use raw screenshots only for local debugging and only when the data is safe:

```bash
npx a11y-shiftleft-cli audit \
  --url $APP_URL \
  --out reports \
  --no-screenshot-redaction
```

## Authenticated Pages

Create auth state with a test account whenever possible:

```bash
npx a11y-shiftleft-cli auth login --url https://example.com/login
```

Do not commit storage-state files. They may contain cookies or session tokens.
For CI, prefer short-lived test accounts and CI secrets. If this is not safe
yet, run authenticated scans locally and keep CI focused on public, staging, or
preview pages.

## Baseline Files

`.a11y-baseline.json` is different from report output. It may be committed when
the team intentionally accepts the current known findings:

```bash
npx a11y-shiftleft-cli check \
  --dynamic \
  --url $APP_URL \
  --out reports \
  --update-baseline

git add .a11y-baseline.json
git commit -m "Add accessibility baseline"
```

Do not refresh the baseline just to make CI pass. Treat baseline updates as
reviewed technical-debt decisions.

## Sharing Reports

Before sharing externally:

- Prefer `--no-screenshots` for private pages.
- Review any screenshot-based report manually.
- Remove query strings, tokens, private preview URLs, and local absolute paths.
- Share the smallest useful evidence set.
- Delete shared artifacts when the review ends.

For safer offline sharing, create a sanitized export:

```bash
npx a11y-shiftleft-cli share prepare \
  --report reports/a11y-report.json \
  --out a11y-share
```

This does not publish anything. It creates sanitized local files for review.
See [Report Sharing](../report-sharing.md) for the full sharing workflow.

## Quick Decision Guide

| Situation | Recommended command |
|---|---|
| Public preview page | `npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open` |
| Private or customer page | `npx a11y-shiftleft-cli audit --url $APP_URL --out reports --no-screenshots` |
| CI report-only rollout | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate report-only` |
| External sharing | `npx a11y-shiftleft-cli share prepare --report reports/a11y-report.json --out a11y-share` |
| Existing-project baseline | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --update-baseline` |
