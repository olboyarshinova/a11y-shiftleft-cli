# v0.6.0 Release Notes

`a11y-shiftleft-cli` v0.6.0 focuses on developer workflow, portable evidence
artifacts, and easier open-source contribution.

## Highlights

- Added `watch` for local development feedback. It watches common source
  folders, reruns the existing check pipeline, refreshes reports, and prints
  fixed/new/remaining finding counts.
- Added `explore --pdf` to generate `reports/exploration.pdf` from the visual
  HTML exploration report.
- Added `dashboard --pdf` to generate a portable PDF copy of the historical
  dashboard.
- Added `ticket export` to create dry-run Jira, Linear, or generic ticket
  drafts from `a11y-report.json` without connecting to external tracker APIs.
- Added dedicated ticket export documentation with Markdown, JSON, Jira, and
  Linear examples.
- Improved contributor onboarding with issue templates, a pull request
  template, clearer `CONTRIBUTING.md`, and a seed script for five
  beginner-friendly `good first issue` tasks.
- Updated framework, CI, ADA Title II, and Section 508 recipes with clearer
  dev server URL guidance.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init --framework auto --gitignore
```

## Watch Mode

Run checks repeatedly while coding:

```bash
npx a11y-shiftleft watch --url http://localhost:5173 --out reports/watch
```

Use `--static` for faster lint-style feedback:

```bash
npx a11y-shiftleft watch --static --out reports/watch
```

## PDF Reports

Export the visual exploration report as PDF:

```bash
npx a11y-shiftleft explore --url http://localhost:5173 --depth 2 --pdf --out reports
```

Export the historical dashboard as PDF:

```bash
npx a11y-shiftleft dashboard --reports reports --pdf
```

PDF files are portable evidence artifacts for reviews, tickets, and internal
follow-up. They do not certify WCAG, ADA, or Section 508 compliance.

## Ticket Drafts

Create reviewable remediation ticket drafts:

```bash
npx a11y-shiftleft ticket export \
  --report reports/a11y-report.json \
  --tracker linear \
  --out reports/a11y-tickets.md
```

The first version is intentionally dry-run only. It groups findings by severity,
rule, page, and target, then writes Markdown or JSON for team review.

## Notes

- Generated PDFs and ticket drafts should usually stay out of git.
- `ticket export` does not require Jira or Linear tokens.
- The default local Node on some machines may still be old. Use Node.js 22 for
  contributor workflows:

```bash
nvm use 22
```
