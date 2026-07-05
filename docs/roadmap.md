# Roadmap

This roadmap tracks future work only. Completed capabilities belong in release
notes and the changelog, not in the active plan.

The project remains focused on practical shift-left accessibility orchestration:
framework-aware setup, browser evidence, reproducible reports, privacy-conscious
sharing, and developer-friendly triage without claiming full WCAG, ADA, or
Section 508 certification.

## Near Term

- Promote planned journey matches into a richer journey-review workflow where a
  reviewer can confirm every step, record missing states, and attach manual
  task-completion evidence.
- Add cross-page consistency analysis for repeated navigation, help mechanisms,
  page titles, and same-purpose control names. Surface differences for review
  rather than asserting that every difference is a WCAG failure.
- Add repeated-component counts and affected-page counts to user-impact
  summaries so teams can distinguish one shared component fix from many local
  page fixes.
- Add remediation effort estimates such as `small`, `medium`, and `large`
  based on rule family, affected components, journey impact, and whether the fix
  is local, shared, or architectural.
- Add report grouping controls for rule, page/state, affected element, WCAG
  criterion, and POUR principle while preserving root-cause grouping.
- Extend readiness controls beyond a fixed delay with bounded declarative
  conditions such as selector visible/hidden and URL or path reached.
- Validate structured manual-review records in real keyboard-only, screen
  reader, zoom, reflow, reduced-motion, cognitive, and task-flow reviews.
- Validate remediation ownership and temporary-acceptance review dates in real
  pull request and retest workflows.
- Validate evidence packages across automated scans, manual reviews, keyboard
  audits, visual exploration, and retest history before adding archive export.

## Coverage Expansion

