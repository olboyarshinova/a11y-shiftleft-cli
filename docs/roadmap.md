# Roadmap

This roadmap keeps the project focused on practical shift-left accessibility
orchestration. The CLI should stay framework-agnostic, npm-first, and suitable
for reproducible empirical validation.

## Near Term

- Expand WCAG metadata for every rule currently emitted by the static and
  dynamic adapters.
- Add semi-automated review output with a Markdown manual QA checklist for
  items automated tools cannot reliably validate.
- Add `wcagVersion` support for `2.0`, `2.1`, and `2.2` in filtering and
  reporting.
- Improve Vue and Angular static coverage while continuing to rely on
  established ESLint plugins rather than custom parsers.

## Mid Term

- Add `--crawl` for bounded same-origin URL discovery with maximum depth and
  page limits.
- Rank scanned pages by finding count and severity so teams can identify the
  highest-risk routes first.
- Add framework-specific remediation examples for common React and Vue issues.

## Later

- Add a Lighthouse adapter for accessibility score collection and comparison
  with axe findings.
- Compare axe and Lighthouse disagreements in a separate report section.

## Non-Goals

- No WCAG conformance certification claim.
- No custom AST compiler.
- No ML-based triage in the MVP.
- No SaaS authorization or hosted dashboard.
