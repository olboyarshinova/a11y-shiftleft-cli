# Vue/Vite Recipe

Use this recipe to add `a11y-shiftleft-cli` to a Vue app powered by Vite.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx a11y-shiftleft adapter add vue
npm install --save-dev @a11y-shiftleft/vue
npx playwright install chromium
npx a11y-shiftleft init --framework vue
```

## Add Scripts

```json
{
  "scripts": {
    "start:a11y": "vite --host localhost --port 5173",
    "test:a11y": "a11y-shiftleft check --url http://localhost:5173 --framework vue --include \"src/**/*.vue\" --out reports",
    "doctor:a11y": "a11y-shiftleft doctor --url http://localhost:5173"
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

If Vite prints a different local URL, use that URL in `test:a11y` and
`doctor:a11y`.

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