- Build on practical review areas in the
  [MTS web accessibility guide](https://a11y.mts.ru/web) and
  [MTS testing guide](https://a11y.mts.ru/qa) without treating any single guide
  as a conformance standard. WCAG remains the normative mapping source.
- Extend reflow evidence with explicit 200%/400% zoom checks and overlapping
  fixed or sticky control checks.
- Add cross-browser audit evidence. Record the browser engine and version in
  every report first, then add `--browser chromium|firefox|webkit`, and later a
  bounded full-audit profile that compares Chromium, Firefox, and WebKit while
  clearly labeling browser-specific differences for manual review.
- Extend modal checks with additional close, cancel, successful-completion, and
  non-modal dialog paths.
- Extend live-region evidence with validation-error and loading-state
  correlation while continuing to require screen-reader confirmation.
- Extend alternative-text quality evidence with contextual figure/caption and
  complex-image review.
- Extend rendered form evidence with safe validation-state correlation and
  non-sensitive correction workflows that never submit data.
- Add safe diagnostics for unexpected context changes on focus or input while
  blocking navigation, submission, downloads, and other destructive effects by
  default.
- Add assisted checks for hover/focus content: whether it can be dismissed,
  remains available while hovered, and persists long enough to inspect.
- Extend media evidence with isolated reduced-motion behavior comparison.
  Caption quality, audio description, and flashing risk remain manual-review
  work.
- Extend embedded-content and canvas evidence with contextual complex-graphic
  review and clearer third-party owner follow-up workflows.
- Approximate voice-control readiness with visible-label-in-accessible-name and
  unique control-name checks while keeping real voice and switch-control tasks
  in manual review.
- Add an optional usability-test worksheet that records task completion,
  assistive technology and browser context, blockers, and remediation owners
  without collecting unnecessary personal information.
- Add inclusive review prompts inspired by human-centered design practices:
  whether a task works without sound, without precise pointer movement, under
  zoom, with keyboard only, with reduced motion, and under cognitive load.
- Add cognitive-load and neurodiversity review prompts for plain language,
  predictable next actions, calm error messages, time limits, interruption
  recovery, and understandable multi-step forms.
- Expand remediation hint coverage for additional axe, keyboard, layout, media,
  and ESLint rules.
- Improve Vue and Angular static coverage while continuing to rely on
  established ESLint plugins rather than custom parsers.

## Visual Report UX

- Keep the visual HTML report as the primary product experience. Reports should
  remain useful as a single local file with screenshots, annotations, WCAG
  metadata, keyboard evidence, manual-review gaps, and copyable fixes before
  any hosted dashboard or SaaS workflow is considered.
- Add multi-viewport evidence for 320 CSS px, desktop, and color-scheme states
  so layout, reflow, and visual findings are easier to compare.
- Add before/after comparison for retest runs, including resolved, new,
  remaining, and worsened findings.
- Add local report history and trend summaries inside visual reports where it
  can be done without storing sensitive data.
- Add more copyable fix summaries, including targeted snippets for reflow,
  contrast, iframe ownership, and keyboard/focus issues.
- Reframe selected report labels around potential exclusion risk, affected
  users, and practical impact while preserving technical WCAG and rule metadata
  for developers.
- Add a future drag-and-drop report viewer for the documentation website so a
  user can open an existing `a11y-report.json` without rerunning the CLI.
- Continue hardening screenshot annotations, including selector matching,
  full-page screenshot edge cases, preview alignment, and overlay legends.
- Continue expanding `exploration.html` from a static report into a richer
  local dashboard that can visualize checked pages, states, screenshots, and
  accessibility findings while a scan is running.

## Developer Workflow

- Keep the first-run experience centered on one command:
  `a11y-shiftleft-cli audit --url <app-url> --out reports --open`. Advanced CI,
  baseline, Lighthouse, PDF, Excel, and dashboard paths should stay discoverable
  without crowding the beginner path.
- Harden `watch` with clearer run-to-run deltas, better changed-file grouping,
  affected-route hints, and guidance for mapping changed files to dynamic
  smoke-test URLs.
- Add a single guided setup command that creates the config, generated report
  `.gitignore` entries, npm scripts, and CI workflow in one pass, while keeping
  every generated file visible for review before commit.
- Add CI presets for GitHub Actions first, then GitLab CI, CircleCI, Jenkins,
  and generic shell runners. Keep each preset focused on installing the package,
  starting the app, running `audit` or `check`, and preserving local artifacts.
- Extend quality-gate profiles beyond `new-critical-only`, `critical`,
  `warning`, and `report-only` only when real CI users need additional rollout
  modes.
- Add optional Git hook setup for Husky and Lefthook so staged accessibility
  checks can run before commits without becoming a hard dependency.
- Add incremental scan support for pull requests by prioritizing changed static
  files and a small configured set of dynamic smoke-test URLs before broader
  scheduled scans.
- Continue expanding CLI quality-of-life controls around report paths,
  troubleshooting context, progress output, `--quiet`, and `--verbose`.
- Improve framework autodetection messaging so users clearly understand the
  difference between browser-based audits for any rendered website and optional
  source adapters for React, Vue, and Angular.
- Evaluate Svelte and Astro static adapters only after the browser audit,
  visual report, keyboard evidence, and React/Vue/Angular adapter path are
  stable. Next.js should remain covered by the React adapter for JSX/TSX source
  checks unless a clear Next-specific gap appears.
- Do not add Rails or Django adapters by default. Treat those stacks as
  browser-audit targets unless a concrete source-analysis integration proves
  useful and lightweight.
- Continue hardening configurable safe-mode policies for `explore`, including
  clearer skip reporting and optional request blocking for external or
  high-risk API traffic.
- Continue hardening report retention with optional detailed local-only preview
  output and clearer history-management UX for timestamped report runs.

## Integrations And Sharing

- Add CI artifact-link support for visual HTML reports so pull request comments
  can stay short while linking to the full local-generated evidence uploaded by
  the CI provider.
- Add first-class report status summaries that highlight high-confidence,
  high-impact findings first, separate third-party embedded content, and show
  which findings are best handled as manual review.
- Publish a repeatable external-validation protocol that compares the same
  pages and states with Accessibility Insights, ARC Toolkit,
  [WAVE](https://wave.webaim.org/),
  [Siteimprove](https://www.siteimprove.com/why-siteimprove/integrations/browser-extensions/),
  [Lighthouse](https://developer.chrome.com/docs/lighthouse/accessibility/scoring/),
  and [Pa11y](https://github.com/pa11y/pa11y). Record tool/version/date,
  unique findings, overlaps, findings requiring review, and confirmed false
  positives.
- Add an optional import format for manually confirmed external findings only
  after the validation protocol is stable.
- After the 1.0 CLI release, package a dedicated GitHub Action wrapper in a
  separate repository for GitHub Marketplace. Keep the first version focused on
  a simple `uses:` workflow that installs the CLI, runs `audit`, uploads visual
  report artifacts, and optionally posts a pull request summary.
- Add a `pr-comment` command for manual pull request feedback that can scan a
  provided preview URL, update an existing accessibility comment, and apply
  severity labels when GitHub credentials are available.
- Extend the post-1.0 GitHub Action wrapper with direct artifact links, preview
  URL inputs, existing-comment updates, and optional severity labels.
- Add optional Jira and Linear export commands after the report schema is stable
  enough for external ticket sync. Keep the first version dry-run first, with
  explicit credentials, duplicate detection, and redaction of sensitive report
  fields.
- Continue hardening scoped `a11y-ignore.json` support with clearer expiry
  reminders, stale-ignore cleanup guidance, and optional owner summaries.
- Evaluate an optional public-link publisher only after sanitized export is
  stable. Require explicit confirmation, unguessable URLs, expiration,
  revocation, and deletion.
- Evaluate EARL or JSON-LD export for machine-readable evaluation evidence
  after the internal report schema is stable and mapped clearly to WCAG metadata
  and manual-review statuses.

## Adoption And Documentation

- After the 1.0 CLI release, create a documentation website with quick start
  guides, framework-specific setup pages, CI and compliance-support examples,
  troubleshooting, privacy notes, and sample visual reports.
- Add a "CI/CD without SaaS" guide that explains how the CLI differs from
  enterprise platforms: local-first execution, open-source reports, CI artifacts,
  explicit manual-review gaps, and no hosted account requirement.
- Add a "quality gates for existing projects" guide covering baseline mode,
  `--fail-on`, `--wcag-only`, report-only CI, and staged rollout from warnings
  to critical blockers.
- Add a privacy section to the documentation website covering screenshot
  redaction, `--no-screenshots`, generated report directories, `.gitignore`
  setup, baseline files, and safe handling of local artifacts.
- Expand recipe docs with screenshots, generated report excerpts, public-site
  examples, and rollout guidance for early teams.
- Add inclusive-design documentation that connects common technical findings to
  real user scenarios, before/after fixes, and "solve for one, extend to many"
  examples without copying any proprietary toolkit language.
- Strengthen privacy-first positioning in docs: reports, screenshots, URLs, DOM
  evidence, and metrics stay local unless the user explicitly shares them.
- Keep the adoption plan in [adoption-strategy.md](adoption-strategy.md)
  aligned with current CLI capabilities and public documentation.
- Publish a public demo repository and before/after case study showing a full
  pull request workflow with findings, fixes, and generated reports.
- Add GitHub Discussions categories after the first external users appear.
- Open selected external open-source pull requests after the docs, generated CI
  workflow, and sample reports are stable enough for maintainers to review.

## Later

- Design read-only `--interactive` issue review with deterministic remediation
  hints and copy-paste snippets before introducing AI suggestions.
- Introduce optional AI-assisted remediation through a separate
  `@a11y-shiftleft/ai` package, following the privacy and safety rules in
  [ai-suggestions.md](ai-suggestions.md).
- Explore an optional IDE/MCP-style companion after the report schema is stable,
  so editors can surface existing local report findings and deterministic
  remediation hints without sending source code to a hosted service by default.
- Prototype a browser overlay mode after `watch` is stable, so local dev pages
  can highlight affected elements from accessibility findings without requiring
  a full browser extension.
- Explore a DevTools-style local inspection layer after the overlay prototype,
  reusing the same core report schema to show rule, severity, WCAG metadata,
  confidence, and suggested remediation next to affected DOM elements.
- Consider a separate `@a11y-shiftleft/browser` package for a Chrome extension
  or DevTools panel once CLI reports, live feedback, overlay behavior, and
  privacy controls are stable enough to justify a browser-specific project.
- Explore VPAT evidence-draft templates for organizations that need Section 508
  procurement documentation. Keep unsupported criteria marked for manual review
  and keep final conformance statements and legal review outside the CLI.

## Non-Goals

- No WCAG conformance certification claim.
- No ADA or Section 508 legal compliance certification claim.
- No custom AST compiler.
- No ML-based triage in the core CLI.
- No automatic AI code changes in the core CLI.
- No browser extension bundled into the core CLI.
- No mandatory SaaS authorization or hosted dashboard in the core CLI.
