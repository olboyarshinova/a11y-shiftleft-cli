# @a11y-shiftleft/vue

Vue static accessibility adapter dependency bundle for `a11y-shiftleft-cli`.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/vue
npx a11y-shiftleft init --framework vue
```

## Use

```bash
npx a11y-shiftleft check --static --framework vue --include "src/**/*.vue" --out reports
```

This package installs `eslint-plugin-vue`, which the CLI lazy-loads for Vue
static checks.

Dynamic axe/Playwright checks still come from `a11y-shiftleft-cli`.
