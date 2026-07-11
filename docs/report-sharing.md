# Report Sharing

Accessibility reports can contain screenshots, DOM selectors, page URLs, source
paths, and product details. Treat them as development artifacts, not as content
that is automatically safe to publish.

## Share Through GitHub Actions

Generated pull request workflows upload the report directory as the
`a11y-report` artifact. The accessibility PR comment links to the exact workflow
run where team members can download it. Access and retention follow the
repository's GitHub Actions settings.

This is the recommended sharing path today. It does not upload reports to an
a11y-shiftleft service or create an unlisted public URL.

## Before Sharing Externally

- Prefer reports generated with `--no-screenshots` for authenticated, payment,
  health, account, or personal-data pages.
- Review screenshots even when automatic input redaction is enabled.
- Remove absolute source paths, query parameters, tokens, form values, and
  private preview URLs.
- Keep generated report directories out of Git.
- Share the smallest useful evidence set and remove it when the review ends.

## Sanitized Local Export

Use `share prepare` to create a separate sanitized static report. It is offline
by default and does not publish anything:

```bash
npx a11y-shiftleft-cli share prepare \
  --report reports/a11y-report.json \
  --out a11y-share
```

The first local export writes:

```txt
a11y-share/share-report.json
a11y-share/share-evaluation-scope.json  # when evaluation-scope.json exists
a11y-share/share-summary.md
a11y-share/privacy-summary.json
```

The export excludes screenshots, visual HTML/PDF reports, raw exploration
graphs, raw keyboard data, and raw Lighthouse payloads. It removes URL query
strings and hashes, redacts obvious local absolute paths, and redacts common
email, bearer-token, password, secret, token, and API-key patterns. Review the
privacy summary and generated report before sharing externally.

When the source report directory contains `evaluation-scope.json`, the export
also writes a sanitized `share-evaluation-scope.json`. This preserves the
WCAG-EM-inspired review scope without including screenshots or raw browser
evidence. The Markdown `share-summary.md` also includes a compact sanitized
scope table so reviewers can understand what was included without opening JSON.

## One-File Visual HTML

If screenshots are approved for sharing, add `--include-html`:

```bash
npx a11y-shiftleft-cli share prepare \
  --report reports/a11y-report.json \
  --out a11y-share \
  --include-html
```

This writes `a11y-share/share-report.html` as a self-contained HTML file. Local
report screenshots are embedded into the file, so the recipient does not need a
separate `screenshots/` folder. Review this file carefully before sending it,
especially for authenticated pages, payment flows, account pages, health data,
or any report that may contain personal information.

Future versions can add explicit allow flags for teams that intentionally need
specific visual evidence or additional fields.

Any later public-link integration must remain opt-in and provide an expiration
date, an unguessable URL, revocation, deletion, a pre-upload privacy summary,
and an explicit confirmation step. Public hosting will be optional and will not
be required for CLI checks, CI, dashboards, or local reports.
