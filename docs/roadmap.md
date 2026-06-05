# Roadmap

This roadmap keeps the project focused on practical shift-left accessibility
orchestration. The CLI should stay framework-agnostic, npm-first, and suitable
for reproducible empirical validation.

## Near Term

- Expand WCAG metadata for every rule currently emitted by the static and
  dynamic adapters.
- Expand remediation hint coverage for additional axe and ESLint rules.
- Improve Vue and Angular static coverage while continuing to rely on
  established ESLint plugins rather than custom parsers.

## Mid Term

- Add deeper framework-specific remediation examples for common React, Vue, and
  Angular issues.
- Add compliance-support presets for WCAG-based legal workflows:
  `--standard ada-title-ii`, `--standard section508`, and `--standard wcag22-aa`.
- Add report metadata that records the selected standard, WCAG version, WCAG
  level, automated coverage limits, and manual-review requirement.
- Add a legal-safe report disclaimer explaining that the CLI supports
  accessibility risk detection and remediation tracking but does not certify
  ADA, Section 508, or WCAG conformance.

## Later

- Add a Lighthouse adapter for accessibility score collection and comparison
  with axe findings.
- Compare axe and Lighthouse disagreements in a separate report section.
- Explore VPAT/evidence-binder export templates for organizations that need
  Section 508 procurement documentation, while keeping legal review outside the
  CLI scope.

## Non-Goals

- No WCAG conformance certification claim.
- No ADA or Section 508 legal compliance certification claim.
- No custom AST compiler.
- No ML-based triage.
- No SaaS authorization or hosted dashboard.
