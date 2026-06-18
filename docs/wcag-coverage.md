# WCAG 2.2 Coverage Matrix

Last reviewed: 2026-06-18

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
- Focus Order now has static signals, a bounded forward-Tab path, and a manual
  checklist; complete task semantics and reverse traversal remain manual.
- 33 of 55 A/AA criteria have either an automated signal or an explicitly
  mapped `--semi-auto` review step.
- 22 of 55 A/AA criteria currently have no dedicated coverage.
- AAA is reported below for completeness, but is not the current product
  conformance target.

## 1. Perceivable

| Criterion | Level | Current coverage | Current source or limitation |
|---|---|---|---|
| 1.1.1 Non-text Content | A | Automated + mapped; manual checklist | axe image/ARIA alternative rules, framework lint, alternative-text and logo-purpose review |
| 1.2.1 Audio-only and Video-only (Prerecorded) | A | Automated + mapped; manual checklist | axe `audio-caption`; media checklist cannot validate transcript quality automatically |
| 1.2.2 Captions (Prerecorded) | A | Automated + mapped; manual checklist | axe `video-caption`; manual caption accuracy review |
| 1.2.3 Audio Description or Media Alternative (Prerecorded) | A | Gap | No dedicated mapped review |
| 1.2.4 Captions (Live) | AA | Gap | Live caption presence and quality are not tested |
| 1.2.5 Audio Description (Prerecorded) | AA | Gap | No dedicated mapped review |
| 1.2.6 Sign Language (Prerecorded) | AAA | Gap | Outside current target |
| 1.2.7 Extended Audio Description (Prerecorded) | AAA | Gap | Outside current target |
| 1.2.8 Media Alternative (Prerecorded) | AAA | Gap | Outside current target |
| 1.2.9 Audio-only (Live) | AAA | Gap | Outside current target |
| 1.3.1 Info and Relationships | A | Automated + mapped; manual checklist | axe structure/table/list rules, labels, landmarks, form review |
| 1.3.2 Meaningful Sequence | A | Manual checklist | Logical reading and navigation order review |
| 1.3.3 Sensory Characteristics | A | Gap | Instructions referring only to shape, position, sound, or color are not reviewed |
| 1.3.4 Orientation | AA | Automated + mapped | axe `css-orientation-lock` |
| 1.3.5 Identify Input Purpose | AA | Automated + mapped | axe `autocomplete-valid` |
| 1.3.6 Identify Purpose | AAA | Gap | Outside current target |
| 1.4.1 Use of Color | A | Automated + mapped | axe `link-in-text-block` detects only a subset |
| 1.4.2 Audio Control | A | Automated + mapped | axe `no-autoplay-audio` |
| 1.4.3 Contrast (Minimum) | AA | Automated + mapped | axe `color-contrast` with measured and required ratios |
| 1.4.4 Resize Text | AA | Automated + mapped; manual checklist | axe viewport signal plus 200% zoom review |
| 1.4.5 Images of Text | AA | Gap | Image purpose and rendered text require review |
| 1.4.6 Contrast (Enhanced) | AAA | Automated, metadata gap | axe `color-contrast-enhanced`; outside current target |
| 1.4.7 Low or No Background Audio | AAA | Gap | Outside current target |
| 1.4.8 Visual Presentation | AAA | Gap | Outside current target |
| 1.4.9 Images of Text (No Exception) | AAA | Gap | Outside current target |
| 1.4.10 Reflow | AA | Manual checklist | 320 CSS pixel and zoom review; no automated viewport assertion |
| 1.4.11 Non-text Contrast | AA | Gap | No reliable control, focus-indicator, or graphical-object contrast check |
| 1.4.12 Text Spacing | AA | Automated + mapped | axe `avoid-inline-spacing` is only a limited signal |
| 1.4.13 Content on Hover or Focus | AA | Gap | Hover/focus dismissal, persistence, and pointer movement are not exercised |

## 2. Operable

