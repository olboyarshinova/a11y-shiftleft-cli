# Angular Recipe

Use this recipe to add `a11y-shiftleft-cli` to an Angular project.

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
    "start:a11y": "ng serve --host localhost --port 4200",
    "test:a11y": "a11y-shiftleft check --url http://localhost:4200 --out reports",
    "doctor:a11y": "a11y-shiftleft doctor --url http://localhost:4200"
  }
}
```

## Run

Start Angular in one terminal:

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
  "severity": "info",
  "source": "eslint",
  "rule": "@angular-eslint/template/button-has-type",
  "target": "src/app/list/list.component.html",
  "message": "Type for <button> is missing"
}
```

## Notes

Angular static checks rely on the project's ESLint/template setup where
available. Dynamic axe checks scan the rendered app URL.
