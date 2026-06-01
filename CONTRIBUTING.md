# Contributing

Thank you for considering a contribution to `a11y-shiftleft-cli`.

## Development Setup

```bash
nvm use
npm install
npx playwright install chromium
```

Run the core checks:

```bash
npm test
npm run test:fixtures
npm run build:demo
npm pack --dry-run
```

## Project Scope

Good first contributions:

- Additional WCAG rule mappings.
- More fixture cases for React, Vue, or Angular.
- Report formatting improvements.
- CI workflow hardening.
- Documentation for real-world integrations.

Out of scope for the MVP:

- Custom AST parsers.
- Machine-learning triage.
- IDE extensions.
- SaaS dashboards.
- Legal compliance certification claims.

## Pull Request Checklist

- Add or update tests for behavior changes.
- Keep generated reports out of commits.
- Do not commit local absolute paths or machine-specific files.
- Run `npm test` and `npm run test:fixtures`.
- Update README or docs when user-facing behavior changes.

## Accessibility Findings

Automated accessibility checks are not a full WCAG conformance audit. Please
avoid wording that implies legal certification or complete accessibility
coverage.
