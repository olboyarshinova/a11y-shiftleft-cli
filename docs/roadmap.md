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
- Keep both PDF exports tagged and navigable, with language, title, heading
  outline, alternative text, semantic tables, and a structural generation gate.
  Continue recommending independent PDF/UA validation for formal deliverables.
- Keep PDF export local-first and dependency-light by reusing Playwright's
  browser rendering path where possible instead of adding a heavy PDF stack.
- Prototype issue-tracker export for Jira and Linear after `watch` is stable.
  The first step is `ticket export`: read `a11y-report.json`, group findings by
  rule/page/severity, and write dry-run Markdown/JSON ticket drafts. Later
  versions can create or update issues only when explicit tokens are provided.
- Keep Jira and Linear integrations optional so the core CLI stays useful
  without account setup, SaaS authorization, or extra installation weight.
- Add report-to-report retesting so remediation runs identify fixed, remaining,
  and new findings without changing the committed baseline.
- Write matching Markdown and JSON manual-review records with status, tester,
  environment, evidence links, notes, date, and remediation ownership.
- Overlay persistent team-owned remediation statuses on fresh findings without
  hiding accepted or in-progress accessibility risk from generated evidence.
- Add CLI helpers that initialize remediation tracking from a report and update
  one validated fingerprint without requiring manual JSON editing.
- Add a local, checksummed evidence package with a strict artifact allowlist,
  privacy manifest, and opt-in visual reports and screenshots.

### 0.7.x Keyboard Audit Mode

- Make `audit --url <url>` the recommended entry point with one visual HTML
  report that embeds browser states, static and dynamic findings, screenshots,
  keyboard traversal, fix guidance, and manual-review work.
- Include a coverage matrix and compact browser accessibility-tree evidence for
  landmarks, headings, interactive nodes, and controls exposed without names.
- Provide representative US screen-reader review scenarios for NVDA, JAWS, and
  VoiceOver, including forms, dialogs, focus restoration, and live regions.
- Keep JSON and Markdown alongside the visual report for integrations and pull
  requests; make Excel, PDF, and raw graph exports explicit options.
- Retain `check`, `explore`, and `keyboard` as focused commands for CI,
  debugging, and specialized evidence workflows.
- Stabilize the initial `a11y-shiftleft keyboard --url <url>` workflow, which
  now performs bounded forward-Tab and reverse Shift+Tab traversal and writes
  shared findings plus dedicated Markdown and JSON focus-path artifacts.
- Add page-state snapshots to the bidirectional focus path while preserving the
  existing selector, accessible name, role, visibility, bounding-box,
  focus-indicator, and obscuration evidence. Each focus step now references a
  deduplicated semantic state with URL, title, H1, scroll, viewport, dialogs,
  and expanded-control counts.
- Detect common keyboard blockers: invisible focus, focus loss to `body`,
  repeated focus loops, unreachable interactive controls, positive tabindex
  risks, and focus traps that do not expose an escape path.
- Exercise basic keyboard activation on safe controls with `Enter`, `Space`,
  `Escape`, and arrow keys where the role implies expected keyboard behavior,
  while reusing `explore` safe-mode blocks for destructive actions such as
  logout, delete, pay, upload, camera, microphone, and cookie changes. The
  initial opt-in runner isolates each attempt, blocks post-load requests, and
  reports skipped actions and observable state changes.
- Add optional annotated focus screenshots to the existing
  `keyboard-report.json` and `keyboard-path.md` artifacts.
