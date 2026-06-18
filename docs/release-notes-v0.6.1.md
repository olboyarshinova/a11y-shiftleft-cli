# v0.6.1 Release Notes

`a11y-shiftleft-cli` v0.6.1 improves visual evidence, safer automatic
exploration, and the guidance developers receive after a scan.

## Highlights

- Automatically compares light and dark color schemes when their rendered
  appearances differ, without requiring another command.
- Adds deterministic remediation guidance and documentation links to every
  finding, including conservative guidance for unknown rules.
- Replaces very tall screenshots with focused evidence crops around nearby
  findings while preserving short-page context.
- Keeps issue frames visible and aligned in both compact previews and expanded
  screenshot views.
- Uses `exploration.html` as the single visual report, including findings, root
  causes, transitions, and skipped actions.
- Avoids recognized advertising and sponsored links during automatic
  exploration and closes popup pages opened by site scripts.
- Detects reused and common starter-template page titles across crawled URLs.
- Expands `--semi-auto` with manual checks for zoom, reflow, media, motion,
  landmarks, skip links, text alternatives, and assistive technology.
- Distinguishes mapped WCAG violations, axe best-practice guidance, and
  unmapped review items in JSON, Markdown, and visual reports.

## Install Or Update

```bash
npm install --save-dev a11y-shiftleft-cli@0.6.1
npx playwright install chromium
npx a11y-shiftleft --version
```

Run a regular check against the URL and port used by your application:

```bash
npx a11y-shiftleft check --url http://localhost:YOUR_PORT
```

Run safe visual exploration:

```bash
npx a11y-shiftleft explore \
  --url http://localhost:YOUR_PORT \
  --depth 2 \
  --out reports
```

## Notes

- Existing configuration files remain compatible with this patch release.
- Generated screenshots and reports should normally remain outside git.
- Automated checks and reports support accessibility review; they do not by
  themselves certify conformance with WCAG or any law.
