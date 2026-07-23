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
- Continue validating the current cross-page consistency evidence for duplicate
  page titles, placeholder titles, same-purpose control names, repeated
  navigation order, and help mechanisms in real multi-page projects. Surface
  differences for review in the current Audit Coverage row rather than
  asserting that every difference is a WCAG failure.
- Continue improving report grouping controls. Current visual reports include a
  compact `Group Findings` control for rule, WCAG criterion, page/state,
  affected element, and POUR principle while preserving the main triage,
  root-cause, and per-state findings. The selected grouping view is stored
  locally per generated report when browser storage is available. Next, evaluate
  whether teams need deeper grouping filters.
- Make the PR/CI workflow extremely simple: one generated workflow, one
  copy-paste command, clear artifact links, and a report-only adoption path for
  teams that are not ready to fail builds yet. Current `setup` next steps
  explain the report-only rollout and the later `--gate new-critical-only`
  tightening path, generated npm scripts stay aligned with the selected setup
  gate, and generated `npx` CI commands use the published package name to avoid
  package-resolution confusion. Guided setup also points users to `doctor --url`
  when browser installation or target reachability needs troubleshooting and
  prints the generated or updated files that should be reviewed before commit.
  Standalone `generate-ci` now prints the created workflow files and next steps
  for pull-request verification or shell-runner integration.
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
- Keep WCAG coverage evidence in JSON and internal summaries, but avoid
  presenting a separate coverage-score section in the primary visual and
  Markdown reports. Use Audit Coverage as the user-facing checklist. Report
  internal coverage as evidence coverage, not as a claim that a site is
  accessibility-compliant. Use separate metrics for automated evidence and
  assisted review evidence:
  `automatedCoverage = automatedCriteria / targetCriteria` and
  `assistedCoverage = (automatedCriteria + heuristicCriteria + manualChecklistCriteria) / targetCriteria`.
- Continue modeling compliance context through `--standard` presets rather than
  country flags. Keep `wcag22-aa`, `section508`, `ada-title-ii`, and
  `en301549` explicit. Presets may adjust labels, evidence guidance, and report
  context, but must not claim legal certification.
- Validate the current `en301549` web-support preset evidence gaps in real
  review workflows. The preset now records non-web gaps in `evaluation-scope.json`
  for PDF/documents, software outside the browser, hardware, support services,
  procurement evidence, and documentation; next, confirm the wording with teams
  that need EN 301 549-oriented evidence.
- Increase automated and assisted WCAG evidence coverage in this order:
  keyboard/focus traversal, form validation states, 400% reflow and zoom,
  target-size and pointer heuristics, media/motion review signals, and screen
  reader review protocols.
- Grow custom assisted checks for WCAG criteria that ordinary axe/Lighthouse
  scans cannot fully prove. Prioritize evidence-based checks that produce
  `needs review` rather than false pass/fail claims: meaningful sequence
  (`1.3.2`), focus appearance (`2.4.13`, tracked as advisory before AAA
  reporting),
  consistent navigation/identification/help (`3.2.3`, `3.2.4`, `3.2.6`).
  Each check must include visual evidence, WCAG mapping, confidence, and a
  clear manual confirmation step.
- Track competitor coverage as evidence, not marketing claims. Current local
  comparison baseline: Oobee `0.10.95` exposes 26 WCAG-linked criteria in its
  report catalog, including 20 WCAG A/AA criteria and 6 AAA criteria. The
  a11y-shiftleft catalog currently tracks 34 WCAG 2.2 A/AA criteria; the
  coverage matrix records 23 of 55 A/AA criteria with installed automated
  signals and 33 of 55 with automated, heuristic, or mapped manual-review
  evidence. Recheck these numbers before public comparison posts or release
  notes.
- Add per-criterion coverage rows with status, evidence source, finding count,
  and next step: `automated`, `heuristic`, `manual required`, `not covered`, or
  `not applicable`. Keep untested criteria visible so users understand what the
  tool cannot prove automatically.
