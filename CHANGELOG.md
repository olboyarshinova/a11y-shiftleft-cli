# Changelog

## Unreleased

- Added a guided `setup` command that creates the starter config, report/auth
  `.gitignore` entries, and report-only GitHub Actions workflow in one pass.
- Extended `setup` to add `a11y:audit` and `a11y:check` npm scripts when a
  project `package.json` is present.

## 0.8.1 - 2026-07-12

- Replaced the multiple README visual-report screenshots with one continuous
  report screenshot that shows summary, coverage, triage, and annotated states.
- Removed TypeScript source files from the published npm package contents while
  keeping compiled `dist/` runtime files, declaration files, docs, and examples.
- Added cross-page impact signals to visual report top-rule triage so repeated
  findings call out affected pages, affected states, target patterns, and likely
  shared-component or cross-page fix scope.
- Added bounded `--wait-until-url` and `--wait-until-path` readiness controls to
  `audit` and `explore` so SPA redirects and authenticated states can settle
  before screenshots and browser checks.
- Normalized URL input consistently across `audit`, `explore`, and `check`,
  including leading/trailing whitespace and common smart quotes.
- Added an authenticated-pages recipe covering manual login, post-login SPA
  waits, existing Playwright `storageState` files, keyboard checks, `.gitignore`,
  and privacy guidance.
- Ignored local generated share/export folders, temporary scan outputs, and
  common auth-state folders so report evidence and login storage stay out of
  Git by default.
- Updated generated GitHub Actions workflows to use current `actions/checkout`
  and `actions/setup-node` versions with Node.js 22.
- Added `--pause-on-human-verification` for local `audit` and `explore` runs so
  users can complete CAPTCHA or "verify you are human" challenges manually in a
  visible browser before the scan continues.
- Polished visual report summary cards with severity-colored counts and moved
  the ticket-draft panel closer to the report title on wide screens.
- Updated Top Rules ordering so repeated findings within the same severity are
  ranked ahead of one-off findings.
- Refined the visual report summary so scan metrics and finding counts are
  separated, cards stay white, and only count values carry severity colors.
- Limited Top Rules in the triage overview to a compact 3-5 item list that
  stays visually balanced with Most Affected States and links readers to the
  full JSON report for the remaining rules.
- Added text-color and background-color alternatives to color-contrast
  recommendations so light text on light backgrounds can be fixed in either
  direction without confusing report wording.
- Added v0.8.1 release notes and updated release checklist smoke tests for URL
  normalization, SPA readiness waits, authenticated-page docs, and package
  boundary verification.

## 0.8.0 - 2026-07-12

- Added the first optional Lighthouse comparison path for `check --with-lighthouse`
  and `audit --with-lighthouse`. Lighthouse remains an optional peer dependency
  so the core package does not become heavier for teams that only need axe,
  keyboard, and visual reports.
- Added Lighthouse-vs-pipeline comparison metadata to JSON, Markdown, and visual
  HTML reports so teams can see matching rule IDs, Lighthouse-only failed audits,
  and pipeline-only rules.
- Added Lighthouse recommendations to Markdown and visual HTML reports, including
  failed audit descriptions, manual Lighthouse checks, and documentation links
  when Lighthouse exposes them.
- Added Lighthouse score and comparison summaries to the local dashboard so
  historical reports can show runs with Lighthouse, average score, failed audits,
  manual audits, and tool-difference counts.
- Added a Lighthouse score trend to the local dashboard alongside the existing
  findings trend.
- Added the first local `share prepare` workflow for creating sanitized
  external-review copies from `a11y-report.json`. The export writes sanitized
  JSON, Markdown, and privacy-summary files without uploading anything.
- Added a `screen-reader` checklist command for human VoiceOver, NVDA, JAWS, and
  TalkBack smoke-test protocols, plus a dedicated VoiceOver item in the manual
  review checklist embedded by `audit`.
