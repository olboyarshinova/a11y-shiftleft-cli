# Accessibility PR Checklist For Frontend Teams

Use this checklist before merging UI changes. It does not replace a full
accessibility review, but it helps teams catch common issues earlier.

## Quick Automated Pass

Run a visual audit against the local or preview app:

```bash
npx a11y-shiftleft-cli audit --url http://localhost:5173 --out reports --open
```

Review:

- [ ] Top findings in the visual report
- [ ] Annotated screenshots
- [ ] WCAG A/AA labels
- [ ] User-impact labels
- [ ] How-to-fix guidance
- [ ] Keyboard evidence
- [ ] Manual-review tasks

## Manual Review

### Keyboard

- [ ] Can the main task be completed without a mouse?
- [ ] Is focus visible on every interactive control?
- [ ] Does focus order follow the visual and logical order?
- [ ] Do dialogs trap focus while open and restore focus when closed?
- [ ] Can menus, tabs, accordions, and custom widgets be operated by keyboard?

### Forms

- [ ] Every input has a visible or programmatic label.
- [ ] Required fields are communicated clearly.
- [ ] Error messages are associated with the relevant fields.
- [ ] Focus moves to useful context after validation errors.
- [ ] The form can be corrected without losing entered data.

### Content And Structure

- [ ] The page has a useful title.
- [ ] The page has one meaningful `h1`.
- [ ] Headings describe sections accurately.
- [ ] Links make sense out of context.
- [ ] Repeated navigation and controls use consistent labels.

### Images And Media

- [ ] Informative images have meaningful alternatives.
- [ ] Decorative images are ignored by assistive technology.
- [ ] Logos have appropriate accessible names.
- [ ] Videos with speech have captions.
- [ ] Audio or video content has a transcript when needed.

### Visual And Responsive Behavior

- [ ] Text and controls have sufficient contrast.
- [ ] The UI works at 400% zoom / 320 CSS pixels without two-dimensional scrolling.
- [ ] Text is not clipped or hidden.
- [ ] Focus indicators remain visible in high-contrast or forced-colors modes.
- [ ] Motion can be paused or reduced when it affects understanding.

### Screen Reader Smoke Test

- [ ] The main page purpose is announced clearly.
- [ ] Landmarks and headings provide useful navigation.
- [ ] Buttons and links have useful names.
- [ ] Form errors are announced or discoverable.
- [ ] Dynamic updates are announced when users need them.

## PR Comment Template

```md
## Accessibility Review

Automated report:
- [ ] Visual audit reviewed
- [ ] Critical findings fixed or documented
- [ ] Keyboard evidence reviewed
- [ ] Manual-review tasks checked

Notes:
- Main affected page/state:
- Highest-risk finding:
- Follow-up needed:
```

## Reminder

Automated checks are evidence for triage and remediation. They do not certify
full WCAG, ADA, or Section 508 conformance.
