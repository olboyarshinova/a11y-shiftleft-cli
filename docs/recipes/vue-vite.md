# Vue/Vite Recipe

Use this recipe to add `a11y-shiftleft-cli` to a Vue app powered by Vite.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npm install --save-dev eslint-plugin-vue
npx playwright install chromium
npx a11y-shiftleft init --framework vue
```

## Add Scripts

```json
{
  "scripts": {
    "start:a11y": "vite --host localhost --port 3000",
    "test:a11y": "a11y-shiftleft check --url http://localhost:3000 --framework vue --include \"src/**/*.vue\" --out reports",
    "doctor:a11y": "a11y-shiftleft doctor --url http://localhost:3000"
  }
}
```

## Run

Start the app in one terminal:

```bash
npm run start:a11y
```

Run the scan in another terminal:

```bash
npm run doctor:a11y
npm run test:a11y
```

## Example Finding

```json
{
  "severity": "warning",
  "source": "axe",
  "rule": "color-contrast",
  "target": ".product-card .price",
  "message": "Elements must meet minimum color contrast ratio thresholds"
}
```

## Notes

Vue static checks currently use the available ESLint/template support and should
be treated as a complement to rendered dynamic scans.
