# Marketing Playbook

This playbook turns the product positioning into repeatable content. Keep the
message simple:

```txt
Run one command. Get a visual accessibility report for your web app.
```

## Audience

| Audience | Pain | Message |
|---|---|---|
| Frontend developers | Accessibility feels important but hard to start. | Use `audit` to get a visual report from a running app. |
| Tech leads | Accessibility needs to fit PR and CI workflows. | Start locally with `audit`; add `check` to CI later. |
| QA engineers | Reports need evidence, not only JSON. | Use screenshots, keyboard evidence, and manual-review tasks. |
| Accessibility specialists | Automated checks cover only part of the work. | Use the report as triage evidence, then complete manual review. |
| Open-source contributors | They need small, safe tasks. | Pick a focused issue: docs, fixtures, WCAG mapping, report copy. |
| Product and design partners | They need visual proof and plain language. | Show screenshots, impact labels, and fix guidance. |

Primary audience for the next release:

```txt
Frontend developers with 2-6 years of experience who want a practical way to
start accessibility checks without becoming WCAG experts first.
```

## Content Pillars

| Pillar | Purpose | Example |
|---|---|---|
| One-command workflow | Make the first run feel easy. | `npx a11y-shiftleft-cli audit --url http://localhost:5173 --open` |
| Visual evidence | Show why screenshots matter. | "A list of selectors is not enough; show the UI state." |
| Lighthouse nuance | Explain why scores are useful but incomplete. | "Lighthouse 100 is a signal, not a full review." |
| User impact | Translate findings into affected people. | "Severity tells risk. User impact tells who may be affected." |
| Build in public | Show steady project progress. | "This week I simplified the README around `audit`." |
| Privacy and safety | Build trust for real apps. | "Use `--no-screenshots` for sensitive data." |
| Open-source contribution | Invite contributors without pressure. | "Good first issues are focused and reviewable." |

## Four-Week Content Calendar

| Week | Monday | Tuesday | Wednesday | Thursday | Friday |
|---|---|---|---|---|---|
| 1 | Build in public: why the README now starts with `audit` | Carousel: Lighthouse 100 is not a complete accessibility review | Short video: `audit --open` in 30 seconds | Tutorial: add visual a11y checks to a local app | Post: what user-impact labels mean |
| 2 | Real-world lesson: third-party iframe ownership | Carousel: what a useful a11y report should include | Short video: annotated screenshots and fix guidance | Tutorial: add `check` to CI after local audit works | Post: privacy mode and `--no-screenshots` |
| 3 | Build in public: one thing simplified this week | Carousel: static vs dynamic accessibility checks | Short video: keyboard evidence in the visual report | Tutorial: baseline mode for existing apps | Post: why manual review still matters |
| 4 | Real-world lesson: when bot detection blocks scans | Carousel: accessibility bug report anatomy | Short video: contrast ratio and color suggestions | Tutorial: GitHub Actions workflow generator | Post: open-source contribution invitation |

Repeat the calendar with new examples from demo reports, user feedback, and
small shipped improvements.

## Short Video Scripts

### Script 1: Accessibility Audit In 30 Seconds

Scene list:

1. Terminal with a running app.
2. Run:

   ```bash
   npx a11y-shiftleft-cli audit --url http://localhost:5173 --open
   ```

3. Show the HTML report opening.
4. Zoom into annotated screenshots.
5. Show WCAG level and `How to fix`.

Voiceover:

```txt
Most accessibility tools give developers a list. I wanted a report that shows
where the problem appears, why it matters, and how to start fixing it.
```

CTA:

```txt
Try the package: npmjs.com/package/a11y-shiftleft-cli
```

### Script 2: Lighthouse 100 Is Not The End

Scene list:

1. Show Lighthouse accessibility score.
2. Show the visual audit report.
3. Show manual-review and keyboard evidence.
4. Show third-party embedded-content label.

Voiceover:

```txt
Lighthouse is useful, but accessibility needs more than one score. A visual
audit can keep Lighthouse evidence, axe findings, keyboard checks, and manual
review tasks in one place.
```

CTA:

```txt
Use scores as signals. Use evidence for decisions.
```

