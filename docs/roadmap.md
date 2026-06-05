# Roadmap

This roadmap keeps the project focused on practical shift-left accessibility
orchestration. The CLI should stay framework-agnostic, npm-first, and suitable
for reproducible empirical validation.

## Near Term

- Expand WCAG metadata for every rule currently emitted by the static and
  dynamic adapters.
- Expand remediation hint coverage for additional axe and ESLint rules.
- Expand compliance evidence summaries with manual-review follow-up details.
- Improve Vue and Angular static coverage while continuing to rely on
  established ESLint plugins rather than custom parsers.
- Keep the adoption plan in [adoption-strategy.md](adoption-strategy.md)
  aligned with current CLI capabilities and public documentation.
- Add copy-paste recipe docs for Angular, React/Vite, Vue/Vite, Next.js, GitHub
  Actions, and Section 508 workflows.
- Create issue templates for bugs, framework support requests, rule mapping
  requests, and adoption stories.

## Mid Term

- Add a `doctor` command that validates Node, Playwright, Chromium, target URL,
  config, and CI environment readiness.
- Add deeper framework-specific remediation examples for common React, Vue, and
  Angular issues.
- Create a documentation website with quick start guides, framework-specific
  setup pages, CI/compliance-support examples, troubleshooting, and sample
  reports so teams can adopt the CLI without reading the full README first.
- Package a dedicated GitHub Action wrapper after the generated workflow path is
  stable enough to support public Marketplace usage.
- Publish a public demo repository and before/after case study showing a full
  pull request workflow with findings, fixes, and generated reports.

## Later

- Add a Lighthouse adapter for accessibility score collection and comparison
  with axe findings.
- Compare axe and Lighthouse disagreements in a separate report section.
- Open selected external open-source pull requests after the docs, generated CI
  workflow, and sample reports are stable enough for maintainers to review.
- Explore VPAT/evidence-binder export templates for organizations that need
  Section 508 procurement documentation, while keeping legal review outside the
  CLI scope.

## Non-Goals

- No WCAG conformance certification claim.
- No ADA or Section 508 legal compliance certification claim.
- No custom AST compiler.
- No ML-based triage.
- No SaaS authorization or hosted dashboard.
