# Evidence Methodology

This document defines how `a11y-shiftleft-cli` should collect and report
evidence for finding quality, developer trust, and review effort.

The project does not claim complete accessibility conformance. Automated scans
are evidence for risk detection and remediation tracking, not a replacement for
manual review.

## Machine-Readable Evidence Export

Use `evidence export` when a script, spreadsheet, or validation study needs a
stable dataset instead of parsing HTML or Markdown:

```bash
npx a11y-shiftleft-cli evidence export \
  --report reports/a11y-report.json \
  --out reports/a11y-evidence.jsonl \
  --format jsonl
```

Use `jsonld` when another tool needs linked-data-style evidence inspired by
EARL terms:

```bash
npx a11y-shiftleft-cli evidence export \
  --report reports/a11y-report.json \
  --out reports/a11y-evidence.jsonld \
  --format jsonld
```

The export stays local and contains structured finding evidence: fingerprint,
rule, severity, WCAG metadata, URL, selector or source location, ownership,
confidence, and remediation guidance. It does not include screenshots or
rendered HTML.

The export includes compact provenance metadata from the source report: tool
version, command profile, requested and included URLs, browser evidence,
automation flags, scan limits, and selected standards preset. This helps another
script or reviewer understand how the evidence was produced without reopening
the original report.

When a report includes manual-review or journey evidence, the export includes a
compact review summary with checklist status counts, target counts, task
evidence counts, temporary acceptances, and journey impact totals. This keeps
manual validation work visible next to automated findings without exporting
screenshots or raw HTML.

When writing to `--out`, the command prints a compact run summary with severity
counts, finding types, the most affected URL, and the most common WCAG criterion.
This keeps CI logs and validation runs readable without opening the full export.

Each exported finding also has a stable `id` derived from the finding
fingerprint. Use this shorter identifier when joining JSON, JSONL, JSON-LD,
spreadsheets, ticket drafts, or validation-study rows without exposing the full
fingerprint in every downstream artifact.

Lifecycle fields such as `duplicateCount`, `baselineStatus`, and `retestStatus`
are included when available. These are useful for longitudinal studies and CI
rollouts because they show whether a finding is new, already accepted in the
baseline, still remaining after a retest, or representative of repeated
occurrences.

The export summary also includes lifecycle counts, including duplicate
occurrences, baseline-new/existing findings, and retest-new/remaining findings.
This gives dashboards and validation scripts a quick run-level signal without
requiring every consumer to recalculate the same aggregates.

Run-level grouped counts are included for source, category, confidence, and
finding type. These fields are intended for dashboards, spreadsheets, and
validation scripts that need trends without parsing every record first.
The export also includes grouped counts by URL, WCAG criterion, and WCAG level
so downstream tools can summarize affected pages and standards coverage without
recomputing those distributions.

The JSON-LD export is intentionally described as EARL-inspired evidence, not a
formal conformance certificate. `needs-review` findings are represented as
`earl:cantTell`; automated findings are represented as `earl:failed` evidence
for triage and remediation.

## Finding Types

Reports separate three kinds of evidence:

| Type | Meaning |
|---|---|
| `wcag` | The rule is mapped to one or more WCAG success criteria. |
| `best-practice` | The scanner identifies useful guidance without claiming a WCAG failure. |
| `unmapped` | The finding needs review because no supported standards mapping is available. |

For example, axe maps `color-contrast` to WCAG 1.4.3. Axe tags
`heading-order`, `region`, and `page-has-heading-one` as best-practice rules,
so the reports must not present those findings as confirmed WCAG violations.

## Likely Root Causes

One shared component can produce the same finding on several routes. Reports
group matching rule and target patterns into likely root causes while retaining
every original occurrence. For example, five contrast findings on the same
active-navigation class may represent one design-token fix across five pages.

This grouping is deterministic but heuristic. It estimates remediation units;
it does not prove that two DOM nodes share the same source implementation.

