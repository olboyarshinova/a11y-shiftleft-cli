# v0.5.2 Release Notes

`a11y-shiftleft-cli` v0.5.2 is a small patch release focused on richer rule
metadata and cleaner GitHub package publishing.

## Highlights

- Added WCAG metadata for additional common axe findings, including document
  title, page language, ARIA validation, autocomplete purpose, input button
  names, select names, heading order, and list structure.
- Added remediation hints and framework examples for common report findings so
  JSON and Markdown reports are more actionable.
- Added a manual GitHub Actions workflow for publishing a GitHub Packages
  mirror as `@olboyarshinova/a11y-shiftleft-cli`.
- Updated repository workflows to `actions/checkout@v6`, `actions/setup-node@v6`,
  and Node.js 22 to avoid Node 20 GitHub Actions deprecation warnings.
- Replaced older public docs wording with clearer "works across web frameworks"
  language.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init --framework auto --gitignore
```

## GitHub Packages Mirror

GitHub Packages requires scoped npm package names. The GitHub Packages mirror is
published as:

```txt
@olboyarshinova/a11y-shiftleft-cli
```

The public npmjs package remains:

```txt
a11y-shiftleft-cli
```

To publish the GitHub Packages mirror from GitHub:

```txt
Actions -> Publish GitHub Package -> Run workflow
```

## Notes

- This release does not change adapter package versions.
- The GitHub Packages workflow temporarily changes package metadata during the
  Actions run and does not commit the scoped package name back to the
  repository.
