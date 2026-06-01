# Accessibility Fixtures

These tiny projects are intentionally incomplete applications with known
accessibility defects. They are used to validate that the CLI can scan projects
outside its own source tree.

| Fixture | Purpose | Expected MVP behavior |
|---|---|---|
| `react` | React static fallback validation | Reports `jsx-a11y/alt-text` |
| `vue` | Vue static fallback validation | Reports `vue/html-button-has-type` and `vue/no-v-html` |
| `angular` | Future Angular template validation fixture | Documents expected fixture shape for the dedicated Angular fallback |

Run the automated fixture smoke test from the repository root:

```bash
npm run test:fixtures
```
