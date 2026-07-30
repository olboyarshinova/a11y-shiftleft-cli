# v1.0.0 Release Notes (Draft)

`a11y-shiftleft-cli` v1.0.0 is planned as the first stable release for the
local, developer-friendly accessibility review workflow. The release should keep
the command surface stable, focus on reproducible evidence, and avoid adding new
large features before publication.

## Release Positioning

Use this wording for the 1.0 release:

- A local CLI for WCAG-oriented accessibility evidence, visual browser audits,
  pull-request checks, and review handoff packages.
- Built for developers who need clear findings, screenshots, keyboard evidence,
  manual-review prompts, and CI-friendly output before issues reach users.
- Reports can support ADA, Section 508, and EN 301 549-oriented reviews through
  explicit standards presets, but they do not certify legal compliance.

Do not describe 1.0 as a WCAG, ADA, Section 508, EN 301 549, EAA, or VPAT
certification tool.

## Stable Command Surface

These commands should be treated as the public 1.0 workflow:

| Command | Stable use |
|---|---|
| `audit` | Full local visual audit with browser exploration, screenshots, keyboard evidence, manual checklist, JSON, and Markdown. |
| `check` | Fast CI/PR check with quality gates, baselines, retest comparison, and compact reports. |
| `explore` | Focused visual exploration when a reviewer wants state discovery without the full audit bundle. |
| `setup` | Guided project setup for npm scripts, config, `.gitignore`, and CI workflow files. |
| `generate-ci` | Regenerate CI workflow files without changing the rest of the project setup. |
| `agent run` | Run an audit and produce local next-step guidance from the generated evidence. |
| `agent review` | Review an existing report and summarize next actions without rescanning. |
| `evidence export` | Export machine-readable finding evidence for scripts, studies, or external review. |
| `evidence pack` | Copy report artifacts into a local checksummed handoff package. |
| `evidence verify` | Recheck package checksums, privacy notes, review hints, and journey summaries before sharing. |
| `ticket export` | Create grouped Jira, Linear, or GitHub issue drafts from a report. |
| `doctor` | Diagnose setup, browser, URL, and dependency problems. |

## Included In 1.0

- Visual HTML reports with annotated screenshots, grouped findings, WCAG labels,
  keyboard evidence, and practical fix guidance.
- Safe dynamic browser exploration for rendered pages, SPAs, modals, and
  discovered UI states.
- Fast CI checks for pull requests, including baseline and retest workflows.
- Optional source-code adapters for React, Vue, and Angular.
- Keyboard traversal evidence, focus-order summaries, and manual-review
  checklist rows for criteria automation cannot prove.
- Lighthouse, device, and browser comparison paths when the optional engines are
  installed.
- Local evidence export, evidence packaging, checksum verification, and ticket
  draft workflows.
- Privacy controls: local reports by default, sensitive field masking,
  `--no-screenshots`, `--hide-elements`, and authenticated-page recipes.

## Not Included In 1.0

- Legal compliance certification.
- A replacement for manual screen-reader testing with VoiceOver, NVDA, or JAWS.
- A native mobile app audit.
- A hosted SaaS dashboard.
- Core AI auto-fix behavior. AI suggestions should remain a future optional
  package or integration.
- One-click tracker creation against Jira, Linear, or GitHub APIs. 1.0 should
  keep ticket output as local drafts unless an integration is explicitly added
  and documented later.

## Release Validation Checklist

Before publishing 1.0, complete this checklist:

- Run `npm test`.
- Run `npm pack --dry-run`.
- Run a demo audit and confirm `reports/a11y-report.html` opens and shows
  screenshots, grouped findings, Audit Coverage, and keyboard evidence.
- Run a clean-project smoke test with the published package name:
  `npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open`.
- Verify README commands for `audit`, `check`, `setup`, `generate-ci`,
  authenticated pages, standards presets, and evidence commands.
- Confirm `.gitignore` guidance still excludes report artifacts by default.
- Confirm release notes and package metadata do not overclaim compliance.

## Suggested Upgrade Command

```bash
npm install --save-dev a11y-shiftleft-cli@1.0.0
npx playwright install chromium
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open
```

## After 1.0

- Documentation website with clearer onboarding, privacy guidance, and examples.
- GitHub Action Marketplace wrapper for simpler PR adoption.
- Optional AI suggestion package that does not send code to third-party services
  unless explicitly configured.
- More real-world validation data and case studies.
- More standards-oriented recipes for teams preparing ADA, Section 508,
  EN 301 549, EAA, VPAT, and procurement evidence.