- Added `evaluation-scope.json`, a WCAG-EM-inspired reproducibility manifest
  that records requested URLs, discovered states, target standard, evidence
  types, tool version, manual-review status, and limitations without making a
  conformance claim.
- Extended `share prepare` to include a sanitized `share-evaluation-scope.json`
  when the source report directory contains `evaluation-scope.json`.
- Added an Evaluation Scope section to the visual HTML report so reviewers can
  see included URLs, rendered states, evidence types, representative states, and
  the non-conformance-claim note without opening JSON.
- Added the same compact Evaluation Scope summary to the Markdown report used
  for pull request comments.
- Added the sanitized Evaluation Scope summary to `share-summary.md` when
  `share prepare` receives a report directory with `evaluation-scope.json`.
- Added a `Share Review Copy` section to the visual HTML report with a
  privacy-first command for creating a sanitized evidence folder.
- Added latest-run delta tracking to the local dashboard so teams can see
  whether findings and Lighthouse scores improved since the previous report.
- Added a dashboard `New Or Worse Problems` section that compares the latest
  report with the previous run by rule and page.
- Added a dashboard `Resolved Problems` section that highlights rules and pages
  that improved or disappeared in the latest report.
- Added latest-change, new/worse, and resolved counts to the terminal summary
  printed by the `dashboard` command.
- Added a machine-readable `dashboard.json` file next to static dashboard HTML
  exports for CI and future integrations.
- Added third-party iframe ownership metadata for findings inside known embeds
  such as YouTube, Vimeo, Spotify, Google Maps, and CodePen.
- Added human-verification detection so CAPTCHA or bot-protection pages are
  reported as `adapter/human-verification` instead of ambiguous scan failures.
- Added ownership and human-verification counts to report summaries, CSV
  exports, CLI output, and sanitized share reports.
- Added third-party embedded-content and human-verification counts to dashboard
  run history, dashboard JSON, and terminal summary output.
- Made visual HTML reports call out third-party embedded-content ownership and
  human-verification blockers as explicit review notes.
- Added a local `Copy issue` action to visual HTML report finding groups so
  teams can copy Markdown evidence and fix guidance into their tracker.
- Added explicit Audit Coverage evidence states (`passed`, `failed`,
  `needs-review`, `not-tested`, `unavailable`) to the visual HTML report.

## 0.7.1 - 2026-07-03

- Simplified the README so new users see the install command, first audit
  command, visual report screenshots, and the most important workflows before
  advanced options.
- Refreshed the README visual report screenshots from the current demo audit.
- Made full-page screenshot previews more compact in the visual HTML report so
  state cards do not leave large empty areas under screenshots.
- Kept advanced commands, report-reading details, and CI examples available in
  collapsed README sections instead of front-loading them.

## 0.7.0 - 2026-06-23

- Added a unified `audit` command that creates one primary visual report with
  static and dynamic findings, safe UI exploration, screenshots, keyboard
  evidence, recommendations, and an embedded manual-review checklist.
- Added an audit coverage matrix and compact Chromium accessibility-tree
  evidence for explored states, including landmarks, headings, interactive
  samples, and unnamed interactive-node counts.
- Expanded manual review with representative NVDA, JAWS, and VoiceOver task,
  form, dialog, focus-restoration, and dynamic-announcement scenarios.
- Added bounded 320 CSS pixel reflow evidence for every explored state,
  including document overflow and clipped-text candidates mapped to WCAG
  1.4.10 with explicit heuristic confidence and remediation guidance.
- Added isolated modal evidence for accessible names, initial focus, Escape,
  and trigger focus restoration. WCAG-related focus/name risks and
  best-practice Escape behavior share the normal triage and remediation
  pipeline.
- Added bounded dynamic-announcement evidence after safe explored clicks,
  including live-region role, politeness, observed text, and explicit
  no-mutation results without treating silence as an automatic failure.
- Added rendered form-error evidence for explicit invalid fields, exposed
  `aria-errormessage` and `aria-describedby` associations, summaries, and focus.
  Missing, hidden, or empty referenced errors are reported without submitting
  forms or entering user data.
