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

## Planned Sanitized Export

A future local `share prepare` workflow will create a separate sanitized static
report. It will be offline by default and will not publish anything. The export
will exclude screenshots, absolute paths, query strings, form values, tokens,
and raw HTML unless the user explicitly allows individual fields.

Any later public-link integration must remain opt-in and provide an expiration
date, an unguessable URL, revocation, deletion, a pre-upload privacy summary,
and an explicit confirmation step. Public hosting will be optional and will not
be required for CLI checks, CI, dashboards, or local reports.