### Script 3: Severity vs User Impact

Scene list:

1. Show an unnamed button finding.
2. Show severity.
3. Show `userImpact: blocker`.
4. Show affected users and fix guidance.

Voiceover:

```txt
Severity tells you how risky a finding is. User impact explains who may be
affected in practice: keyboard users, screen reader users, voice-control users,
or low-vision users.
```

CTA:

```txt
Make accessibility reports easier to triage.
```

## Carousel Outlines

### Carousel 1: What A Useful Accessibility Report Needs

Slides:

1. A11y reports should be useful, not scary.
2. Show the screenshot.
3. Show WCAG A/AA metadata.
4. Show user impact.
5. Show fix guidance.
6. Show keyboard and manual-review evidence.
7. Start with one command: `audit`.

### Carousel 2: Lighthouse 100 Is A Signal, Not A Certificate

Slides:

1. Lighthouse 100 is good. It is not the whole review.
2. Automated rules cover only part of accessibility.
3. Interaction states matter.
4. Keyboard evidence matters.
5. Third-party embeds need ownership context.
6. Manual review still matters.
7. Combine scores with visual evidence.

### Carousel 3: Add Accessibility Checks Without A Big Setup

Slides:

1. Start with the app you already run locally.
2. Install the CLI.
3. Run `audit --open`.
4. Review the visual report.
5. Fix top issues.
6. Add CI later with `check`.
7. Keep accessibility close to development.

## LinkedIn Post Templates

### Post 1: One Successful First Run

```txt
I simplified my open-source accessibility tool around one command:

npx a11y-shiftleft-cli audit --url http://localhost:5173 --open

The lesson: developers do not need every option on day one.
They need one successful first run.

The report includes annotated screenshots, WCAG metadata, user-impact labels,
keyboard evidence, and fix guidance.
```

### Post 2: Visual Reports

```txt
Accessibility findings are easier to fix when developers can see the UI state.

That is why I am building a visual audit workflow:
- screenshots
- highlighted findings
- WCAG A/AA labels
- user-impact labels
- how-to-fix guidance
- keyboard and manual-review evidence

The goal is not to replace human review.
The goal is to make the first pass actionable.
```

### Post 3: Lighthouse Nuance

```txt
Lighthouse accessibility score is useful.
It is also not the full accessibility story.

Some issues depend on interaction states.
Some require keyboard testing.
Some need manual screen-reader review.
Some come from third-party embeds.

I am building a tool that keeps these signals together in one visual report.
```

## Lead Magnets

| Lead magnet | Format | CTA |
|---|---|---|
| Accessibility PR Checklist | Markdown/PDF | "Use this checklist before merging UI changes." |
| WCAG 2.2 AA Quick Reference For Developers | One-page PDF | "Know what automation can and cannot catch." |
| A11y Bug Report Template | GitHub issue template | "Report actionable findings with evidence." |
| Lighthouse vs axe vs visual audit | One-page comparison | "Pick the right tool for the job." |
| Keyboard Smoke Test Checklist | Markdown/PDF | "Catch focus and keyboard blockers before release." |

Start with the Accessibility PR Checklist because it is easy to use, easy to
share, and directly connected to the product workflow.

## Calls To Action

Use soft CTAs that invite testing and feedback:

```txt
Try it on a local app and tell me where the first run is confusing.
```

```txt
If your team already uses Lighthouse, try adding visual evidence next.
```

```txt
I am looking for feedback from frontend developers and accessibility reviewers.
```

Avoid overclaiming:

```txt
This is not a conformance certificate.
```

```txt
Automated checks do not replace manual accessibility review.
```

```txt
Use the report as evidence for triage and remediation.
```

## Weekly Operating Rhythm

| Day | Action |
|---|---|
| Monday | Publish one build-in-public update. |
| Tuesday | Reply to comments and collect objections/questions. |
| Wednesday | Publish one educational carousel or short video. |
| Thursday | Improve docs based on repeated questions. |
| Friday | Publish one concrete product/demo screenshot. |

Track lightweight metrics:

- npm downloads
- GitHub stars
- forks
- issue comments
- PRs
- LinkedIn comments and saves
- questions repeated by more than one person

