# Promotion Draft: v0.4.0

## Short Post

`a11y-shiftleft-cli` v0.4.0 is published.

This release makes the tool easier to adopt in real frontend projects:

- install the CLI plus one framework adapter package
- choose a framework during setup with `init --framework`
- check local setup with `doctor`
- get adapter install guidance with `adapter add`
- keep static framework plugins lazy-loaded instead of forcing every project to
  install React, Vue, and Angular tooling

React example:

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/react
npx playwright install chromium
npx a11y-shiftleft init --framework react
npx a11y-shiftleft doctor --framework react
npx a11y-shiftleft check --url http://localhost:3000
```

The goal is not to replace axe, Playwright, or ESLint accessibility plugins. It
is to orchestrate static checks, dynamic scans, deduplication, WCAG metadata,
severity triage, and reproducible reports in one CI-friendly workflow.

## One-Line Announcement

`a11y-shiftleft-cli` v0.4.0 adds framework-aware setup and lightweight adapter
packages for React, Vue, and Angular.

## README/Social Snippet

```txt
CLI + one adapter:

npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/react
npx a11y-shiftleft init --framework react
npx a11y-shiftleft check --url http://localhost:3000
```

## Follow-Up Actions

- Add a demo pull request showing the CLI report before and after fixes.
- Use [demo-pr-playbook-v0.4.0.md](demo-pr-playbook-v0.4.0.md) to keep the
  demo reproducible and legally safe.
- Link to the relevant recipe docs for React/Vite, Vue/Vite, Angular, and
  Next.js.
- Re-run adoption snapshots after one week and one month.
- Avoid claiming WCAG, ADA, or Section 508 certification.
