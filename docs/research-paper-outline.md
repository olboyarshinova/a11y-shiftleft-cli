# Research Paper Outline

Working title:

```txt
Shift-Left Accessibility Validation: A Framework-Agnostic CLI Orchestrator for
Static, Dynamic, and Reproducible PR-Level Metrics
```

## Abstract

Summarize the accessibility problem, the shift-left intervention, the CLI
artifact, the baseline vs intervention study design, and the expected empirical
outcomes.

## Introduction

Topics to cover:

- Web accessibility defects remain common despite mature rule engines.
- Developers face fragmented tooling across static linters, browser scanners,
  CI workflows, and manual review.
- Existing tools are valuable but often operate as separate feedback channels.
- The research gap is orchestration: unified static and dynamic findings,
  deduplication, severity triage, PR feedback, and reproducible metrics.
- Contribution: an open-source npm CLI that integrates existing engines into a
  framework-agnostic shift-left workflow.

Research questions:

```txt
RQ1: Does the CLI reduce unique accessibility findings per PR compared with a
baseline workflow?

RQ2: Does the CLI reduce time-to-fix for accessibility findings?

RQ3: Does deduplication reduce duplicate warning volume and developer review
effort?

RQ4: Does PR-level feedback improve developer experience scores?
```

## Related Work

Compare against:

- axe-core and @axe-core/playwright
- Lighthouse
- WAVE
- Pa11y
- eslint-plugin-jsx-a11y
- framework-specific ESLint plugins for Vue and Angular
- shift-left testing and CI/CD feedback literature

Positioning:

```txt
The project does not replace accessibility engines. It orchestrates them into a
single reproducible workflow with metrics suitable for empirical evaluation.
```

## Methods

Artifact:

- Node.js npm CLI.
- Commands: `init`, `check`, `ci`.
- Static adapters: React, Vue, Angular.
- Dynamic adapter: axe via Playwright.
- Core engine: normalize, WCAG mapping, severity triage, deduplication.
- Reporters: JSON, CSV, Markdown.
- Metrics analysis: baseline/intervention CSV summary.

Study design:

- Controlled baseline vs intervention.
- Three demo repositories: React, Vue, Angular.
- At least 20 PRs across four sprints.
- Unit of analysis: pull request.

Primary metrics:

- `violations_unique`
- `time_to_fix_hours`
- `false_positive_rate`
- `duplicate_rate`
- `dx_score`

Statistical analysis:

- Descriptive statistics for all metrics.
- Mann-Whitney U for skewed or small-sample outcomes.
- Two-sided t-test where assumptions are reasonable.
- Cohen's d for effect size.

Reproducibility:

- Publish source code on GitHub.
- Publish npm package.
- Store raw reports and CSV metrics.
- Run `npm run analyze:metrics`.

## Results

Planned tables:

| Table | Content |
|---|---|
| Table 1 | Tool feature comparison |
| Table 2 | Baseline vs intervention descriptive metrics |
| Table 3 | Statistical test outcomes |
| Table 4 | Developer experience survey results |

Planned figures:

| Figure | Content |
|---|---|
| Figure 1 | CLI architecture and data flow |
| Figure 2 | Unique violations per PR by phase |
| Figure 3 | Time-to-fix by phase |
| Figure 4 | Duplicate rate and false-positive rate |

## Discussion

Topics:

- Interpretation of defect reduction and time-to-fix outcomes.
- How deduplication affects developer cognitive load.
- Tradeoffs of using existing engines instead of custom AST parsers.
- Limits of automated accessibility validation.
- Framework-specific limitations.
- Practical implications for CI/CD adoption.

## Threats To Validity

Internal validity:

- PR complexity may differ between phases.
- Developers may learn accessibility patterns over time.
- Reviewer labeling of false positives may be subjective.

External validity:

- Demo repositories may not represent large production systems.
- Results may vary across frameworks and component libraries.

Construct validity:

- Automated findings are proxies for accessibility defects.
- DX score is self-reported.
- Time-to-fix may include unrelated review delays.

Conclusion validity:

- Small sample sizes may limit statistical power.
- Non-normal distributions may require non-parametric tests.

## Conclusion

Restate the contribution:

- A framework-agnostic accessibility orchestration CLI.
- Reproducible PR-level metrics.
- Empirical validation path for shift-left accessibility workflows.

## Artifact Checklist

- GitHub repository.
- npm package.
- Reproducible fixtures.
- Raw reports.
- CSV metrics.
- Analysis script.
- Release notes.