- Added rendered image alternative-text evidence and medium-confidence quality
  heuristics for filenames, generic labels, nearby duplication, reuse across
  different sources, and excessive length. Decorative empty alternatives stay
  unflagged, and contextual meaning remains a manual review.
- Added media and motion evidence for audio/video players, caption tracks,
  transcript candidates, autoplay/muted/controls state, active animations, and
  detectable reduced-motion CSS. Equivalent axe findings are suppressed, while
  content quality, audio description, and flashing remain manual reviews.
- Added embedded-content evidence for recursive iframe audit availability,
  sanitized same-origin/cross-origin frame URLs, and canvas fallback/name
  signals. Unavailable frames are explicit coverage gaps rather than hidden
  passes, and meaningful canvas content remains a contextual review.
- Made audit output compact by default: HTML, JSON, Markdown, and screenshots.
  Structured summary, page, rule, and finding CSV tables are opt-in with
  `--excel`; PDF and raw exploration data are opt-in with `--pdf` and `--raw`.
- Added Excel-friendly CSV tables for scan summary, affected pages, rule
  aggregation, and findings while preserving the legacy raw
  `a11y-metrics.csv` export for focused commands.
- Added deduplicated semantic page-state snapshots to forward and reverse
  keyboard focus paths, including URL, title, H1, scroll position, viewport,
  open dialog count, and expanded-control count.
- Prevented keyboard focus evidence from treating user-entered text field
  values as accessible names; associated labels and ARIA names are used instead.
- Added conservative detection for focus loss to the document body and for
  concrete controls skipped by a completed keyboard focus cycle.
- Connected keyboard findings to baseline, retest, scoped ignore, and
  remediation tracking, using a dedicated `.a11y-keyboard-baseline.json` file.
- Added opt-in, bounded keyboard activation evidence for Enter, Space, Escape,
  and arrow keys. Attempts reuse exploration safe-mode, run in isolated browser
  contexts, and block post-load navigation and data requests.

### Added

- Added `check --retest <report>` for comparing a new scan with a previous
  `a11y-report.json` file or report directory. JSON, CSV, Markdown, and console
  output now distinguish fixed, remaining, and new findings, while severity
  gates apply only to new findings during a retest.
- Semi-automated review now writes matching Markdown and JSON checklists with
  structured status, tester, environment, evidence-link, notes, date, and
  remediation-owner fields for every manual check.
- Added optional `a11y-remediation.json` tracking. Fresh reports retain every
  finding while attaching team-owned status, owner, reason, update date, and
  review date, and summarize stale or invalid tracking entries.
- Added `remediation init` and `remediation set` so teams can create status
  tracking from a report and update validated findings without editing JSON by
  hand.
- Added `evidence pack` for preparing a checksummed local evidence directory.
  It copies only known report artifacts, excludes visual evidence by default,
  and records privacy warnings without uploading any files.
- Added deterministic fix recommendations across non-visual reports: a new
  per-finding CSV export, keyboard Markdown guidance, and grouped latest-run
  recommendations in the local dashboard and dashboard PDF.
- PDF exports now generate tagged structure and heading bookmarks, preserve
  language/title semantics, validate required PDF accessibility metadata, and
  use explicitly labeled dashboard tables with scoped column headers.
- Pull request comments now link to the exact GitHub Actions run containing the
  uploaded visual report artifact.
- Added report-sharing guidance and a privacy-gated sanitized export roadmap.
- Added an initial bounded `keyboard` command that records the rendered Tab
  path, detects common focus-order, visibility, indicator, obscuration, and trap
  risks, and writes dedicated Markdown/JSON evidence alongside normal reports.
- Added bounded Shift+Tab traversal after complete forward cycles, including
  reverse-order evidence and WCAG 2.4.3 findings for asymmetric focus paths.