| Criterion | Level | Current coverage | Current source or limitation |
|---|---|---|---|
| 2.1.1 Keyboard | A | Automated + mapped; manual checklist | axe, framework lint, and bounded Tab traversal detect common failures; no complete keyboard task traversal |
| 2.1.2 No Keyboard Trap | A | Partial automated + mapped; manual checklist | keyboard runner detects stuck focus and early cycles; modal escape and complex widgets still require review |
| 2.1.3 Keyboard (No Exception) | AAA | Automated, metadata gap | axe scrollable-region signal only; outside current target |
| 2.1.4 Character Key Shortcuts | A | Gap | No shortcut discovery or remapping test |
| 2.2.1 Timing Adjustable | A | Automated + mapped | axe `meta-refresh` detects only one failure pattern |
| 2.2.2 Pause, Stop, Hide | A | Automated + mapped; manual checklist | axe blink/marquee checks plus media and motion review |
| 2.2.3 No Timing | AAA | Gap | Outside current target |
| 2.2.4 Interruptions | AAA | Automated, metadata gap | axe meta-refresh signal only; outside current target |
| 2.2.5 Re-authenticating | AAA | Gap | Outside current target |
| 2.2.6 Timeouts | AAA | Gap | Outside current target |
| 2.3.1 Three Flashes or Below Threshold | A | Manual checklist | No flash-frequency analysis |
| 2.3.2 Three Flashes | AAA | Gap | Outside current target |
| 2.3.3 Animation from Interactions | AAA | Gap | Outside current target |
| 2.4.1 Bypass Blocks | A | Automated + mapped; manual checklist | axe `bypass` plus landmark and skip-link review |
| 2.4.2 Page Titled | A | Automated + mapped | axe title rule plus duplicate and placeholder title analysis across URLs |
| 2.4.3 Focus Order | A | Partial automated + mapped; manual checklist | Angular tabindex/focus lint plus a recorded bounded forward-Tab path; logical task order still requires review |
| 2.4.4 Link Purpose (In Context) | A | Automated + mapped | axe link and area accessible-name rules cover common failures |
| 2.4.5 Multiple Ways | AA | Gap | No sitemap, search, navigation, or related-page comparison |
| 2.4.6 Headings and Labels | AA | Manual checklist | Structural signals exist, but descriptive quality needs explicit review |
| 2.4.7 Focus Visible | AA | Partial automated + mapped; manual checklist | keyboard runner checks viewport visibility and outline/box-shadow indicators; custom visual treatments require review |
| 2.4.8 Location | AAA | Gap | Outside current target |
| 2.4.9 Link Purpose (Link Only) | AAA | Automated, metadata gap | axe identical-link signal; outside current target |
| 2.4.10 Section Headings | AAA | Gap | Outside current target |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Partial automated + mapped; manual checklist | keyboard runner checks focused-element geometry and center-point occlusion; complete boundary coverage requires review |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Gap | Outside current target |
| 2.4.13 Focus Appearance | AAA | Gap | Outside current target |
| 2.5.1 Pointer Gestures | A | Gap | Multipoint/path gestures and alternatives are not exercised |
| 2.5.2 Pointer Cancellation | A | Gap | Down-event activation and cancellation behavior are not tested |
| 2.5.3 Label in Name | A | Automated + mapped | axe `label-content-name-mismatch` |
| 2.5.4 Motion Actuation | A | Gap | Device-motion behavior and alternatives are not tested |
| 2.5.5 Target Size (Enhanced) | AAA | Gap | Outside current target |
| 2.5.6 Concurrent Input Mechanisms | AAA | Gap | Outside current target |
| 2.5.7 Dragging Movements | AA | Gap | Catalog entry exists, but no adapter currently emits `dragging-movements` |
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
| 3.2.1 On Focus | A | Gap | Focus-triggered context changes are not exercised |
| 3.2.2 On Input | A | Gap | Input-triggered context changes are not exercised |
| 3.2.3 Consistent Navigation | AA | Gap | Exploration does not compare repeated navigation order across pages |
| 3.2.4 Consistent Identification | AA | Gap | Same-purpose component naming is not compared across pages |
| 3.2.5 Change on Request | AAA | Automated, metadata gap | axe meta-refresh signal only; outside current target |
| 3.2.6 Consistent Help | A | Gap | Help mechanisms are not identified and compared across pages |
| 3.3.1 Error Identification | A | Manual checklist | Representative task review only; form errors are not triggered systematically |
| 3.3.2 Labels or Instructions | A | Automated + mapped; manual checklist | axe/framework label rules plus quality review |
| 3.3.3 Error Suggestion | AA | Manual checklist | Representative task review only |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Gap | Safe mode intentionally avoids completing these transactions |
| 3.3.5 Help | AAA | Gap | Outside current target |
| 3.3.6 Error Prevention (All) | AAA | Gap | Outside current target |
| 3.3.7 Redundant Entry | A | Gap | Multi-step form values are not tracked |
| 3.3.8 Accessible Authentication (Minimum) | AA | Gap | Catalog entry exists, but no adapter currently emits `accessible-authentication` |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | Gap | Outside current target |

## 4. Robust

| Criterion | Level | Current coverage | Current source or limitation |
|---|---|---|---|
| 4.1.2 Name, Role, Value | A | Automated + mapped; manual checklist | broad axe ARIA/name rules, framework lint, and screen-reader review |
| 4.1.3 Status Messages | AA | Gap | Live-region and status announcement behavior is not triggered or observed |

## Priority Gaps

1. Add a keyboard/focus runner for 2.1.1, 2.1.2, 2.4.3, 2.4.7, and 2.4.11,
   with findings merged into the normal report pipeline.
2. Expand `--semi-auto` so every A/AA criterion without reliable automation
   has an explicit review step and evidence field.
3. Do not present placeholder mappings for 2.5.7 or 3.3.8 as implemented until
   an adapter or manual check actually produces evidence for them.

## Interpretation

The project provides useful automated evidence, but it does not currently
check every WCAG 2.2 AA criterion. The accurate product statement is:

> Supports WCAG 2.2 AA review by combining automated checks, visual evidence,
> and selected manual review prompts; complete conformance still requires
> criterion-by-criterion human evaluation.