- Extend reflow evidence with explicit 200%/400% zoom checks and overlapping
  fixed or sticky control checks.
- Extend cross-browser evidence from single-engine runs into a bounded
  comparison profile that runs Chromium, Firefox, and WebKit side by side while
  clearly labeling browser-specific differences for manual review.
- Extend responsive web evidence beyond the current `--mobile`, `--tablet`, and
  `--device` profiles with optional multi-device comparison matrices. Treat
  this as responsive/mobile browser testing for rendered websites, not as native
  iOS or Android app auditing.
- Extend modal checks with additional close, cancel, successful-completion, and
  non-modal dialog paths.
- Extend live-region evidence beyond the current manual checklist row and
  mutation summary with deeper validation-error and loading-state correlation
  while continuing to require screen-reader confirmation.
- Extend alternative-text quality evidence with contextual figure/caption and
  complex-image review.
- Extend rendered form evidence with safe validation-state correlation and
  non-sensitive correction workflows that never submit data.
- Add safe diagnostics for unexpected context changes on focus or input while
  blocking navigation, submission, downloads, and other destructive effects by
  default.
- Extend hover/focus content support beyond the current manual checklist row:
  collect bounded visual evidence for whether triggered content can be
  dismissed, remains available while hovered or focused, and persists long
  enough to inspect.
- Extend pointer and dragging support beyond the current manual checklist row:
  collect bounded visual evidence for pointer cancellation, drag alternatives,
  swipe-only controls, sliders, maps, and pointer-heavy widgets without
  triggering destructive or account-changing actions.
- Extend sensory/color-only instructions and text-spacing support beyond the
  current manual checklist rows: collect bounded visual evidence for
  instruction copy, legends, charts, validation text, and user text-spacing
  overrides without creating noisy content false positives.
- Extend account/authentication support beyond the current manual checklist row:
  collect bounded evidence for redundant entry and accessible authentication in
  dedicated test accounts without recording credentials, personal data, orders,
  payments, or account-changing side effects.
- Extend media evidence beyond the current audio/video, autoplay,
  active-animation, and reduced-motion CSS summary with isolated reduced-motion
  behavior comparison. Caption quality, audio description, and flashing risk
  remain manual-review work.
- Extend embedded-content and canvas evidence beyond the current manual
  checklist targets and owner-review wording with richer third-party follow-up
  workflows, source-level retests, and contextual complex-graphic review.
- Extend voice and switch-control readiness beyond the current label-in-name,
  same-purpose naming signals, and manual checklist row with better
  representative-task evidence while keeping real voice and switch-control
  tasks in manual review.
- Extend the current task-completion worksheet beyond manual checklist and
  Audit Coverage prompts with richer planned-journey confirmation, missing-state
  notes, blocker severity, and retest evidence.
- Add inclusive review prompts inspired by human-centered design practices:
  whether a task works without sound, without precise pointer movement, under
  zoom, with keyboard only, with reduced motion, and under cognitive load.
- Add cognitive-load and neurodiversity review prompts beyond the current
  plain-language, predictable-action, calm-error, recovery-path, and time-limit
  checklist rows. Next, validate that wording in real checkout, account,
  session-expiry, long-form, and multi-step flows.
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
- Add a clearer scan progress experience in the visual report and future watch
  mode: pending, running, completed, skipped, current URL/state, and completion
  percentage for each selected check.
- Add UI-friendly ignore support in HTML reports without encouraging teams to
  hide findings too quickly. Current visual reports include cleanup summaries,
  owner rollups, and a local `ignore audit` next-step command; new ignore
  entries should stay explicit in `a11y-ignore.json` with reason, owner, and
  expiry metadata.