- Added WCAG metadata for No Keyboard Trap, Focus Visible, and Focus Not
  Obscured (Minimum) so keyboard findings use the shared report pipeline.
- Added a dedicated manual logo review covering purpose, alternative text,
  duplicate announcements, linked-logo names, SVG semantics, zoom, and
  high-contrast behavior.

### Fixed

- Restored criterion names, levels, POUR principles, documentation links, and
  WCAG filtering for 12 A/AA checks already emitted by axe-core.
- Corrected the `valid-lang` fallback mapping from WCAG 3.1.1 Language of Page
  to WCAG 3.1.2 Language of Parts.

## 0.6.3 - 2026-06-18

### Fixed

- Fixed screenshot annotations drifting in previews and expanded views by
  capturing error crops beyond the viewport and storing the actual PNG/JPEG
  dimensions instead of assumed crop dimensions.

## 0.6.2 - 2026-06-18

### Fixed

- Fixed visual exploration closing its primary page while attempting to block
  popup windows, which caused `adapter/explore-scan-error` findings instead of
  running axe checks on affected sites.

## 0.6.1 - 2026-06-18

### Added

- Expanded `--semi-auto` with manual review steps for zoom and reflow,
  alternative-text quality, media and motion, landmarks and skip links, and
  representative assistive-technology usability testing.
- Dynamic crawls and visual exploration now report common starter-template
  page titles and titles reused across distinct URLs while ignoring repeated UI
  states of the same page.

### Fixed

- Fixed screenshot preview annotations so issue frames remain visible and align
  with images fitted inside the compact 16:9 preview.
- Automatic exploration no longer opens recognized advertising or sponsored
  content, and closes popup pages opened by page scripts.

### Changed

- Dynamic checks and visual exploration now automatically compare light and
  dark system color schemes when they produce different rendered appearances;
  no additional command or flag is required.
- Reports preserve color-scheme-specific findings, label affected visual
  states, and show which schemes are represented in likely root-cause groups.
- Regular dynamic checks merge identical light/dark findings so
  theme-independent structural defects do not inflate totals; findings with
  different evidence remain separated by color scheme.
- Visual exploration prioritizes recognizable theme controls and includes
  rendered appearance in state fingerprints so explicit theme toggles are not
  collapsed into the same state.
- Every finding now receives deterministic remediation guidance. Visual and
  Markdown reports show concrete steps, documentation links, and available
  framework examples; unknown rules receive conservative fallback guidance.
- Dynamic axe adapters preserve each violation's rule-specific `helpUrl` in
  JSON and use it in remediation links.
- Visual exploration now keeps short-page context but automatically replaces
  very tall screenshots with focused evidence crops around nearby findings.
  `--screenshot-full-page` remains available when complete-page evidence is
  explicitly required.
- `exploration.html` now includes overflow findings, root causes, transitions,
  and skipped actions in collapsed sections instead of requiring a second
  user-facing report.
- Explore cleanup removes the obsolete `exploration-visual-check.html` artifact;
  `exploration.html` is the single canonical visual report.
- Reports now distinguish mapped WCAG violations, axe best-practice guidance,
  and unmapped review items instead of presenting every finding as equivalent.
- JSON, Markdown, and visual reports group repeated occurrences into likely
  root causes while preserving per-page evidence.
- Removed the unsupported WCAG 1.3.1 mapping from axe `heading-order`; axe
  classifies this rule as best-practice guidance.
- The package now exposes both `a11y-shiftleft` and `a11y-shiftleft-cli` as
  executable names, so the npm package name works directly with `npx`.
- HTML reports display generated timestamps in a readable UTC format while
  retaining the original ISO value in semantic `time` metadata.
- Visual exploration stores pixel-identical screenshots once and shows compact
  references for duplicate states while preserving each state's findings and
  annotation view.
- Cookie consent controls are detected from their surrounding banner or dialog,
  so short labels such as `Accept` or `OK` are not clicked automatically.

## 0.6.0 - 2026-06-13

