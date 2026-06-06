# React/Vite Recipe

Use this recipe to add `a11y-shiftleft-cli` to a React app powered by Vite.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init --framework react
```

## Add Scripts

```json
{
  "scripts": {
    "start:a11y": "vite --host localhost --port 3000",
    "test:a11y": "a11y-shiftleft check --url http://localhost:3000 --framework react --out reports",
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
  "rule": "image-alt",
  "target": "img.hero",
  "message": "Images must have alternate text"
}
```

## Notes

If the project already uses `eslint-plugin-jsx-a11y`, the CLI can combine those
static findings with dynamic axe findings in the same report.