- Add report audience views without duplicating data: developer view for
  selectors and remediation, QA view for screenshots and reproduction steps,
  manager view for risk, trends, coverage, and ownership. Use these views to
  reduce report overwhelm while preserving the same underlying evidence.
- Make issue lifecycle status visible in reports across baseline, retest,
  ignores, and remediation tracking. Current visual findings show compact
  lifecycle badges for new, remaining, tracked remediation status, needs manual
  review, and third-party findings, plus remediation owner, reason, updated
  date, and review date when tracking metadata is available. Next, connect
  ignored-until dates and fixed evidence more directly in the report UI.
- Continue adding more copyable fix summaries, including targeted snippets for
  reflow, contrast, iframe ownership, and keyboard/focus issues. Current visual
  reports let users copy the suggested remediation steps separately from the
  full ticket draft.
- Continue reframing selected report labels around potential exclusion risk,
  affected users, and practical impact while preserving technical WCAG and rule
  metadata for developers. Current visual findings can show compact user-impact
  evidence when it is available.
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
- Continue hardening `watch` after the initial run-to-run deltas,
  changed-file grouping, affected-route hints, and visual audit follow-up
  commands. Current follow-up commands include configured smoke URLs when
  shared-component changes cannot be mapped to a single route. Next steps are
  validating this guidance in real projects and deciding whether an opt-in
  visual refresh loop is useful without making every save too slow.
- Continue the local `agent` workflow after the initial deterministic
  `agent review`, `agent run`, local report-history comparison, and
  `agent refresh-html`. Current agent guidance can refresh visual reports and
  prepare sanitized local share packages from the current report path, and
  `agent review --history` includes compact dashboard-history deltas. Agent
  follow-up commands now write ticket drafts to a local file and surface stale
  ignore cleanup when the report includes expiring, expired, or invalid
  exceptions. Next steps: validate this output against real report-history
  folders and keep follow-up commands aligned with real user workflows.
- Evaluate a dedicated Jenkinsfile preset only if teams need more than the
  generated portable shell CI script. Keep any future preset focused on
  installing the package, starting the app, running `audit` or `check`, and
  preserving local artifacts.
- Extend quality-gate profiles beyond `new-critical-only`, `critical`,
  `warning`, and `report-only` only when real CI users need additional rollout
  modes.
- Continue optional Git hook setup for Husky and Lefthook. Current `setup`
  can generate pre-commit hooks that run static checks against staged frontend
  files through a hardened `check --staged` mode in the selected gate mode and
  prints hook-runner enablement commands; next, validate the generated hooks in
  real React, Vue, and Angular repositories.
- Continue incremental scan support for pull requests. Current `check
  --changed-since <ref>` can limit static checks to frontend files changed
  relative to a base ref, generated GitHub/GitLab PR workflows use it alongside
  a bounded dynamic crawl, and `setup` can turn multiple `--url` values into a
  small dynamic smoke-test set for generated `a11y:check` scripts. Next,
  validate this pattern in real preview deployments before broader scheduled
  scans.
- Add explicit PR scan presets that separate fast pull-request checks from
  slower scheduled or manual full audits. Current `generate-ci` and `setup`
  support `pr`, `full`, and `split` profiles, plus configurable fast and
  full-site crawl bounds. Keep the default PR path short, bounded, and
  baseline-friendly so teams do not disable the tool because of noisy legacy
  findings.
- Continue expanding CLI quality-of-life controls around report paths,
  troubleshooting context, progress output, `--quiet`, and `--verbose`. Current
  verbose check output explains the selected quality gate effect for CI logs,
  generated CI and setup check commands enable verbose mode by default, and
  `doctor` output includes next-step guidance after setup diagnostics.
- After the CLI report schema is stable for 1.0, create a VS Code extension
  that uses the CLI as its engine, reads `a11y-report.json`, shows source
  findings in the Problems panel, provides commands to run audits, and opens the
  visual HTML report from the editor.