### Added

- Initial `watch` command for local development feedback. It watches common
  source folders, reruns the existing accessibility check pipeline after file
  changes, refreshes reports, and prints fixed/new/remaining finding counts.
- Dedicated `watch` documentation with quick start, custom source paths,
  static-only mode, dynamic URL mode, baseline usage, and current limits.
- Beginner-focused README rewrite with clearer project value, a 2-minute quick
  start, and copy-paste usage recipes.
- GitHub "Good first issue" template and contributor guidance for
  beginner-friendly tasks.
- Expanded contributor onboarding with clone/install/test/PR instructions,
  structured issue forms, and a pull request template.
- Seed script for creating five beginner-friendly GitHub issues with
  `good first issue`, `help wanted`, and `documentation` labels.
- Contributor guide sections for the first-PR path, test commands by change
  type, review expectations, and maintainer issue seeding.
- `explore --pdf` for generating `exploration.pdf` from the visual HTML report.
- `dashboard --pdf` for generating a portable PDF copy of the local historical
  dashboard.
- `ticket export` for creating dry-run Jira, Linear, or generic ticket drafts
  from `a11y-report.json` without connecting to external tracker APIs.
- Dedicated ticket export documentation with Markdown, JSON, Jira, and Linear
  dry-run examples.
- `explore --wait-ms` and `explore --wait-for-selector` for dynamic pages that
  need a short stabilization period before screenshots and axe scans.
- Bounded auto-scroll before dynamic and visual axe scans so lazy-loaded
  below-the-fold content can be checked without manually scrolling the page.
- Automatic full-page screenshot evidence for explored states with findings,
  while clean states keep compact viewport screenshots.
- Structured color-contrast evidence in JSON, Markdown, and HTML reports with
  measured and required ratios, color swatches, and passing text-color
  suggestions that preserve the current background.
- Severity-colored visual report cards and annotations without stacked gray
  overlays that obscure screenshots with multiple findings.
- Screenshot annotations now use a dedicated image-sized overlay, with layout
  stabilization and element bounds captured immediately before the screenshot.
- Built-in high-risk action blocking for account/session, payment, cookie
  consent, camera/photo, microphone, location, notification, upload, and sharing
  controls, with cookie isolation between explored states.
- Updated release checklist with v0.6 smoke tests for PDF export, ticket drafts,
  dashboard PDF, and watch help.
- Updated framework, CI, ADA Title II, and Section 508 recipes to use clearer
  dev server URL examples and remind users to scan the URL printed by their own
  app.

### Changed

- Refactored `check` into a reusable `runCheck()` pipeline so future developer
  workflows can reuse the same normalization, triage, baseline, ignore, and
  reporting behavior without shelling out to the CLI.
- `explore` cleanup and report retention now treat `exploration.pdf` as a
  generated report artifact.
- `exploration.html` now keeps state transitions and skipped actions in a
  compact details section so the report focuses first on actionable findings.
- `exploration.html` now renders larger screenshots and provides an annotated
  screenshot view so issue frames remain visible when inspecting a screenshot.

### Fixed

- PR accessibility workflow no longer fails when GitHub blocks report comments
  for forked pull requests; the report artifact is still uploaded.

## 0.5.2 - 2026-06-12

### Added

- WCAG metadata and remediation hints for additional common axe findings,
  including document title, page language, ARIA validation, autocomplete
  purpose, input button names, select names, heading order, and list structure.
- Manual GitHub Actions workflow for publishing a GitHub Packages mirror as
  `@olboyarshinova/a11y-shiftleft-cli`.

### Changed

- Updated GitHub Actions workflows to use `actions/checkout@v6`,
  `actions/setup-node@v6`, and Node.js 22.
- Replaced older public documentation wording with clearer "works across web
  frameworks" phrasing.

## 0.5.1 - 2026-06-12

### Added

- Initial `dashboard` command for indexing generated `a11y-report.json` files
  and serving a local historical summary with trends, top rules, affected
  pages, and recent runs.
