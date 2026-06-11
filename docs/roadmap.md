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
- Expand recipe docs with screenshots, generated report excerpts, and rollout
  guidance for early teams.
- Validate companion adapter package publishing and installation for React,
  Vue, and Angular.
- Stabilize zero-config `explore` mode for safe UI-state discovery, including
  screenshots and exploration graph artifacts.
- Continue hardening `explore` against state explosion with explicit depth and
  state limits, URL plus DOM accessibility fingerprints, and safer handling for
  repeated or equivalent UI states.
- Continue expanding CLI quality-of-life controls after the initial `check` and
  `explore` `--quiet`/`--verbose` support, especially around clearer
  skipped-check reasons, report paths, and troubleshooting context.
- Add readable severity output for local runs, including colorized critical,
  warning, and info labels while preserving plain output for CI and report
  files.
- Improve framework autodetection messaging so React, Vue, and Angular projects
  receive clear adapter install recommendations when optimized static checks are
  not available yet.
- Add GitHub Discussions categories after the first external users appear.

## Mid Term

- Add a `doctor` command that validates Node, Playwright, Chromium, target URL,
  config, and CI environment readiness.
- Add deeper framework-specific remediation examples for common React, Vue, and
  Angular issues.
- Continue treating executable config files as a later security-sensitive
  decision; JSON config discovery now covers `.a11y-shiftleft.json`,
  `.a11yrc.json`, and `package.json#a11y`.
- Continue hardening configurable safe-mode policies for `explore`, including
  clearer skip reporting and optional request blocking for external or
  high-risk API traffic.
- Add report retention settings for generated artifacts, such as maximum saved
  runs and maximum age in days, so local binary screenshots and old reports do
  not accumulate indefinitely.
- Add an HTML exploration dashboard that visualizes checked pages/states,
  screenshots, and accessibility findings while the scan is running.
- Add screenshot annotations in `exploration.html` by storing finding selector
  bounding boxes and rendering reviewable overlays instead of drawing directly
  into compressed screenshots.
- Add a local `dashboard` command that serves historical accessibility metrics
  from generated reports, including trend charts, top rules, and page-level
  comparisons across scans.
- Create a documentation website with quick start guides, framework-specific
  setup pages, CI/compliance-support examples, troubleshooting, and sample
  reports so teams can adopt the CLI without reading the full README first.
- Add a privacy section to the documentation website covering screenshot
  redaction, `--no-screenshots`, generated report directories, `.gitignore`
  setup, baseline files, and safe handling of local artifacts.
- Package a dedicated GitHub Action wrapper after the generated workflow path is
  stable enough to support public Marketplace usage.
- Add a `pr-comment` command for manual pull request feedback that can scan a
  provided preview URL, update an existing accessibility comment, and apply
  severity labels when GitHub credentials are available.
- Extend the GitHub Action wrapper with uploaded `exploration.html` artifacts,
  stable artifact links in PR comments, preview URL inputs, and optional
  severity labels.
- Publish a public demo repository and before/after case study showing a full
  pull request workflow with findings, fixes, and generated reports.
- Design read-only `--interactive` issue review with deterministic remediation
  hints and copy-paste snippets before introducing AI suggestions.
- Continue hardening scoped `a11y-ignore.json` support with clearer expiry
  reminders, stale-ignore cleanup guidance, and optional owner summaries.
- Add optional Git hook setup for Husky and Lefthook so staged accessibility
  checks can run before commits without becoming a hard dependency of the core
  CLI.
- Add incremental scan support for pull requests by prioritizing changed static
  files and a small configured set of dynamic smoke-test URLs before running
  broader scheduled scans.
- Add a `watch` command for real-time development feedback: debounce file
  changes, rerun static checks for changed files, rescan configured URLs, and
  update lightweight live report artifacts.
- Make `watch` compute run-to-run deltas so local terminal feedback can show
  fixed findings, new findings, and remaining findings after each debounced
  scan while refreshing `exploration.html` or a lightweight live report.
- Prototype a browser overlay mode after `watch` is stable, so local dev pages
  can highlight affected elements from accessibility findings without requiring
  a full browser extension.
- Add progress output for long-running crawl, explore, watch, and dashboard
  indexing workflows, while keeping non-animated output available for CI.

## Later

- Add an optional Lighthouse integration, such as `check --with-lighthouse`,
  that records Lighthouse accessibility scores, audit details, documentation
  links, and relevant performance/accessibility recommendations in the same
  report pipeline.
- Compare axe and Lighthouse disagreements in a separate report section,
  include Lighthouse suggested fixes where useful, and surface the comparison in
  `exploration.html` and the local dashboard.
- Introduce optional AI-assisted remediation through a separate
  `@a11y-shiftleft/ai` package, following the privacy and safety rules in
  [ai-suggestions.md](ai-suggestions.md).
- Consider a separate `@a11y-shiftleft/browser` package for Chrome extension or
  DevTools panel work once CLI reports, live feedback, and overlay behavior are
  stable enough to justify a browser-specific project.
- Open selected external open-source pull requests after the docs, generated CI
  workflow, and sample reports are stable enough for maintainers to review.
- Explore VPAT/evidence-binder export templates for organizations that need
  Section 508 procurement documentation, while keeping legal review outside the
  CLI scope.

## Non-Goals

- No WCAG conformance certification claim.
- No ADA or Section 508 legal compliance certification claim.
- No custom AST compiler.
- No ML-based triage in the core CLI.
- No automatic AI code changes in the core CLI.
- No browser extension bundled into the core CLI.
- No SaaS authorization or hosted dashboard.
