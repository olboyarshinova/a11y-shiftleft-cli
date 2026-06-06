# v0.4.0 Release Notes

`a11y-shiftleft-cli` v0.4.0 focuses on framework-aware adoption and lighter
static adapter installation.

## Highlights

- `doctor` command for pre-flight setup checks.
- `init --framework react|vue|angular|auto|unknown` for explicit framework
  setup.
- Lazy-loaded framework static plugins, so React, Vue, and Angular plugins are
  no longer required dependencies of the CLI package.
- `adapter list` and `adapter add <framework>` commands for copy-paste adapter
  install guidance.
- Companion adapter meta-packages:
  - `@a11y-shiftleft/react`
  - `@a11y-shiftleft/vue`
  - `@a11y-shiftleft/angular`
- Copy-paste recipes for Angular, React/Vite, Vue/Vite, Next.js, GitHub
  Actions, and Section 508 workflows.
- GitHub issue templates for bug reports, framework support requests, rule
  mapping requests, and adoption stories.
- Compliance evidence summary in JSON, CSV, and Markdown reports.

## Install

Install the CLI and one framework adapter:

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/react
npx playwright install chromium
npx a11y-shiftleft init --framework react
```

For other frameworks:

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/vue
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/angular
```

The CLI can also print the recommended install command:

```bash
npx a11y-shiftleft adapter add angular
```

## Verification

Before publishing, run:

```bash
npm test
npm pack --dry-run --ignore-scripts
npm pack --workspace @a11y-shiftleft/react --dry-run --ignore-scripts
npm pack --workspace @a11y-shiftleft/vue --dry-run --ignore-scripts
npm pack --workspace @a11y-shiftleft/angular --dry-run --ignore-scripts
```

## Promotion Notes

Suggested announcement angle:

```txt
a11y-shiftleft-cli v0.4.0 adds framework-aware setup and lightweight adapter
packages. Install the CLI plus one adapter for React, Vue, or Angular, then run
static and dynamic accessibility checks from the same CI-friendly workflow.
```