- Dedicated configuration documentation covering config source order,
  `.gitignore`, baseline files, scoped ignores, report lifecycle, and retention.
- Dedicated visual report documentation covering screenshot privacy, safe mode,
  screenshot formats, and advanced `explore` output controls.

### Changed

- Streamlined the README for new users by keeping the main file focused on
  install, first scan, visual reports, dashboard, CI, and outputs.
- Replaced the package description with clearer npm metadata for accessibility
  testing workflows.
- Clarified `APP_URL` as a terminal shortcut and added direct URL examples for
  users who prefer not to set an environment variable.

## 0.5.0 - 2026-06-12

### Added

- Post-release v0.4.0 consumer install verification notes.
- Public v0.4.0 adoption snapshot and promotion draft.
- v0.4.0 demo pull request playbook for before/after adoption evidence.
- v0.4.0 case study template for turning demo pull requests into publishable
  engineering evidence.
- Standalone React/Vite demo template for creating a public before/after
  accessibility CI repository.
- Multi-package adoption snapshot collector and weekly GitHub Actions artifact
  workflow.
- Experimental `explore` command for safe zero-config UI-state discovery with
  screenshots and an exploration graph artifact.
- Visual `exploration.html` report for `explore` runs, showing checked states,
  screenshots, findings, and state transitions.
- Safe cleanup for `explore` output artifacts so stale state screenshots do not
  remain in repeated report runs.
- Compressed JPEG state screenshots by default for `explore`, with configurable
  screenshot format, JPEG quality, and full-page capture.
- Default screenshot redaction for sensitive form fields in `explore`, with an
  explicit `--no-screenshot-redaction` escape hatch for local debugging.
- `init --gitignore` for adding generated report directories to a project's
  `.gitignore` without modifying files during package installation.
- Optional AI suggestions architecture documentation for a future separate
  `@a11y-shiftleft/ai` package.
- Baseline mode for `check`, including `.a11y-baseline.json`, `--baseline`,
  `--baseline-file`, and `--update-baseline` so CI can fail only on new
  accessibility findings.
- Roadmap notes for future real-time developer feedback via `watch`, local
  browser overlay, and a separate browser extension package.
- Roadmap notes for `watch` run-to-run deltas such as fixed, new, and remaining
  findings in terminal feedback.
- Roadmap notes for a future local metrics dashboard and Lighthouse comparison
  workflow.
- Roadmap notes for optional Lighthouse recommendation capture through the
  existing report and visual exploration workflow.
- Roadmap notes for a future documentation website privacy section covering
  screenshots, report artifacts, `.gitignore`, and baseline files.
- Roadmap notes for future manual PR comments, GitHub Action artifacts, preview
  URL inputs, and severity labels.
- Roadmap notes for CLI quality-of-life improvements including quiet/verbose
  output, broader config discovery, progress output, and screenshot annotations.
- Roadmap notes for future Git hook setup, incremental scans, smart ignores,
  and colorized local severity output.
- Roadmap notes for additional `explore` state-explosion safeguards,
  configurable safe-mode policies, and generated report retention.
- README preview showing how the generated `exploration.html` visual report is
  structured.
- TypeScript source for the CLI program registration, fixture verification
  script, and Vite demo config while preserving stable JavaScript runtime
  wrappers for npm consumers.
- TypeScript test sources with a dedicated `tsconfig.test.json` build and
  `dist-test` execution path.
- Adoption telemetry collector support for separately recording manual npm
  website download snapshots alongside npm API periods.
- Split CI generation profiles for fast PR accessibility crawls and separate
  scheduled full-site accessibility crawls.
- Repository CI now uses a bounded accessibility PR crawl plus a separate
  scheduled full-site accessibility workflow artifact.
- Confidence scoring, confidence reasons, and issue-category metadata for
  findings and report summaries.
- Evidence methodology documentation for validating false positives,
  confidence precision, and issue-category reporting.