- Add WebStorm and IntelliJ documentation first through External Tools that run
  the CLI against a configured app URL. Consider a dedicated JetBrains plugin
  only after the VS Code extension and report schema prove stable with real
  users.
- Do not prioritize a Chrome extension as a primary product path. The project
  should differentiate through CLI-driven dynamic exploration, safe automated
  state discovery, CI reproducibility, visual evidence, and local privacy rather
  than competing as another current-tab scanner.
- Evaluate Svelte and Astro static adapters only after the browser audit,
  visual report, keyboard evidence, and React/Vue/Angular adapter path are
  stable. Next.js should remain covered by the React adapter for JSX/TSX source
  checks unless a clear Next-specific gap appears.
- Do not add Rails or Django adapters by default. Treat those stacks as
  browser-audit targets unless a concrete source-analysis integration proves
  useful and lightweight.
- Continue hardening configurable safe-mode policies for `explore`. Current
  visual reports group skipped actions by reason with examples and state links,
  and safe mode can abort configured high-risk network request patterns during
  exploration. Next, validate request blocking in real applications and keep
  the default policy conservative.
- Continue hardening report retention. Current visual reports can summarize the
  active retention policy and dry-run/cleanup counts without exposing local
  paths, and console output can show short local-only run labels for planned
  cleanup. Next, evaluate clearer history-management UX for timestamped report
  runs.

## Integrations And Sharing

- Add an optional import format for manually confirmed external findings only
  after the validation protocol is stable.
- After the 1.0 CLI release, package a dedicated GitHub Action wrapper in a
  separate repository for GitHub Marketplace. Keep the first version focused on
  a simple `uses:` workflow that installs the CLI, runs `audit`, uploads visual
  report artifacts, and optionally posts a pull request summary.
- Extend the `pr-comment` command with optional preview-URL scanning and
  severity labels. The current command posts or updates an existing GitHub PR
  comment from a local report and can include read-only suggested PR labels for
  severity, manual review, third-party embeds, and human-verification blockers.
  Keep actual GitHub label mutation behind a future explicit opt-in, if added.
- Extend the post-1.0 GitHub Action wrapper with direct artifact links, preview
  URL inputs, existing-comment updates, and optional severity labels.
- Continue the Jira and Linear ticket workflow carefully. The current CLI
  supports safe Markdown and JSON ticket drafts with stable fingerprints,
  redaction, triage summaries, tracker-specific dry-run payload previews for
  Jira, Linear, and GitHub Issues, deterministic owner hints, and local
  duplicate lookup. `--create` is currently blocked with a safety message. Next,
  validate this review-first workflow in real remediation queues and evaluate
  whether explicit create mode is worth adding at all; do not create tracker
  issues automatically by default.
- Continue hardening scoped `a11y-ignore.json` support. Current reports count
  active, expired, invalid, expiring-soon, and owner-grouped ignore rules, and
  visual reports include cleanup guidance without adding one-click ignore
  shortcuts to finding cards.
  The `ignore audit` command provides a read-only stale-ignore review, and
  `ignore cleanup-plan` proposes safe review/remove/renew/fix actions with
  action-count summaries and without automatic deletion. Next, evaluate whether
  teams need a guarded apply mode.
- Evaluate an optional public-link publisher only after sanitized export is
  stable. Require explicit confirmation, unguessable URLs, expiration,
  revocation, and deletion.
- Continue machine-readable evaluation evidence work. The current
  `evidence export` command writes local JSON, JSONL, and EARL-inspired JSON-LD
  finding evidence with WCAG, ownership, confidence, and remediation fields.
  Next, validate the JSON-LD shape with real downstream scripts before treating
  it as stable API surface.

## Adoption And Documentation

- After the 1.0 CLI release, create a documentation website with quick start
  guides, framework-specific setup pages, CI and compliance-support examples,
  troubleshooting, privacy notes, and sample visual reports.