- Add a numbered visual Tab-order path to the unified HTML report, inspired by
  the visual keyboard helpers in
  [Accessibility Insights](https://accessibilityinsights.io/docs/web/overview/)
  and [ARC Toolkit](https://www.tpgi.com/arc-platform/arc-toolkit/). Keep the
  underlying selector, role, accessible name, and focus evidence available
  without relying on color or the visual path alone. The initial report view
  now renders the bounded forward Tab sequence as numbered controls and flags
  missing indicators, obscured controls, and invisible targets while retaining
  the complete accessible table.
- Add a compact quick-review section that combines high-impact automated
  findings, the bounded Tab path, and a short set of assisted manual checks.
  This should be a report view over the normal audit, not a second scanner or a
  separate result format. The unified HTML report now starts with three
  high-impact findings, five forward Tab stops, and three prioritized human
  review tasks linked to captured states where available.
- Turn manual review into an assisted queue: identify relevant instances such
  as images, forms, dialogs, media, landmarks, and live regions; provide concise
  test instructions; and persist `pass`, `fail`, `needs-review`, and
  `not-tested` outcomes with evidence and reviewer context. Use the
  [A11Y Project checklist](https://www.a11yproject.com/checklist/) as a practical
  task source while keeping WCAG as the normative mapping source. The initial
  queue now links discovered forms, dialogs, live regions, suspicious image
  alternatives, media, landmarks, and reflow states to focused instructions in
  the HTML, Markdown, and JSON reports.
- Surface keyboard findings in the same severity, WCAG, confidence, baseline,
  ignore, remediation, retest, dashboard, and PR-report pipeline used by
  `check` and `explore`. Keyboard mode now supports the shared finding policies
  with a dedicated baseline file.
- Keep the first version bounded and predictable for pull requests: limit max
  tab steps, max states, and activation attempts, then recommend broader manual
  keyboard walkthroughs through `--semi-auto`.

### 0.8.x Comparative Scoring

- Add an optional Lighthouse integration, such as `check --with-lighthouse`,
  that records Lighthouse accessibility scores, audit details, documentation
  links, and relevant performance/accessibility recommendations in the same
  report pipeline. The first implementation keeps Lighthouse optional and
  records score, failed audits, and manual audit counts for `check` and the
  unified visual `audit` report.
- Compare axe and Lighthouse disagreements in a separate report section,
  include Lighthouse suggested fixes where useful, and surface the comparison in
  `exploration.html` and the local dashboard. The first comparison layer now
  records matching rule IDs, Lighthouse-only failed audits, and pipeline-only
  rules in JSON, Markdown, and the unified visual HTML report.
- Explain the Lighthouse score as a weighted summary rather than a conformance
  percentage. Keep manual-review, keyboard, and unmapped coverage visible next
  to the score so a high score cannot hide untested requirements.

### 0.9.x Secure Report Sharing

- Add a local `share prepare` workflow that creates a separate sanitized static
  report without uploading it anywhere.
- Exclude screenshots, absolute paths, query strings, form values, tokens, and
  raw HTML by default; require explicit allow flags for sensitive evidence.
- Add a machine-readable privacy summary so users can review exactly which
  fields and assets would be shared.
- Evaluate an optional public-link publisher only after sanitized export is
  stable. Require explicit confirmation, unguessable URLs, expiration,
  revocation, and deletion.
- Keep public hosting optional. Local checks, CI artifacts, dashboards, and
  report generation must continue to work without an account or hosted service.

## Near Term

- Add an evaluation-scope manifest inspired by WCAG-EM: target standard and
  level, included technologies, discovered pages and states, representative
  and random samples, unavailable content, exclusions, and the exact tool and
  browser versions used. Keep it as reproducibility evidence, not a conformance
  certificate.
- Represent complete user processes separately from individual pages. Let a
  reviewer group discovered states into journeys such as sign-in, search,
  checkout, or form submission and record whether every step was evaluated;
  never report a process as covered because only its first page was scanned.
- Record manual-test environment metadata for browser, operating system,
  assistive technology and version, input method, zoom, and color mode. Provide
  suggested NVDA, JAWS, VoiceOver, TalkBack, keyboard-only, and switch/voice
  scenarios without pretending that browser automation executed those tools.
- Add a bounded forced-colors diagnostic that compares normal rendering with
  `forced-colors: active` and flags controls, focus indicators, SVGs, and
  information-bearing backgrounds that disappear or become indistinguishable.
  Treat the result as review evidence because browser emulation is not a
  substitute for Windows High Contrast Mode testing.
- Add cross-page consistency analysis for repeated navigation, help mechanisms,
  page titles, and same-purpose control names. Use discovered page/state
  fingerprints to surface differences for review rather than asserting that
  every difference is a WCAG failure.
- Separate user impact from technical severity and confidence. Add a compact
  impact field such as `blocker`, `significant`, `workaround`, or `minor`, plus
  affected-page and repeated-component counts, so teams can prioritize task
  completion barriers without weakening the existing evidence model.
- Add assertion-level coverage states to reports: `passed`, `failed`,
  `needs-review`, `not-tested`, and `unavailable`. Show which page or UI state
  produced the evidence and never infer WCAG conformance from an automated
  pass alone.
- Add report grouping controls for rule, page/state, affected element, WCAG
  criterion, and POUR principle. Preserve the current root-cause grouping while
  making element-first triage easier for developers reviewing one component.
- Add a per-finding `Copy issue` action in the local HTML report. Reuse the
  deterministic ticket-draft schema so the copied Markdown includes impact,
  affected page and selector, WCAG metadata, evidence, and remediation guidance
  without contacting an external service.
- Extend readiness controls beyond a fixed delay with bounded declarative
  conditions such as selector visible/hidden and URL or path reached. Keep
  form entry, submission, authentication, and arbitrary scripts out of the
  default workflow; automatic exploration remains the zero-config path.

- Validate the structured manual-review records in real keyboard-only, screen
  reader, zoom, reflow, reduced-motion, cognitive, and task-flow reviews.
- Validate remediation ownership and temporary-acceptance review dates in real
  pull request and retest workflows.
- Validate evidence packages across automated scans, manual reviews, keyboard
  audits, visual exploration, and retest history before adding archive export.

- Build on the practical review areas in the
  [MTS web accessibility guide](https://a11y.mts.ru/web) and
  [MTS testing guide](https://a11y.mts.ru/qa) without treating any single guide
  as a conformance standard. Keep WCAG as the normative mapping source.
- Extend the initial 320 CSS pixel reflow evidence, which now reports document
  overflow and clipped-text candidates, with explicit 200%/400% zoom and
  overlapping fixed or sticky control checks.
- Extend the initial isolated modal checks for accessible name, initial focus,
  Escape, and trigger restoration with bounded focus-containment traversal and
  coverage of close, cancel, and successful-completion paths. Native modal
  dialogs and elements with `aria-modal="true"` now receive bounded forward and
  reverse containment checks; non-modal dialogs and additional completion paths
  remain explicit manual-review work.
- Extend the initial bounded `aria-live`, alert, status, log, timer, and marquee
  mutation evidence with validation-error and loading-state correlation while
  continuing to require screen-reader confirmation of actual announcements.
- Extend the initial deterministic alternative-text quality evidence for
  filenames, generic labels, duplicate nearby text, repeated alternatives, and
  excessive length with contextual figure/caption and complex-image review.
- Extend the initial rendered-state form evidence for `aria-invalid`, described
  errors, error summaries, and current focus with safe validation-state
  correlation and non-sensitive correction workflows that never submit data.
- Add safe diagnostics for unexpected context changes on focus or input, while
  isolating every attempt and blocking navigation, submission, downloads, and
  other destructive effects by default.
- Add assisted checks for hover/focus content: whether it can be dismissed,
  remains available while hovered, and persists long enough to inspect. Keep
  visual meaning and usability in the manual-review queue.
- Extend the initial media evidence for caption tracks, transcript candidates,
  autoplay controls, active animations, and reduced-motion CSS with isolated
  behavior comparison. Keep caption quality, audio description, and flashing
  risk in manual review.
- Extend the initial recursive axe frame coverage evidence and unavailable-frame
  reporting with clearer ownership workflows for third-party embeds. Extend the
  initial canvas fallback/name heuristic with contextual complex-graphic review.
- Approximate voice-control readiness with visible-label-in-accessible-name and
  unique control-name checks while keeping real voice and switch-control tasks
  in manual review.
- Add an optional usability-test worksheet that records task completion,
  assistive technology and browser context, blockers, and remediation owners
  without collecting unnecessary personal information.
- Keep WCAG metadata complete for every rule emitted by the static and dynamic
  adapters; the 2026-06-18 audit restored metadata for all 23 current A/AA axe
  signals.
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

- Publish a repeatable external-validation protocol that compares the same
  pages and states with Accessibility Insights, ARC Toolkit,
  [WAVE](https://wave.webaim.org/),
  [Siteimprove](https://www.siteimprove.com/why-siteimprove/integrations/browser-extensions/),
  [Lighthouse](https://developer.chrome.com/docs/lighthouse/accessibility/scoring/),
  and [Pa11y](https://github.com/pa11y/pa11y). Record tool/version/date, unique
  findings, overlaps, findings requiring review, and confirmed false positives.
  Treat these tools as independent benchmarks, not bundled runtime dependencies.
- Add an optional import format for manually confirmed external findings only
  after the validation protocol is stable. Imported evidence must retain its
  source and must not be presented as a finding produced by this CLI.

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
  direct artifact links, preview URL inputs, and optional severity labels. The
  generated workflow already uploads reports and links its workflow run from
  the PR comment.
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
  a full browser extension. Borrow WAVE's useful in-page context pattern with
  numbered markers, outlines, and accessible text details, while keeping the
  overlay local and optional.
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
- Explore VPAT evidence-draft templates for organizations that need Section 508
  procurement documentation. Keep unsupported criteria marked for manual
  review and keep final conformance statements and legal review outside the CLI.

## Non-Goals

- No WCAG conformance certification claim.
- No ADA or Section 508 legal compliance certification claim.
- No custom AST compiler.
- No ML-based triage in the core CLI.
- No automatic AI code changes in the core CLI.
- No browser extension bundled into the core CLI.
- No mandatory SaaS authorization or hosted dashboard in the core CLI.