- `check --quiet` and `check --verbose` output controls for CI-friendly runs
  and local troubleshooting.
- Scoped `a11y-ignore.json` support with required `reason`, `owner`, and
  `expires` metadata for temporary reviewed exceptions.
- Configurable `explore.safeMode` rules for project-specific blocked text,
  roles, URLs, selectors, allowed selectors, and browser dialog auto-dismiss.
- Config discovery for `.a11yrc.json` and `package.json#a11y` in addition to
  the existing `.a11y-shiftleft.json` and `--config` path.
- `explore --quiet` and `explore --verbose` output controls for CI-friendly
  visual scans and local troubleshooting.
- `exploration-graph.json` and `exploration.html` now include skipped
  exploration actions with reviewable safe-mode reasons.
- Opt-in report retention cleanup for timestamped output directories via
  config or `--retention-max-runs` / `--retention-max-age-days`.
- Generated JSON, CSV, and Markdown reports now include retention evidence when
  retention cleanup is enabled.
- `check` and `explore` now support `--retention-dry-run` to preview historical
  report cleanup without deleting old runs.
- Retention evidence in generated reports now omits local filesystem paths and
  stores only cleanup counters and mode.
- Readable local `check` summary with severity counts, top rules, affected
  pages, report paths, and `--json-summary` for scripts that parse stdout.
- `doctor` now autodetects React, Vue, and Angular from `package.json` and
  recommends the matching `@a11y-shiftleft/*` adapter bundle for optimized
  static checks.
- Readable local `explore` progress and final summary output, with
  `--json-summary` for scripts that parse stdout.
- Compact interactive `check --crawl` progress output for crawl discovery and
  per-page dynamic scans.
- Triage overview in `exploration.html`, including most affected states, top
  rules, severity scores, state anchors, and WCAG metadata where available.
- Best-effort screenshot annotations in `exploration.html` using selector
  bounding boxes stored in issue evidence instead of modifying screenshot files.

### Changed

- Adapter packages now declare optional framework runtime peer dependencies
  (`react`, `vue`, and `@angular/core`) so npm metadata signals the intended
  host framework without installing framework runtimes.
- Deduplication now separates matching selectors across different URLs and
  matching static findings across different source locations.
- `check --static` and `check --dynamic` now behave as explicit scan modes.
- ESLint adapter output is filtered to accessibility-related rules so ordinary
  project lint findings do not appear in accessibility reports.
- Dynamic axe scans now continue across remaining URLs when one page fails.
- GitHub PR reporting now updates an existing accessibility comment instead of
  posting a new comment on every run.
- React/Vite demo now includes a stateful modal with intentional accessibility
  issues for `explore` scans.
- CSV report export now recursively flattens nested evidence fields.
- Compliance preset filtering now limits mapped findings by preset WCAG
  version/level while preserving unmapped best-practice findings separately.
- README and recipes now use current compliance-support wording, include an ADA
  Title II evidence recipe, and provide a simpler beginner quick start.
- Command help for `--cwd` no longer prints the caller's local working
  directory as a default value.

## 0.4.0 - 2026-06-06

### Added

- Compliance evidence summary in JSON, CSV, and Markdown reports, including
  WCAG-mapped findings, unmapped findings, affected pages, top affected pages,
  and manual-review status.
- Adoption strategy document covering low-friction npm scripts, generated
  GitHub Actions workflows, future Marketplace Action support, documentation
  website priorities, outreach targets, and channels that should wait for
  stronger adoption evidence.
- Adoption roadmap items for demo repositories, before/after case studies,
  copy-paste recipes, trust badges, issue templates, a future `doctor` command,
  community surfaces, engineering posts, and selected external pull requests.
- `doctor` command for pre-flight setup checks covering Node.js, project
  directory access, config presence, Playwright resolution, Chromium
  installation, CI detection, and target URL reachability.
- CLI version output now reads from `package.json` instead of a hard-coded
  value.
