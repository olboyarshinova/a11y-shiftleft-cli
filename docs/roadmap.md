# Roadmap

This roadmap keeps the project focused on practical shift-left accessibility
orchestration. The CLI should stay framework-agnostic, npm-first, and suitable
for reproducible empirical validation.

## Near Term

- Expand WCAG metadata for every rule currently emitted by the static and
  dynamic adapters.
- Improve Vue and Angular static coverage while continuing to rely on
  established ESLint plugins rather than custom parsers.
- Add page-level ranking in reports so teams can identify the highest-risk
  routes first.

## Mid Term

- Add framework-specific remediation examples for common React and Vue issues.

## Later

- Add a Lighthouse adapter for accessibility score collection and comparison
  with axe findings.
- Compare axe and Lighthouse disagreements in a separate report section.

## Non-Goals

- No WCAG conformance certification claim.
- No custom AST compiler.
- No ML-based triage.
- No SaaS authorization or hosted dashboard.
