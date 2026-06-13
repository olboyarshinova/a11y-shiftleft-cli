# Adoption Strategy

This document captures practical adoption and distribution ideas for
`a11y-shiftleft-cli`. The goal is to reduce setup friction, meet developers in
their existing workflows, and build credible public evidence without relying on
channels that are unlikely to accept external contributions today.

## Positioning

`a11y-shiftleft-cli` should be positioned as an orchestration layer rather than
a replacement for existing tools.

- If a project already uses ESLint accessibility rules, the CLI adds dynamic
  rendered-DOM checks, deduplication, WCAG metadata, page risk ranking, and
  reports.
- If a project already uses Playwright, the CLI offers a package-level
  accessibility scan without requiring teams to write custom test code first.
- If a project already uses GitHub Actions, the CLI can generate or provide a
  reusable accessibility workflow.

## Near-Term Adoption Channels

### One-Line npm Scripts

The lowest-friction path is a package script that teams can paste into an
existing project:

```json
{
  "scripts": {
    "test:a11y": "a11y-shiftleft check --url http://localhost:3000 --fail-on warning",
    "ci": "npm test && npm run test:a11y"
  }
}
```

Recommended documentation angle:

```txt
Add accessibility checks to CI in one npm script.
```

### GitHub Actions Generator

The built-in generator should remain the primary adoption path:

```bash
npx a11y-shiftleft ci \
  --url http://localhost:4200 http://localhost:4200/favorites \
  --start-command "npm run dev -- --host localhost --port 4200" \
  --fail-on warning \
  --standard section508
```

This is more reliable than asking users to hand-write workflow YAML.

### Documentation Website

Create a small documentation website with copy-paste paths for common use
cases:

- 30 seconds to start
- React/Vite setup
- Angular setup
- Vue setup
- Next.js setup
- GitHub Actions setup
- ADA Title II support mode
- Section 508 support mode
- Reading JSON/CSV/Markdown reports
- Troubleshooting Node, Playwright, and npm auth issues

### Demo Repository

Create at least one public demo repository that shows the tool working in a
real pull request flow:

- an intentionally imperfect Angular, React, or Vue app
- a pull request where `a11y-shiftleft-cli` reports accessibility findings
- a follow-up pull request where the same findings are fixed
- generated JSON, CSV, and Markdown reports committed as sample artifacts
- GitHub Actions run showing the CI result

The demo repository should make the value visible without requiring users to
clone the main CLI project.

Start with the ready React/Vite template in
[`../examples/demo-react-vite`](../examples/demo-react-vite), then move it into
a dedicated public repository once the before/after flow is ready.

Use [demo-pr-playbook-v0.4.0.md](demo-pr-playbook-v0.4.0.md) as the first
repeatable script for creating a public before/after pull request flow.
Use [case-study-template-v0.4.0.md](case-study-template-v0.4.0.md) to turn that
flow into a publishable engineering case study.

### Before/After Case Study

Publish a short case study from the demo app or a consenting real project:

| Before | After |
|---|---|
| Hundreds of findings across pages | Small number of remaining issues |
| No page-level accessibility risk ranking | Top affected pages identified |
| No CI accessibility gate | Pull request feedback generated automatically |
| Automated-only scan | Manual-review checklist generated for follow-up |

This should be written as engineering evidence, not marketing copy.

### Copy-Paste Recipes

Keep short recipes for common adoption scenarios:

- `docs/recipes/angular.md`
- `docs/recipes/react-vite.md`
- `docs/recipes/vue-vite.md`
- `docs/recipes/nextjs.md`
- `docs/recipes/github-actions.md`
- `docs/recipes/section-508.md`

Each recipe should include three commands or fewer, one minimal config, and one
example report excerpt.

### README Trust Signals

Keep first-screen trust signals current:

- npm version badge
- npm downloads badge
- CI status badge
- license badge
- TypeScript badge
- WCAG 2.2 AA support note

Badges should support quick trust-building, not replace clear documentation.

## Medium-Term Adoption Channels

### Doctor Command

Add a troubleshooting command:

```bash
npx a11y-shiftleft doctor
```

It should check:

- Node version
- package version
- Playwright package availability
- Chromium browser installation
- whether the target URL is reachable
- config file presence
- likely CI environment

This reduces first-run friction for new users and gives maintainers better bug
reports.

### GitHub Marketplace Action

Create a dedicated GitHub Action wrapper after the CLI workflow stabilizes:

```yaml
- uses: olboyarshinova/a11y-shiftleft-action@v1
  with:
    url: http://localhost:4200
    standard: section508
    fail-on: warning
```

