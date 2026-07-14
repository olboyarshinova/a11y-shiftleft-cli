# External Validation Protocol

Use this protocol when you want to compare `a11y-shiftleft-cli` with other
accessibility tools on the same pages, states, and date. The goal is evidence,
not a leaderboard: record overlap, unique findings, manual-review findings, and
confirmed false positives.

## When To Use It

- Before a public comparison post or case study.
- Before claiming that a new release improves coverage or reduces noise.
- When a team asks why this CLI found something Lighthouse, WAVE, Pa11y, or a
  browser extension did not find.
- When a reported issue might be a false positive and needs independent review.

Do not use this protocol to claim legal conformance. It is a repeatable
validation workflow for tool behavior.

## Tools To Compare

Use the tools that are relevant to the target team. A balanced set is:

| Tool | Suggested role in comparison |
|---|---|
| `a11y-shiftleft-cli` | Dynamic exploration, screenshots, keyboard evidence, local reports |
| Lighthouse | Score-oriented browser signal and widely recognized baseline |
| Pa11y | CLI-oriented automated comparison for known URLs |
| WAVE | Human-readable page review and visual browser-extension evidence |
| Accessibility Insights | Guided FastPass and assisted manual checks |
| ARC Toolkit | Browser-extension review used by many accessibility practitioners |
| Siteimprove Accessibility Checker | Browser-extension comparison for page-level findings |

Record the exact tool name, version, browser, date, and target URL for every
run. If a tool is a browser extension and does not expose a version in the
report, record the browser extension version from the browser extensions page.

## Step 1: Freeze The Scope

Create one scope table before running tools:

| Field | Value |
|---|---|
| Project/site |  |
| Date/time |  |
| Tested by |  |
| Browser and version |  |
| Viewport/device |  |
| Auth state | public / logged-in / preview |
| URLs |  |
| UI states | initial page, opened modal, form error state, dark mode, etc. |
| Exclusions | third-party ads, CAPTCHA, authenticated data, destructive actions |

Use the same URL, login state, viewport, and UI state for each tool whenever
possible. If a tool cannot reach a state, record `not supported` instead of
silently dropping that state.

## Step 2: Run a11y-shiftleft

For local review with visual evidence:

```bash
export APP_URL=https://example.com
npx a11y-shiftleft-cli audit \
  --url $APP_URL \
  --max-depth 2 \
  --out reports/a11y-shiftleft \
  --open
```

For a faster known-URL comparison:

```bash
npx a11y-shiftleft-cli check \
  --dynamic \
  --url $APP_URL \
  --out reports/a11y-shiftleft-check \
  --gate report-only
```

If the site contains private data, use:

```bash
npx a11y-shiftleft-cli audit \
  --url $APP_URL \
  --out reports/a11y-shiftleft \
  --no-screenshots
```

Keep the generated JSON and visual report. Do not commit private reports or
screenshots.

## Step 3: Run Comparison Tools

Record the closest equivalent result from each tool:

| Tool | Minimum evidence to save |
|---|---|
| Lighthouse | Accessibility score, failed audits, manual audits, browser version |
| Pa11y | CLI output or JSON output for the same URL |
| WAVE | Extension screenshot or exported summary, if available |
| Accessibility Insights | FastPass result and any assisted-check notes |
| ARC Toolkit | Extension summary and affected selectors if available |
| Siteimprove | Extension summary and affected selectors if available |

For CLI tools, store outputs under a local folder such as
`reports/external-validation/`. For browser extensions, save screenshots or a
short Markdown note with the visible rule, selector, and URL.

## Step 4: Normalize Findings

Create a table like this:

| Finding ID | URL/state | Rule or criterion | Selector/target | Found by | Severity | Needs review? | Confirmed? | Notes |
|---|---|---|---|---|---|---|---|---|
| F-001 | `/checkout`, form error | WCAG 3.3.1 | `#account-code` | a11y-shiftleft, WAVE | critical | no | yes | Error text is not associated with field |
| F-002 | `/about`, hero text | WCAG 1.4.3 | `.hero-title` | Pa11y | warning | yes | pending | Background image makes contrast require manual review |

Use one row per confirmed user-facing issue, not one row per raw tool message.
If three tools report the same selector and WCAG criterion, keep one finding
with all tools listed in `Found by`.

## Step 5: Classify Outcomes

Use these labels:

| Label | Meaning |
|---|---|
| `overlap` | Two or more tools found the same issue |
| `a11y-shiftleft-only` | Only this CLI found it |
| `external-only` | Another tool found it and this CLI did not |
| `needs-review` | Automation cannot prove pass/fail without human judgment |
| `confirmed` | Human review confirmed a real accessibility issue |
| `false-positive` | Human review confirmed the finding is not an issue |
| `third-party` | Issue appears inside embedded content or third-party UI |
| `not-supported` | Tool cannot scan the required state or auth flow |

Do not count `needs-review` as a confirmed failure until a human review
verifies it.

## Step 6: Summarize Results

Use this summary for case studies or release notes:

| Metric | Value |
|---|---:|
| URLs/states compared |  |
| Total normalized findings |  |
| Confirmed findings |  |
| Findings requiring manual review |  |
| Confirmed false positives |  |
| Overlap findings |  |
| a11y-shiftleft-only confirmed findings |  |
| External-only confirmed findings |  |
| Third-party findings |  |

Then add a short narrative:

```txt
On YYYY-MM-DD, we compared the same N URLs/states with a11y-shiftleft-cli,
Lighthouse, Pa11y, WAVE, and Accessibility Insights. We normalized duplicate
tool messages into M user-facing findings. X findings overlapped across tools,
Y required manual review, and Z were confirmed false positives. The comparison
identified [specific gap or strength], which will guide the next release.
```

## Privacy Notes

- Keep reports local unless the site owner explicitly approves sharing.
- Redact screenshots that include personal, payment, health, account, or
  authenticated customer data.
- Prefer `--no-screenshots` for production customer pages.
- Do not publish raw selectors, URLs, or screenshots from private systems.
- Use anonymized summaries for public posts.

## What To Do With Gaps

When another tool finds something this CLI misses, open an issue with:

- URL/state and reproduction steps.
- Tool name and version.
- Rule/criterion and selector.
- Whether the issue was manually confirmed.
- Whether the target is first-party, third-party, or blocked by auth/CAPTCHA.

When this CLI finds something another tool misses, document why:

- Was it inside a discovered UI state?
- Was it keyboard, reflow, manual-review, or screenshot evidence?
- Was it a `needs-review` finding rather than a confirmed automated failure?

This keeps comparison work useful without overclaiming coverage.
