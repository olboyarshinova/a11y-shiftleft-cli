# Empirical Validation Protocol

This document defines the reproducible evaluation plan for `a11y-shiftleft-cli`.
The goal is to compare a baseline workflow against a shift-left intervention
that adds static checks, dynamic checks, deduplication, severity triage, and
CI/PR feedback.

## Research Question

Does an accessibility orchestration CLI that works across web frameworks reduce
accessibility defects and developer review effort compared with ad hoc or
manually triggered accessibility tooling?

## Study Design

| Item | Plan |
|---|---|
| Design | Controlled baseline vs intervention |
| Repositories | React, Vue, and Angular demo projects |
| Pull requests | At least 20 total PRs |
| Duration | Four development sprints |
| Baseline | Existing lint/test workflow without `a11y-shiftleft-cli` |
| Intervention | `a11y-shiftleft-cli` in CI with PR reports |
| Unit of analysis | Pull request |

## Minimum Dataset

Create one row per pull request:

```csv
pr_id,repo,framework,phase,opened_at,merged_at,violations_raw,violations_unique,critical,warning,info,high_confidence,medium_confidence,low_confidence,duplicates_removed,duplicate_rate,time_to_fix_hours,false_positive_count,confirmed_issue_count,dx_score
```

The repository includes a blank template and a small synthetic example:

```txt
data/pr-metrics-template.csv
data/sample-pr-metrics.csv
```

Where:

| Field | Definition |
|---|---|
| `phase` | `baseline` or `intervention` |
| `violations_raw` | Findings before deduplication |
| `violations_unique` | Findings after deduplication |
| `high_confidence`, `medium_confidence`, `low_confidence` | Findings grouped by tooling evidence strength |
| `time_to_fix_hours` | Hours between first accessibility finding and merged fix |
| `false_positive_count` | Findings marked by reviewers as not actionable |
| `confirmed_issue_count` | Findings accepted as actionable |
| `dx_score` | Developer experience score from a 1-5 post-PR survey |

## CLI Data Collection

Static scan:

```bash
npx a11y-shiftleft check \
  --static \
  --framework react \
  --include "src/**/*.{js,jsx,ts,tsx}" \
  --out reports \
  --fail-on none
```

Dynamic scan:

```bash
npx a11y-shiftleft check \
  --dynamic \
  --url http://localhost:3000 \
  --out reports \
  --fail-on none
```

Combined scan:

```bash
npx a11y-shiftleft check \
  --url http://localhost:3000 \
  --out reports \
  --fail-on none
```

Collect these artifacts from every PR run:

```txt
reports/a11y-report.json
reports/a11y-metrics.csv
reports/a11y-comment.md
reports/a11y-manual-checklist.md
```

Generate the manual review checklist during intervention PRs:

```bash
npx a11y-shiftleft check \
  --url http://localhost:3000 \
  --semi-auto \
  --out reports \
  --fail-on none
```

Use `a11y-manual-checklist.md` to record human-review evidence for issues that
automated tools cannot reliably detect.

## Metrics

False positive rate:

```txt
false_positive_rate = false_positive_count / max(violations_unique, 1)
```

Duplicate rate:

```txt
duplicate_rate = duplicates_removed / max(violations_raw, 1)
```

Mean time to fix:

```txt
mean_time_to_fix = sum(time_to_fix_hours) / number_of_fixed_prs
```

Defect reduction:

```txt
defect_reduction = (baseline_mean_unique - intervention_mean_unique) / baseline_mean_unique
```

## Statistical Tests

Use a two-sided t-test when the metric is approximately normally distributed.
Use Mann-Whitney U when the distribution is skewed or the sample size is small.

Primary comparisons:

| Outcome | Baseline vs intervention test |
|---|---|
| `violations_unique` | Mann-Whitney U or t-test |
| `time_to_fix_hours` | Mann-Whitney U |
| `false_positive_rate` | Mann-Whitney U |
| `dx_score` | Mann-Whitney U |

Effect size for mean differences:

```txt
Cohen's d = (mean_intervention - mean_baseline) / pooled_standard_deviation
```

Pooled standard deviation:

```txt
pooled_sd = sqrt(((n1 - 1) * sd1^2 + (n2 - 1) * sd2^2) / (n1 + n2 - 2))
```

Report:

```txt
n, mean, median, standard deviation, p-value, effect size, confidence interval
```

The MVP analysis script reports descriptive statistics, percent change, and
Cohen's d. P-values should be added once the study has enough real PR data for
the selected statistical test.

Run analysis against the synthetic sample:

```bash
npm run analyze:metrics -- data/sample-pr-metrics.csv
```

Write the analysis summary to a JSON file:

```bash
npm run analyze:metrics -- data/sample-pr-metrics.csv --out analysis/summary.json
```

Run analysis against the study dataset:

```bash
npm run analyze:metrics -- data/pr-metrics-template.csv
```

## DX Survey

Ask developers to rate each statement from 1 to 5:

| Question | Scale |
|---|---|
| The accessibility feedback was easy to understand. | 1-5 |
| The findings were actionable during PR review. | 1-5 |
| The tool reduced repeated or duplicate accessibility warnings. | 1-5 |
| The workflow fit naturally into CI and PR review. | 1-5 |

Compute:

```txt
dx_score = average(question_1, question_2, question_3, question_4)
```

## Reproducibility Checklist

- Record CLI version and commit SHA.
- Store raw `a11y-report.json` files for every PR.
- Store `a11y-metrics.csv` exports.
- Store `a11y-manual-checklist.md` notes for semi-automated review PRs.
- Store periodic `analysis/adoption.json` snapshots for npm downloads and
  GitHub traffic when available.
- Store manual reviewer labels for false positives.
- Store survey responses without personal identifiers.
- Keep analysis scripts and generated figures in the repository.
- Document excluded PRs and exclusion reasons.

## Adoption Metrics

Collect npm and GitHub adoption telemetry:

```bash
npm run collect:adoption -- --out analysis/adoption.json
```

With a GitHub token, the script also collects traffic data for repository views,
clones, and referrers:

```bash
GITHUB_TOKEN=<github-token> npm run collect:adoption -- --out analysis/adoption.json
```

Interpretation limits:

- npm download counts are not human-user counts.
- npm public download metrics do not provide country-level geography.
- GitHub traffic data is short-lived, so store snapshots regularly.
- Geographic evidence should come from privacy-preserving docs or landing-page
  analytics, not from npm download totals.

## Current Fixtures

The repository includes small fixture projects:

```txt
examples/fixtures/react
examples/fixtures/vue
examples/fixtures/angular
```

Run:

```bash
npm run test:fixtures
```

The current fixture smoke test validates React, Vue, and Angular static
fallback behavior.