This can make PR comments visible to the whole team and give the project a
more viral discovery path.

### Reusable Workflow

Offer a reusable workflow for organizations that prefer centralized CI logic:

```yaml
jobs:
  a11y:
    uses: olboyarshinova/a11y-shiftleft-cli/.github/workflows/a11y-reusable.yml@v1
    with:
      url: http://localhost:4200
      standard: section508
```

### Framework Guides

Do not frame Create React App as a primary growth channel because it is
deprecated. Keep a legacy CRA guide only for existing applications.

For Next.js, prefer package scripts or GitHub Actions examples instead of a
`next.config.js` build hook. A reliable pattern is:

```json
{
  "scripts": {
    "start:a11y": "next start -p 3000",
    "test:a11y": "a11y-shiftleft check --url http://localhost:3000"
  }
}
```

In CI, build and start the app before running the CLI.

### Community Surfaces

Keep GitHub issue templates and add discussions after the first external users
appear:

- bug report
- feature request
- good first issue
- framework support request
- accessibility rule mapping request
- adoption story
- pull request template with testing, docs, report, and privacy checklists
- show and tell discussion category
- research validation discussion category

Maintain a small backlog of `good first issue` tasks with clear files,
acceptance criteria, and test expectations. These issues should help new
contributors make a first pull request without needing product or architecture
context. Useful starter areas include WCAG metadata, remediation hints, docs,
fixtures, and report wording.

An `adoption story` template is especially useful because public user reports
can become credible evidence for future grant, academic, or product validation
materials.

### Engineering Blog Topics

Publish short technical posts based on real findings:

- Adding accessibility checks to CI in one npm script
- Reducing hundreds of accessibility findings to a small actionable set
- Static vs dynamic accessibility checks in frontend projects
- Why automated accessibility requires a manual-review checklist
- Mapping automated findings to WCAG 2.2 AA, ADA Title II, and Section 508

Each post should include commands, screenshots or report excerpts, and a link to
a reproducible repository.

### External Pull Requests

Open small pull requests against selected open-source frontend projects:

- add `a11y-shiftleft-cli` to an existing CI workflow
- include one or two real accessibility fixes
- avoid broad claims or pressure for endorsement
- ask maintainers whether the workflow/report format is useful

External pull requests can create stronger evidence than raw npm downloads
because they show real-world use, maintainer review, and reproducible outcomes.

### Resource Index

Maintain an accessibility shift-left resource index in the documentation:

- related tools
- migration notes from existing tools
- WCAG resources
- Section 508 resources
- ADA Title II digital accessibility resources
- empirical accessibility testing papers

This can improve search visibility while also helping users understand where
the CLI fits.

## Long-Term Ecosystem Bets

### Official GitHub Starter Workflows

Adding an accessibility workflow to `actions/starter-workflows` would be
valuable, but it should not be treated as a near-term plan because the official
repository currently states that it is not accepting contributions.

Revisit this only after there is adoption evidence:

- npm downloads
- GitHub stars
- real-world usage examples
- public case study
- reusable action or workflow
- clear docs site

### Anchor Users

Target maintainers and organizations already associated with frontend
accessibility:

- Storybook accessibility addon ecosystem
- MUI
- Fluent UI
- Netlify ecosystem
- Vercel/Next.js community examples

Outreach should offer a small, ready-to-review integration rather than asking
for broad endorsement.

Example:

```txt
Hi! I maintain a11y-shiftleft-cli, an accessibility CI orchestrator that works
across web frameworks and combines static checks, axe/Playwright dynamic scans,
deduplication, WCAG metadata, and PR-ready reports.

I noticed your project already invests in accessibility. I prepared a small
CI example showing how to add automated accessibility evidence to pull
requests with minimal maintenance burden. Would you be open to reviewing it?
```

## What Not To Promise

- Do not claim ADA, Section 508, or WCAG certification.
- Do not claim automated tooling finds every accessibility defect.
- Do not pitch official GitHub starter workflow inclusion as likely before
  adoption evidence exists.
- Do not suggest unsupported framework hooks such as `next.config.js`
  `afterBuild`.

## Success Metrics

- npm downloads and version adoption
- npm website download snapshots recorded with date, source, and screenshots
- weekly multi-package adoption snapshots uploaded as GitHub Actions artifacts
- GitHub stars and forks
- number of projects using generated workflows
- PR comments generated by the tool
- issues opened by external users
- pull requests opened from `good first issue` tasks
- independent blog posts, tutorials, or mentions
- external recommendation letters or testimonials
