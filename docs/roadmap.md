# Roadmap

This roadmap keeps the project focused on practical shift-left accessibility
orchestration. The CLI should work across web frameworks, stay npm-first, and
remain suitable for reproducible empirical validation.

## Version Targets

### 0.6.x Developer Workflow And Evidence Export

- Release the initial `watch` command so developers can keep accessibility
  reports refreshed while they code.
- Ship PDF export for `exploration.html` via `explore --pdf` and for the
  historical dashboard via `dashboard --pdf`. Treat PDF as an evidence-friendly,
  shareable audit artifact, not as legal certification.
- Keep PDF export local-first and dependency-light by reusing Playwright's
  browser rendering path where possible instead of adding a heavy PDF stack.
- Prototype issue-tracker export for Jira and Linear after `watch` is stable.
  The first step is `ticket export`: read `a11y-report.json`, group findings by
  rule/page/severity, and write dry-run Markdown/JSON ticket drafts. Later
  versions can create or update issues only when explicit tokens are provided.
- Keep Jira and Linear integrations optional so the core CLI stays useful
  without account setup, SaaS authorization, or extra installation weight.

### 0.7.x Keyboard Audit Mode

- Add a dedicated keyboard-only audit workflow, such as
  `a11y-shiftleft keyboard --url <url>`, that verifies whether key user
  interface states can be reached and operated without a mouse.
- Record a focus path by sending `Tab` and `Shift+Tab`, collecting the focused
  element selector, accessible name, role, visibility, bounding box, and page
  state after each step.
- Detect common keyboard blockers: invisible focus, focus loss to `body`,
  repeated focus loops, unreachable interactive controls, positive tabindex
  risks, and focus traps that do not expose an escape path.
- Exercise basic keyboard activation on safe controls with `Enter`, `Space`,
  `Escape`, and arrow keys where the role implies expected keyboard behavior,
  while reusing `explore` safe-mode blocks for destructive actions such as
  logout, delete, pay, upload, camera, microphone, and cookie changes.
- Write keyboard-specific artifacts, for example
  `keyboard-report.json`, `keyboard-path.md`, and optional annotated
  screenshots that show the focused element at each step.
- Surface keyboard findings in the same severity, WCAG, confidence, baseline,
  ignore, dashboard, and PR-report pipeline used by `check` and `explore`.
- Keep the first version bounded and predictable for pull requests: limit max
  tab steps, max states, and activation attempts, then recommend broader manual
  keyboard walkthroughs through `--semi-auto`.

### 0.8.x Comparative Scoring

- Add an optional Lighthouse integration, such as `check --with-lighthouse`,
  that records Lighthouse accessibility scores, audit details, documentation
  links, and relevant performance/accessibility recommendations in the same
  report pipeline.
- Compare axe and Lighthouse disagreements in a separate report section,
  include Lighthouse suggested fixes where useful, and surface the comparison in
  `exploration.html` and the local dashboard.

## Near Term

- Build on the practical review areas in the
  [MTS web accessibility guide](https://a11y.mts.ru/web) and
  [MTS testing guide](https://a11y.mts.ru/qa) without treating any single guide
  as a conformance standard. Keep WCAG as the normative mapping source.
- Prototype a bounded zoom and reflow audit that checks 200% browser zoom,
  narrow 320 CSS pixel layouts, horizontal overflow, clipped content, and
  overlapping fixed or sticky controls.
- Add media evidence summaries for captions, transcripts, autoplay controls,
  reduced-motion behavior, and flashing risk while keeping content quality in
  the manual checklist.
- Add an optional usability-test worksheet that records task completion,
  assistive technology and browser context, blockers, and remediation owners
  without collecting unnecessary personal information.
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
  report paths and troubleshooting context.
- Continue polishing readable local output after the initial `check` summary,
  `check --crawl` progress, and `explore` progress output, especially for
  watch and dashboard indexing while preserving plain output for CI and report
  files.
- Harden the initial `watch` command with clearer run-to-run deltas, better
  changed-file grouping, and guidance for mapping changed files to dynamic
  smoke-test URLs.
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
- Continue hardening report retention with optional detailed local-only preview
  output and clearer history-management UX for timestamped report runs.
- Continue expanding `exploration.html` from a static triage overview into a
  richer dashboard that can visualize checked pages/states, screenshots, and
  accessibility findings while the scan is running.
- Continue hardening screenshot annotations in `exploration.html`, including
  better selector matching, edge-case handling for full-page screenshots, and
  clearer overlay legends.
- Continue hardening the local `dashboard` command with richer historical
  metrics, better run filtering, and page-level comparisons across scans.
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
- Continue hardening `watch` for real-time development feedback: debounce file
  changes, rerun checks for changed files, rescan configured URLs, and update
  lightweight live report artifacts.
- Extend `watch` with affected-route hints so local terminal feedback can map
  changed files to a small dynamic smoke-test URL set before broader scans.
- Prototype a browser overlay mode after `watch` is stable, so local dev pages
  can highlight affected elements from accessibility findings without requiring
  a full browser extension.
- Explore a DevTools-style local inspection layer after the overlay prototype,
  reusing the same core report schema to show rule, severity, WCAG metadata,
  confidence, and suggested remediation next to affected DOM elements.
- Add progress output for long-running watch and dashboard indexing workflows,
  building on the initial `check --crawl` and `explore` progress summaries
  while keeping non-animated output available for CI.
- Add optional Jira and Linear export commands after the report schema is
  stable enough for external ticket sync. The first version should support
  dry-run previews, explicit credentials, duplicate detection, and redaction of
  sensitive report fields.

## Later

- Introduce optional AI-assisted remediation through a separate
  `@a11y-shiftleft/ai` package, following the privacy and safety rules in
  [ai-suggestions.md](ai-suggestions.md).
- Consider a separate `@a11y-shiftleft/browser` package for a Chrome extension
  or DevTools panel once CLI reports, live feedback, overlay behavior, and
  privacy controls are stable enough to justify a browser-specific project.
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