- Use a clearer website headline and README positioning focused on the outcome,
  not the implementation: one command scans a real web app, explores reachable
  UI states, and generates a visual accessibility report with WCAG evidence and
  fix guidance.
- Add a simple early-access or release-updates waitlist to the future
  documentation website so interested developers can follow releases without
  needing a hosted product account.
- Add a short privacy promise near report examples: reports and screenshots
  stay local by default, sensitive screenshots can be disabled or redacted, and
  sharing is always explicit.
- Port the README "built on known tools" section into the future documentation
  website when the site is created.
- Port the privacy and local-artifacts recipe into the future documentation
  website when the site is created.
- Expand recipe docs with more screenshots, public-site examples, and rollout
  guidance for early teams.
- Port the user-impact review recipe into the future documentation website and
  expand it with product-specific examples from real reports.
- Strengthen privacy-first positioning in docs: reports, screenshots, URLs, DOM
  evidence, and metrics stay local unless the user explicitly shares them.
- Keep the adoption plan in [adoption-strategy.md](adoption-strategy.md)
  aligned with current CLI capabilities and public documentation.
- Publish a public demo repository and before/after case study showing a full
  pull request workflow with findings, fixes, and generated reports.
- Publish short blog and Dev.to posts that point to copy-paste quick starts and
  visual report screenshots, such as "one command to generate a visual
  accessibility report" and "adding accessibility evidence to a pull request
  without a SaaS account".
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
- Reconsider a separate browser-specific package only if real users ask for it
  after dynamic exploration, watch mode, visual reports, overlay behavior, and
  privacy controls are already stable.
## Compliance Evidence Roadmap

- Keep WCAG as the technical source of truth for web checks. Treat ADA,
  Section 508, EN 301 549, EAA, CVAA, APAC, and "global compliance" as
  reporting contexts or documentation needs, not as separate automatic
  pass/fail engines.
- Avoid country flags such as `--country us` or `--country eu` because regional
  accessibility obligations often share WCAG criteria while differing in legal
  scope, procurement, documentation, PDF, mobile, telecom/video, enforcement,
  and review process. Prefer explicit standards presets such as
  `--standard wcag22-aa`, `--standard section508`, `--standard ada-title-ii`,
  and `--standard en301549`.
- Improve EAA/EN 301 549 documentation now that the `en301549` web-support
  preset exists. Make clear that the CLI can provide web evidence and
  manual-review gaps, not a full European Accessibility Act or EN 301 549
  certification.
- Track CVAA as a future media/communications context only. Do not add a CVAA
  claim until caption, transcript, audio-description, player-control, and
  communications-specific review workflows have real evidence.
- Treat APAC as a regional documentation topic, not a standard. If users ask for
  Singapore, Australia, Japan, India, or other APAC guidance, document how the
  current WCAG-oriented evidence may support those reviews while keeping legal
  interpretation outside the CLI.
- Explore VPAT evidence-draft templates for organizations that need Section
  508, WCAG, or EN 301 549 procurement documentation. Keep unsupported criteria
  marked for manual review and keep final conformance statements and legal
  review outside the CLI.
- Avoid "global compliance" marketing claims. Use safer wording such as
  "WCAG-oriented evidence and reporting presets that can support accessibility
  reviews for Section 508, ADA Title II, EN 301 549, and future EAA workflows."

## Non-Goals

- No WCAG conformance certification claim.
- No ADA, Section 508, EN 301 549, or EAA legal compliance certification claim.
- No custom AST compiler.
- No ML-based triage in the core CLI.
- No automatic AI code changes in the core CLI.
- No browser extension bundled into the core CLI.
- No native mobile app auditing in the core CLI: no APK/IPA scanning, Appium
  runner, XCTest, Espresso, or direct TalkBack/VoiceOver automation for native
  applications before 1.0.
- No mandatory SaaS authorization or hosted dashboard in the core CLI.
