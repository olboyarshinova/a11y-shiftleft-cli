# @a11y-shiftleft/react

React static accessibility adapter dependency bundle for
`a11y-shiftleft-cli`.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/react
npx a11y-shiftleft init --framework react
```

## Use

```bash
npx a11y-shiftleft check --static --framework react --out reports
```

This package installs `eslint-plugin-jsx-a11y`, which the CLI lazy-loads for
React static checks.

Dynamic axe/Playwright checks still come from `a11y-shiftleft-cli`.
