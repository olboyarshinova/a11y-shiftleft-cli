# @a11y-shiftleft/angular

Angular template accessibility adapter dependency bundle for
`a11y-shiftleft-cli`.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/angular
npx a11y-shiftleft init --framework angular
```

## Use

```bash
npx a11y-shiftleft check --static --framework angular --include "src/**/*.html" --out reports
```

This package installs `@angular-eslint/eslint-plugin-template` and
`@angular-eslint/template-parser`, which the CLI lazy-loads for Angular template
static checks.

Dynamic axe/Playwright checks still come from `a11y-shiftleft-cli`.
