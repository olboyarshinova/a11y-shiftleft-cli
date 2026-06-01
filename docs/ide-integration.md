# IDE Integration

`a11y-shiftleft-cli` does not ship a custom IDE extension in the MVP.

The recommended IDE path is to use existing ESLint integrations:

```txt
VS Code ESLint extension
WebStorm built-in ESLint integration
Neovim/Emacs language server ESLint integrations
```

The CLI complements IDE feedback by running repository-level checks, dynamic
axe scans, deduplication, severity triage, and metrics export in CI.

## React

Install ESLint and the React accessibility plugin in the target project:

```bash
npm install --save-dev eslint eslint-plugin-jsx-a11y
```

Create or update `eslint.config.js`:

```js
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "jsx-a11y": jsxA11y
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: jsxA11y.flatConfigs.recommended.rules
  }
];
```

Then run:

```bash
npx eslint "src/**/*.{js,jsx,ts,tsx}"
npx a11y-shiftleft check --static --framework react --include "src/**/*.{js,jsx,ts,tsx}"
```

In VS Code, install the ESLint extension and enable ESLint validation for
JavaScript and TypeScript files. Accessibility lint findings will appear inline
as ordinary ESLint diagnostics.

## Vue And Angular

Vue and Angular IDE highlighting should use their existing ESLint ecosystems:

```txt
Vue: eslint-plugin-vue
Angular: @angular-eslint
```

Dedicated Vue and Angular static adapters are planned for later releases. The
current portable baseline is dynamic scanning with:

```bash
npx a11y-shiftleft check --dynamic --url http://127.0.0.1:3000
```
