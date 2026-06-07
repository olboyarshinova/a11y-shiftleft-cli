# v0.4.0 Release Verification

Date: 2026-06-07

## Published Versions

```txt
a11y-shiftleft-cli: 0.4.0
@a11y-shiftleft/react: 0.1.1
@a11y-shiftleft/vue: 0.1.1
@a11y-shiftleft/angular: 0.1.1
```

## Clean Consumer Install

A clean temporary npm project installed the published CLI and React adapter:

```bash
npm install --save-dev a11y-shiftleft-cli@0.4.0 @a11y-shiftleft/react@0.1.1
```

Result:

```txt
added 219 packages
found 0 vulnerabilities
```

## Smoke Commands

The installed CLI reported the expected version:

```bash
npx a11y-shiftleft --version
```

```txt
0.4.0
```

The adapter guidance command returned the React adapter package:

```bash
npx a11y-shiftleft adapter add react
```

```txt
Install:
npm install --save-dev @a11y-shiftleft/react

Initialize config:
npx a11y-shiftleft init --framework react
```

The React adapter package was importable:

```txt
{"framework":"react","packages":["eslint-plugin-jsx-a11y"]}
```

The doctor command detected the installed React static adapter dependency:

```txt
PASS eslint-plugin-jsx-a11y: eslint-plugin-jsx-a11y is resolvable from the target project.
Summary: 5 pass, 3 warn, 0 fail
```

Warnings were expected because the temporary project did not include a config
file, CI environment, or running target URL.

## Promotion Notes

This verification supports the public message:

```txt
Install a11y-shiftleft-cli plus one adapter package for your framework.
```

For React:

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/react
```
