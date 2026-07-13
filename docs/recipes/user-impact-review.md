# User Impact Review

Use this recipe when a report has many findings and the team needs to decide
what to fix first. The goal is to connect technical rules to real product
tasks, not to replace WCAG review.

## Start With The User Task

For each high-priority finding, write one short sentence:

```txt
When a user tries to <complete task>, this issue may prevent or slow <action>.
```

Examples:

| Finding type | User task question |
|---|---|
| Button or link has no accessible name | Can a screen reader or voice-control user identify and activate the control? |
| Keyboard focus is lost or trapped | Can a keyboard-only user complete the task without refreshing or using a mouse? |
| Modal focus is not contained | Can a user understand that a dialog opened and close it predictably? |
| Low contrast | Can a low-vision user read the text in bright light or at normal zoom? |
| Missing image alternative text | Does the image carry meaning needed to complete the task? |
| Reflow or clipped text | Can a user at 400% zoom read and operate the page without hidden content? |
| Form error is not associated | Can a user understand what failed and how to correct it? |
| Embedded third-party content | Is the issue owned by the site team, the embed provider, or both? |

## Triage By Practical Impact

Use severity, WCAG level, and user impact together:

| Priority | Typical signal | What to do |
|---|---|---|
| Fix first | Critical finding, blocked keyboard/focus path, unnamed control, broken form flow | Fix before release or create an explicit tracked exception |
| Fix soon | Warning that affects repeated navigation, form completion, reflow, or common content | Put in the next remediation batch |
| Review manually | Needs-review finding, complex background, media quality, third-party iframe | Confirm with a human review before marking pass/fail |
| Track as debt | Best-practice or low-confidence finding without task impact | Keep visible, but do not block unrelated work |

Avoid using color alone, score alone, or issue count alone as the priority
model. A single blocked checkout button can matter more than many low-risk
warnings.

## Before And After Examples

| Issue | Before | Better |
|---|---|---|
| Icon-only close button | `<button>x</button>` | `<button aria-label="Close dialog">x</button>` |
| Custom clickable div | `<div onclick="save()">Save</div>` | `<button type="button">Save</button>` |
| Vague link | `<a href="/report">Click here</a>` | `<a href="/report">View accessibility report</a>` |
| Unassociated form error | Error text appears visually only | Connect the error with `aria-describedby` or native validation text |
| Low contrast status text | Pale text on a pale background | Adjust text or background until the required contrast is met |
| Modal opens with focus behind it | Focus remains on the page | Move focus into the dialog and restore focus after close |

## Manual Review Prompts

Automated checks cannot prove every part of accessibility. For high-value flows,
record short manual notes:

| Area | Prompt |
|---|---|
| Keyboard | Can the task be completed with Tab, Shift+Tab, Enter, Space, and Escape? |
| Screen reader | Are headings, landmarks, controls, errors, and status changes understandable? |
| Zoom and reflow | Does the task work at 200% and 400% without hidden content? |
| Motion | Can animation be paused or reduced when it affects reading or control? |
| Forms | Are required fields, errors, and correction steps clear? |
| Content clarity | Is the next action predictable and written in plain language? |
| Touch and pointer | Are controls large enough and usable without precise movement? |
| Third-party embeds | Is ownership clear, and is there a fallback or manual review note? |

## How To Use This With Reports

1. Open the visual report.
2. Start with "Fix First", Top Rules, and the first affected screenshots.
3. For each critical or repeated warning, add a user-task sentence.
4. Copy the ticket draft or write one issue per root cause.
5. Add manual-review notes for findings the CLI marks as `needs review`.
6. Re-run `audit` after fixes and compare the report.

## Ticket Template

```md
### Accessibility impact

When a user tries to <task>, this issue may <block/slow/confuse> <user group>.

### Evidence

- Rule:
- WCAG:
- Page/state:
- Screenshot marker:

### Expected behavior

The same task should work with keyboard, screen reader, zoom, and ordinary mouse
or touch interaction where relevant.

### Fix notes

- Preferred fix:
- Manual retest needed:
```

## Useful Commands

Generate a visual report for review:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open
```

Run a quick CI-style signal:

```bash
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate report-only
```

Create a safer report for private pages:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --no-screenshots
```