- Copy-paste recipe docs for Angular, React/Vite, Vue/Vite, Next.js, GitHub
  Actions, and Section 508 workflows.
- GitHub issue templates for bug reports, framework support requests, rule
  mapping requests, and adoption stories.
- Framework-aware setup via `init --framework react|vue|angular|auto|unknown`.
- `doctor` now checks framework-specific adapter package availability based on
  the selected framework.
- Framework static plugins are lazy-loaded and moved from required dependencies
  to optional peer dependencies, preparing the future adapter package split.
- `adapter list` and `adapter add <framework>` commands for copy-paste static
  adapter dependency guidance.
- Companion adapter package scaffolds for `@a11y-shiftleft/react`,
  `@a11y-shiftleft/vue`, and `@a11y-shiftleft/angular`.

## 0.3.0 - 2026-06-05

### Added

- WCAG version filtering for mapped findings via config `wcagVersion` and CLI
  flag `--wcag-version`.
- Bounded same-origin crawling for dynamic scans via `--crawl`,
  `--crawl-depth`, and `--crawl-limit`.
- Page-level risk ranking in JSON, CSV, and Markdown reports.
- Remediation hints with documentation links and common framework examples for
  frequently emitted accessibility rules.
- Axe tags and unmapped-rule summaries for best-practice checks that do not map
  directly to WCAG criteria.
- Multi-URL dynamic scans via repeated, space-separated, or comma-separated
  `--url` values.
- WCAG-based compliance support presets via `--standard wcag22-aa`,
  `--standard ada-title-ii`, and `--standard section508`, with report metadata
  and legal-safe disclaimers.
- GitHub Actions workflow generation now supports multiple URLs and
  `--standard` presets.

## 0.2.1 - 2026-06-04

### Changed

- Polished README release instructions and latest-release copy after publishing
  v0.2.0.

## 0.2.0 - 2026-06-04

### Added

- Angular template static fallback with `@angular-eslint/eslint-plugin-template`.
- Angular fixture smoke-test coverage.
- PR metrics CSV template and synthetic sample dataset.
- Metrics analysis script for baseline vs intervention summaries.
- JSON export support for metrics analysis output.
- IMRaD research paper outline.
- TypeScript source migration with compiled `dist/` runtime and declaration
  files.
- WCAG criterion metadata in reports, POUR/level summary counts, and
  `--wcag-filter`.
- Roadmap document for semi-automated review, WCAG version filtering, crawling,
  Lighthouse, and stronger Vue/Angular support.
- Adoption metrics collector for npm downloads and optional GitHub traffic
  evidence snapshots.
- Semi-automated manual accessibility review checklist via `check --semi-auto`.
- TypeScript implementations for metrics, adoption telemetry, and PR comment
  scripts while keeping stable JavaScript entrypoints for npm users.

## 0.1.0 - 2026-06-03

Initial public MVP release.

### Added

- CLI commands: `init`, `check`, and `ci`.
- Dynamic accessibility scanning with Playwright and axe.
- React static scanning fallback with `eslint-plugin-jsx-a11y`.
- Normalized issue schema for static and dynamic findings.
- Severity triage: `critical`, `warning`, and `info`.
- Deduplication by rule, target, and severity.
- JSON, CSV, and Markdown report outputs.
- Metrics export for `rawCount`, `uniqueCount`, `duplicateCount`,
  `duplicateRate`, `scanDurationMs`, `bySource`, and `bySeverity`.
- GitHub Actions workflow generation.
- Demo React/Vite app with intentional accessibility findings.
- Core, adapter, reporter, and CLI gate tests.

### Known Limitations

- Vue static checks are intentionally limited to basic template fallback rules.
- Angular static checks rely on the target project's ESLint setup in v0.1.0.
- Dynamic scans require the target app to already be running at a reachable URL.
- The CLI does not certify WCAG conformance; automated checks cover only part of
  accessibility review.
- PR comment behavior should be validated in real pull request workflows.
