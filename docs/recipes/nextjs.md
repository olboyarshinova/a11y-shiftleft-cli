# Next.js Recipe

Use this recipe to add `a11y-shiftleft-cli` to a Next.js project.

## Install

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
npx a11y-shiftleft init
```

## Add Scripts

```json
{
  "scripts": {
    "build:a11y": "next build",
    "start:a11y": "next start -p 3000",
    "test:a11y": "a11y-shiftleft check --url http://localhost:3000 --framework react --out reports",
    "doctor:a11y": "a11y-shiftleft doctor --url http://localhost:3000"
  }
}
```

## Run

Build and start the production app:

```bash
npm run build:a11y
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
  "rule": "page-has-heading-one",
  "target": "html",
  "message": "Page should contain a level-one heading"
}
```

## Notes

Do not wire this through unsupported `next.config.js` lifecycle hooks. Prefer
package scripts or GitHub Actions so the app is built and reachable before the
scan starts.
