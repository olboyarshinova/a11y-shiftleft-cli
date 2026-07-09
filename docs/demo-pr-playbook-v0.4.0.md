# Demo PR Playbook: v0.4.0

This playbook describes how to turn the published v0.4.0 release into a public
demo pull request flow. The goal is to show practical adoption, not to claim
full WCAG conformance.

## Demo Goal

Create a small public repository or branch that demonstrates:

- installing `a11y-shiftleft-cli` plus one framework adapter
- running `doctor`
- generating accessibility reports in CI
- showing findings in one pull request
- fixing the findings in a follow-up pull request

Recommended first target: React/Vite, because the current adapter package and
demo assets are already stable.

You can start from the ready template in
[`../examples/demo-react-vite`](../examples/demo-react-vite), then move it into
a dedicated public repository when the before/after flow is ready.

## Repository Shape

If you use the template, the repository shape is already prepared. If you build
the demo manually, use this structure:

```txt
a11y-shiftleft-demo-react/
  package.json
  src/
    App.jsx
    main.jsx
  .a11y-shiftleft.json
  .github/
    workflows/
      a11y.yml
  reports-sample/
    before/
      a11y-report.json
      a11y-comment.md
    after/
      a11y-report.json
      a11y-comment.md
```

Keep sample reports small and clearly labeled as examples. Do not commit local
machine paths or npm tokens.

## PR 1: Add Accessibility CI

Branch:

```bash
git checkout -b add-a11y-ci
```

Install:

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/react
npx playwright install chromium
npx a11y-shiftleft init --framework react
```

Add package scripts:

```json
{
  "scripts": {
    "start:a11y": "vite --host localhost --port 3000",
    "doctor:a11y": "a11y-shiftleft doctor --framework react --url http://localhost:3000",
    "test:a11y": "a11y-shiftleft check --url http://localhost:3000 --framework react --out reports --fail-on none"
  }
}
```

Generate workflow:

```bash
npx a11y-shiftleft generate-ci \
  --url http://localhost:3000 \
  --start-command "npm run start:a11y" \
  --fail-on none
```

Run locally:

```bash
npm run start:a11y
npm run doctor:a11y
npm run test:a11y
```

Expected PR description:

```md
## Summary

Adds accessibility CI using `a11y-shiftleft-cli` v0.4.0 and
`@a11y-shiftleft/react`.

## What This Demonstrates

- Framework-aware setup with `init --framework react`
- Adapter package install via `@a11y-shiftleft/react`
- Dynamic axe/Playwright scan through the CLI
- PR-ready JSON, CSV, and Markdown reports

## Current Result

The initial report intentionally contains accessibility findings. This PR does
not claim WCAG conformance; it creates reproducible evidence for remediation.
```

## PR 2: Fix Reported Findings

Branch:

```bash
git checkout -b fix-a11y-findings
```

Fix the reported issues. Good demo fixes:

- add missing `alt` text to informative images
- add one visible `<h1>`
- improve low-contrast text
- add `type="button"` to non-submit buttons
- ensure form controls have visible labels

Run the same check:

```bash
npm run test:a11y
```

Expected PR description:

```md
## Summary

Fixes the accessibility findings reported by the previous accessibility CI PR.

## Before/After

| Metric | Before | After |
|---|---:|---:|
| Total findings | TBD | TBD |
| Critical | TBD | TBD |
| Warning | TBD | TBD |
| Info | TBD | TBD |

## Notes

Automated checks cover only part of accessibility review. Manual keyboard and
screen reader smoke checks are still required.
```

## Evidence To Capture

- Link to PR 1
- Link to PR 2
- GitHub Actions run URL
- `reports/a11y-comment.md` before fixes
- `reports/a11y-comment.md` after fixes
- screenshot of the PR report comment if available
- short notes on manual review that remains

After the two pull requests are complete, summarize the result with
[case-study-template-v0.4.0.md](case-study-template-v0.4.0.md).

## Promotion Copy

```txt
I published a small demo showing how `a11y-shiftleft-cli` v0.4.0 fits into a
real pull request workflow: install one framework adapter, run accessibility CI,
review findings, and track fixes with reproducible reports.
```

## Guardrails

- Do not claim ADA, Section 508, or WCAG certification.
- Do not claim automated checks find every accessibility issue.
- Do not commit local paths, npm tokens, OTP codes, or private screenshots.
- Keep the demo scoped to developer workflow and reproducible evidence.
