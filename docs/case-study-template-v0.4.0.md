# Case Study Template: v0.4.0 Demo Adoption

This template turns the demo PR playbook into a short publishable case study.
Use it after creating public before/after pull requests.

## Title

Adding Accessibility CI To A React/Vite Project With `a11y-shiftleft-cli`

## Context

The project is a small React/Vite frontend. The goal was to add reproducible
accessibility checks to the pull request workflow without binding the workflow
to a single frontend framework.

The demo uses:

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/react
npx a11y-shiftleft init --framework react
```

## Baseline

The baseline demo intentionally includes accessibility defects that automated
tools can detect:

| Seeded Issue | Example Location | Why It Matters |
|---|---|---|
| Missing accessible label | Newsletter email input | Users of assistive technology need a programmatic name for form controls. |
| Missing image alternative text | Sample chart image | Informative images need text alternatives. |
| Low contrast text | Export report button | Text needs sufficient contrast against its background. |
| Icon-only button with no accessible name | Round arrow button | Icon-only controls need an accessible name. |

## Intervention

The intervention added a CI-friendly accessibility workflow:

```bash
npx a11y-shiftleft doctor --framework react --url http://localhost:3000
npx a11y-shiftleft check --url http://localhost:3000 --framework react --out reports --fail-on none
```

The generated report artifacts were:

```txt
reports/a11y-report.json
reports/a11y-metrics.csv
reports/a11y-comment.md
```

## Before/After Results

Fill this table after running PR 1 and PR 2.

| Metric | Before | After |
|---|---:|---:|
| Total findings | TBD | TBD |
| Critical | TBD | TBD |
| Warning | TBD | TBD |
| Info | TBD | TBD |
| Duplicates removed | TBD | TBD |
| Pages scanned | TBD | TBD |

## Developer Workflow

Pull request 1 should demonstrate visibility:

- install CLI and React adapter
- add `.a11y-shiftleft.json`
- add GitHub Actions workflow
- upload generated reports
- comment or summarize findings in the PR

Pull request 2 should demonstrate remediation:

- add explicit form labels
- add image alt text
- improve button contrast
- add accessible names to icon-only controls
- re-run the same workflow and compare metrics

## Evidence Links

Replace these placeholders with public links.

| Evidence | Link |
|---|---|
| PR 1: Add Accessibility CI | TBD |
| PR 2: Fix Accessibility Findings | TBD |
| GitHub Actions run | TBD |
| Before report artifact | TBD |
| After report artifact | TBD |
| Demo repository | TBD |

## Findings

Use this section for measured outcomes only.

Example:

```txt
The workflow reduced automated findings from TBD to TBD across one scanned URL.
The report also documented remaining manual review needs.
```

## Limitations

- Automated checks do not find every accessibility issue.
- This workflow does not certify WCAG, ADA, or Section 508 compliance.
- Manual keyboard testing, screen reader smoke checks, and content review remain
  necessary.
- npm downloads and GitHub views should be treated as adoption telemetry, not as
  proof of individual human usage.

## Reusable Promotion Copy

```txt
I added accessibility CI to a React/Vite demo using `a11y-shiftleft-cli` v0.4.0
and `@a11y-shiftleft/react`. The workflow runs static and dynamic checks,
deduplicates findings, and produces JSON, CSV, and Markdown reports that can be
reviewed in pull requests.
```