## Why Confidence Exists

Severity, confidence, and user impact answer different questions:

| Field | Question | Example |
|---|---|---|
| `severity` | How risky is the issue if it is real? | Missing button name can block screen reader users. |
| `confidence` | How strong is the tooling evidence? | axe found a concrete DOM node and mapped it to WCAG. |
| `userImpact` | Who is likely affected in practice? | Screen reader and voice-control users may not identify an unnamed button. |

This lets teams triage in a healthier order:

1. High-confidence critical findings.
2. High-confidence warnings.
3. Medium-confidence findings that need source review.
4. Low-confidence findings and adapter health issues.

## Current Confidence Policy

| Source evidence | Confidence | Score | Reason |
|---|---:|---:|---|
| axe finding with selector and WCAG mapping | high | 95 | Rendered DOM evidence plus standards mapping. |
| axe finding with selector but no WCAG mapping | medium | 75 | Concrete DOM evidence, but best-practice or unmapped rule. |
| ESLint accessibility rule with file, line, and WCAG mapping | medium | 80 | Static source evidence plus standards mapping. |
| ESLint accessibility rule with file and line only | medium | 70 | Static source evidence, but no standards mapping. |
| Adapter scan health finding | low | 40 | Useful operational signal, not a validated accessibility violation. |
| Unknown source | low | 50 | Review manually before treating as confirmed. |

These scores are deterministic and intentionally conservative. They are not
machine-learning predictions.

## User Impact

Reports include a deterministic `userImpact` object for each finding:

```json
{
  "level": "significant",
  "affectedUsers": ["Low-vision users", "Users in bright environments"],
  "reason": "Low contrast can make text or controls hard to perceive."
}
```

The impact level is not a legal conclusion. It is a triage lens that helps teams
decide which findings may block real tasks, which findings need a workaround,
and which findings are mainly implementation-quality signals.

## Issue Categories

Findings are grouped into accessibility families so reports are easier to scan:

```txt
aria
contrast
focus
forms
headings
images
keyboard
landmarks
structure
widgets
best-practice
adapter
other
```

Categories are inferred from WCAG criteria, rule IDs, tags, and messages. They
are meant for triage and reporting, not for legal classification.

## Validation Dataset

Use a small but reproducible corpus before claiming quality improvements:

| Dimension | Minimum |
|---|---:|
| Demo repositories | 3 |
| Frameworks | React, Vue, Angular |
| Pull requests | 20+ |
| Sprints | 4 |
| Reviewers | 2 independent reviewers where possible |

Each reviewed finding should be labeled:

```csv
finding_id,rule_id,source,category,severity,confidence,confidence_score,review_label,review_reason
```

Allowed `review_label` values:

```txt
confirmed
false_positive
duplicate
needs_manual_review
out_of_scope
```

## Metrics

False positive rate:

```txt
false_positive_rate = false_positive_count / max(unique_findings, 1)
```

Confirmed issue rate:

```txt
confirmed_issue_rate = confirmed_issue_count / max(unique_findings, 1)
```

High-confidence precision:

```txt
high_confidence_precision =
  high_confidence_confirmed_count / max(high_confidence_reviewed_count, 1)
```

Developer review load:

```txt
review_load = unique_findings + needs_manual_review_count
```

## Related Work Notes

Paradise on `a11ybob.com` is useful related work because it separates severity
from confidence, documents limitations clearly, and explains findings through
an analyser taxonomy. `a11y-shiftleft-cli` should not copy Paradise code or its
source-level analyser architecture. The practical takeaway for this project is
the reporting discipline: confidence, issue families, suggested fixes, and
honest limitations.

## Reporting Rules

- Report confidence as evidence strength, not severity.
- Keep adapter failures visible but low-confidence.
- Do not claim that automated scans prove complete WCAG conformance.
- Show low-confidence findings as review leads, not confirmed defects.
- Keep raw JSON available so external analysis can reproduce summary numbers.
