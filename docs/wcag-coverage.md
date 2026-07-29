# WCAG 2.2 Coverage Matrix

Last reviewed: 2026-07-28

This document compares all 86 active WCAG 2.2 success criteria with the checks
currently available in `a11y-shiftleft-cli`. WCAG 2.2 removes 4.1.1 Parsing, so
it is not counted as an active criterion.

Authoritative references:

- [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [How to Meet WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/)
- [axe-core rules](https://dequeuniversity.com/rules/axe/)

## Coverage Labels

- **Automated + mapped**: the project runs an automated rule and preserves the
  criterion title, level, principle, and documentation in reports.
- **Automated, metadata gap**: an installed scanner runs a relevant rule, but
  the project criterion catalog does not yet contain the criterion. No current
  A/AA axe signal has this gap; the label remains useful for future audits.
- **Partial automated**: static or best-practice rules provide a useful signal,
  but do not test the complete criterion.
- **Manual checklist**: `--semi-auto` explicitly asks a reviewer to test the
  criterion.
- **Gap**: no dedicated automated check or explicitly mapped manual checklist.

No automated status means that the complete success criterion is certified.
Most WCAG criteria require context and human judgment even when an automated
rule can detect common failures.

## Summary

WCAG 2.2 contains 31 Level A, 24 Level AA, and 31 Level AAA criteria. The
project target, WCAG 2.2 AA, therefore includes 55 Level A and AA criteria.

- 23 of 55 A/AA criteria have at least one installed axe-core signal.
- All 23 A/AA axe signals now resolve to criterion metadata in the project
  catalog; 12 mappings were restored after the 2026-06-18 catalog audit.
- Focus Order now has static signals, bounded Tab and Shift+Tab paths, and a manual
  checklist; complete task semantics and reverse traversal remain manual.
- All 55 A/AA criteria now have either an automated signal, a heuristic signal,
  or an explicitly mapped manual-review prompt. This is assisted evidence
  coverage, not a conformance claim.
- 32 of 55 A/AA criteria currently depend on a mapped manual-review prompt when
  no stronger installed automated signal is available.
- AAA is reported below for completeness, but is not the current product
  conformance target.

## 1. Perceivable

| Criterion | Level | Current coverage | Current source or limitation |
|---|---|---|---|
| 1.1.1 Non-text Content | A | Automated + quality heuristics + manual checklist | axe/framework rules, image quality patterns, and canvas fallback/name evidence; visual meaning and logo/canvas purpose remain manual |
| 1.2.1 Audio-only and Video-only (Prerecorded) | A | Automated + rendered evidence + manual checklist | axe `audio-caption` plus nearby transcript-candidate evidence; transcript need and quality remain manual |
| 1.2.2 Captions (Prerecorded) | A | Automated + rendered evidence + manual checklist | axe `video-caption` plus caption-track evidence; audio presence and caption accuracy remain manual |
| 1.2.3 Audio Description or Media Alternative (Prerecorded) | A | Manual checklist | Media review asks for audio description or equivalent media alternatives; quality remains manual |
| 1.2.4 Captions (Live) | AA | Manual checklist | Live-caption presence and quality require representative live-media review |
| 1.2.5 Audio Description (Prerecorded) | AA | Manual checklist | Audio-description coverage and adequacy require media review |
| 1.2.6 Sign Language (Prerecorded) | AAA | Gap | Outside current target |
| 1.2.7 Extended Audio Description (Prerecorded) | AAA | Gap | Outside current target |
| 1.2.8 Media Alternative (Prerecorded) | AAA | Gap | Outside current target |
| 1.2.9 Audio-only (Live) | AAA | Gap | Outside current target |
| 1.3.1 Info and Relationships | A | Automated + mapped; manual checklist | axe structure/table/list rules, labels, landmarks, form review |
| 1.3.2 Meaningful Sequence | A | Manual checklist | Logical reading and navigation order review |
| 1.3.3 Sensory Characteristics | A | Heuristic + manual checklist | Visible instruction-text heuristic for color, position, shape, icon, and sound cues; context and sufficiency require manual review |
| 1.3.4 Orientation | AA | Automated + mapped | axe `css-orientation-lock` |
| 1.3.5 Identify Input Purpose | AA | Automated + mapped | axe `autocomplete-valid` |
| 1.3.6 Identify Purpose | AAA | Gap | Outside current target |
| 1.4.1 Use of Color | A | Automated + mapped; heuristic + manual checklist | axe `link-in-text-block` plus visible instruction-text heuristic; context and sufficiency require manual review |
| 1.4.2 Audio Control | A | Automated + rendered evidence | axe `no-autoplay-audio` plus autoplay, muted, and controls state without duplicate findings |
| 1.4.3 Contrast (Minimum) | AA | Automated + mapped | axe `color-contrast` with measured and required ratios |
| 1.4.4 Resize Text | AA | Automated + heuristic + manual checklist | axe viewport signal plus 200% zoom comparison for overflow, clipped text, and overlap review |
| 1.4.5 Images of Text | AA | Manual checklist | Review meaningful text baked into banners, screenshots, charts, ads, infographics, and exceptions |
| 1.4.6 Contrast (Enhanced) | AAA | Automated, metadata gap | axe `color-contrast-enhanced`; outside current target |
| 1.4.7 Low or No Background Audio | AAA | Gap | Outside current target |
| 1.4.8 Visual Presentation | AAA | Gap | Outside current target |
| 1.4.9 Images of Text (No Exception) | AAA | Gap | Outside current target |
| 1.4.10 Reflow | AA | Heuristic + manual checklist | 400% / 320 CSS pixel evidence for overflow, clipped text, and fixed or sticky overlap |
| 1.4.11 Non-text Contrast | AA | Heuristic + manual checklist | Forced-colors evidence can surface review signals; control boundaries, focus indicators, icons, charts, and custom graphics still require manual review |
| 1.4.12 Text Spacing | AA | Heuristic + manual checklist; automated mapping | WCAG text-spacing override evidence for overflow and clipped text plus axe `avoid-inline-spacing`; complete readability still requires review |
| 1.4.13 Content on Hover or Focus | AA | Heuristic + manual checklist | Trigger inventory for title, described-by, popup, disclosure, popover, and tooltip-data patterns; dismissible, hoverable, persistent behavior still requires manual review |

## 2. Operable

| Criterion | Level | Current coverage | Current source or limitation |
|---|---|---|---|
| 2.1.1 Keyboard | A | Automated + mapped; manual checklist | axe, framework lint, and bounded Tab traversal detect common failures; no complete keyboard task traversal |
| 2.1.2 No Keyboard Trap | A | Partial automated + mapped; manual checklist | keyboard runner detects stuck focus and early cycles; modal escape and complex widgets still require review |
| 2.1.3 Keyboard (No Exception) | AAA | Automated, metadata gap | axe scrollable-region signal only; outside current target |
| 2.1.4 Character Key Shortcuts | A | Manual checklist | Review single-key shortcuts for turn-off, remapping, or focus-scoped behavior |
| 2.2.1 Timing Adjustable | A | Automated + mapped | axe `meta-refresh` detects only one failure pattern |
| 2.2.2 Pause, Stop, Hide | A | Automated + mapped; manual checklist | axe blink/marquee checks plus media and motion review |
| 2.2.3 No Timing | AAA | Gap | Outside current target |
| 2.2.4 Interruptions | AAA | Automated, metadata gap | axe meta-refresh signal only; outside current target |
| 2.2.5 Re-authenticating | AAA | Gap | Outside current target |
| 2.2.6 Timeouts | AAA | Gap | Outside current target |
| 2.3.1 Three Flashes or Below Threshold | A | Manual checklist | No flash-frequency analysis |
| 2.3.2 Three Flashes | AAA | Gap | Outside current target |
| 2.3.3 Animation from Interactions | AAA | Diagnostic evidence | Active animation count and detectable reduced-motion CSS only; outside current target and requires manual review |
| 2.4.1 Bypass Blocks | A | Automated + mapped; manual checklist | axe `bypass` plus landmark and skip-link review |
| 2.4.2 Page Titled | A | Automated + mapped | axe title rule plus duplicate and placeholder title analysis across URLs |
| 2.4.3 Focus Order | A | Partial automated + mapped; manual checklist | Angular tabindex/focus lint plus recorded bounded Tab and Shift+Tab paths; logical task order still requires review |
| 2.4.4 Link Purpose (In Context) | A | Automated + mapped | axe link and area accessible-name rules cover common failures |
| 2.4.5 Multiple Ways | AA | Manual checklist | Review representative important pages for at least two discovery paths such as navigation, search, sitemap, breadcrumbs, related links, footer links, or an index page |
| 2.4.6 Headings and Labels | AA | Manual checklist | Structural signals exist, but descriptive quality needs explicit review |
| 2.4.7 Focus Visible | AA | Partial automated + mapped; manual checklist | keyboard runner checks viewport visibility and outline/box-shadow indicators; custom visual treatments require review |
| 2.4.8 Location | AAA | Gap | Outside current target |
| 2.4.9 Link Purpose (Link Only) | AAA | Automated, metadata gap | axe identical-link signal; outside current target |
| 2.4.10 Section Headings | AAA | Gap | Outside current target |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Partial automated + mapped; manual checklist | keyboard runner checks focused-element geometry and center-point occlusion; complete boundary coverage requires review |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Gap | Outside current target |
| 2.4.13 Focus Appearance | AAA | Gap | Outside current target |
| 2.5.1 Pointer Gestures | A | Heuristic + manual checklist | Pointer-heavy inventory can surface maps, swipe regions, and pointer handlers; multipoint/path gesture alternatives require manual review |
| 2.5.2 Pointer Cancellation | A | Heuristic + manual checklist | Pointer-heavy inventory can surface risky controls; down-event activation and cancellation behavior require manual review |
| 2.5.3 Label in Name | A | Automated + mapped | axe `label-content-name-mismatch` |
| 2.5.4 Motion Actuation | A | Manual checklist | Review shake, tilt, rotation, camera, map, game, and AR interactions on representative devices |
| 2.5.5 Target Size (Enhanced) | AAA | Gap | Outside current target |
| 2.5.6 Concurrent Input Mechanisms | AAA | Gap | Outside current target |
| 2.5.7 Dragging Movements | AA | Heuristic + manual checklist | Drag, sortable, slider, carousel, map, and canvas inventory; non-drag alternatives require manual review |
| 2.5.8 Target Size (Minimum) | AA | Automated + mapped | axe `target-size`; exceptions still require judgment |

## 3. Understandable

| Criterion | Level | Current coverage | Current source or limitation |
|---|---|---|---|
| 3.1.1 Language of Page | A | Automated + mapped | axe page-language rules |
| 3.1.2 Language of Parts | AA | Automated + mapped | axe `valid-lang`; local fallback and axe tag mapping both resolve to 3.1.2 |
| 3.1.3 Unusual Words | AAA | Gap | Outside current target |
| 3.1.4 Abbreviations | AAA | Gap | Outside current target |
| 3.1.5 Reading Level | AAA | Manual checklist | Plain-language review; outside current target |
| 3.1.6 Pronunciation | AAA | Gap | Outside current target |
| 3.2.1 On Focus | A | Heuristic + manual checklist | Inline focus/blur/autofocus handlers are inventoried for context-change review; behavior confirmation remains manual |
| 3.2.2 On Input | A | Heuristic + manual checklist | Inline input/change/select handlers are inventoried for context-change review; behavior confirmation remains manual |
| 3.2.3 Consistent Navigation | AA | Heuristic + manual checklist | Cross-page exploration compares repeated navigation order for review; differences require manual confirmation |
| 3.2.4 Consistent Identification | AA | Heuristic + manual checklist | Cross-page exploration compares same-purpose control names and checklist review covers predictable naming |
| 3.2.5 Change on Request | AAA | Automated, metadata gap | axe meta-refresh signal only; outside current target |
| 3.2.6 Consistent Help | A | Heuristic + manual checklist | Cross-page exploration compares detected help mechanisms and checklist review covers recovery/help paths |
| 3.3.1 Error Identification | A | Rendered-state heuristic + manual checklist | Existing `aria-invalid` fields are checked for exposed associated errors; triggering validation and judging message quality remain manual |
| 3.3.2 Labels or Instructions | A | Automated + mapped; manual checklist | axe/framework label rules plus quality review |
| 3.3.3 Error Suggestion | AA | Manual checklist | Representative task review only |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Manual checklist | Time-limit and recovery review covers legal, financial, and user-data confirmation without completing real transactions |
| 3.3.5 Help | AAA | Gap | Outside current target |
| 3.3.6 Error Prevention (All) | AAA | Gap | Outside current target |
| 3.3.7 Redundant Entry | A | Manual checklist | Account, checkout, and recovery review covers repeated-entry barriers; no personal data or credentials should be recorded |
| 3.3.8 Accessible Authentication (Minimum) | AA | Manual checklist | Account/authentication review covers cognitive authentication barriers and accessible alternatives |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | Gap | Outside current target |

## 4. Robust

| Criterion | Level | Current coverage | Current source or limitation |
|---|---|---|---|
| 4.1.2 Name, Role, Value | A | Automated + mapped; manual checklist | broad axe ARIA/name rules, framework lint, and screen-reader review |
| 4.1.3 Status Messages | AA | Heuristic + manual checklist | Dynamic-announcement evidence records observed live-region mutations; timing, priority, and screen-reader usefulness remain manual |

## Priority Gaps

1. Add deeper keyboard/focus task traversal for 2.1.1, 2.1.2, 2.4.3, 2.4.7,
   and 2.4.11 beyond the current bounded path evidence.
2. Validate the full A/AA manual-review prompt set in real audits and tighten
   wording where reviewers need clearer evidence examples.
3. Convert selected manual-only prompts into safer heuristic evidence where the
   signal can be collected without false pass/fail claims.

## Interpretation

The project provides useful automated evidence, but it does not currently
check every WCAG 2.2 AA criterion. The accurate product statement is:

> Supports WCAG 2.2 AA review by combining automated checks, visual evidence,
> and selected manual review prompts; complete conformance still requires
> criterion-by-criterion human evaluation.
