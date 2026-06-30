# a11y-shiftleft React/Vite Demo

This standalone demo shows how to use `a11y-shiftleft-cli` in a small
React/Vite project. It intentionally includes a few accessibility issues so the
CLI can generate real JSON, CSV, and Markdown reports.

Use this directory as a template for a public demo repository or before/after
pull request flow.

## What It Demonstrates

- installing the CLI plus the React adapter package
- running `doctor` before a scan
- scanning a running Vite app with axe/Playwright
- exploring a stateful modal with screenshots and `exploration.html`
- generating Markdown, JSON, CSV, and visual reports in `reports/`
- running the same scan in GitHub Actions

## Run Locally

```bash
npm install
npx playwright install chromium
npm run start:a11y
```

In another terminal:

```bash
npm run doctor:a11y
npm run test:a11y
a11y-shiftleft explore --url http://localhost:3000 --framework react --out reports --fail-on none
```

Open the generated report:

```bash
open reports/a11y-comment.md
```

## Expected Seeded Findings

The demo page intentionally includes examples such as:

- an image without alternative text
- a form field without a visible label
- a low-contrast button
- an icon-only button without an accessible name
- a modal state with intentionally missing dialog/button/input accessibility
  metadata for explore-mode screenshots

These are teaching examples, not production recommendations.

## What You Should See

After running the demo successfully, the `reports/` directory should contain
generated accessibility reports.

Expected output includes:

- `reports/a11y-comment.md` - a Markdown summary of the accessibility findings.
- `reports/exploration.html` - an interactive HTML report for exploring the
  scan results.

The demo intentionally includes accessibility defects so these reports contain
meaningful findings.

Do not commit the generated `reports/` directory to Git, as it contains
generated artifacts.

## Before/After PR Flow

1. Create PR 1 that adds this workflow and keeps the seeded issues.
2. Capture the generated report from CI.
3. Create PR 2 that fixes the findings.
4. Compare `reports/a11y-report.json` and `reports/a11y-metrics.csv` before
   and after.

For the full playbook, see
[`../../docs/demo-pr-playbook-v0.4.0.md`](../../docs/demo-pr-playbook-v0.4.0.md).

## Guardrails

- Do not claim WCAG, ADA, or Section 508 certification from automated results.
- Automated checks cover only part of accessibility review.
- Do not commit npm tokens, OTP codes, private screenshots, or local machine
  paths.
