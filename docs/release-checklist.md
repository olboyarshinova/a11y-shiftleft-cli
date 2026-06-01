# Release Checklist

Use this checklist before publishing a public MVP release.

## Local Verification

```bash
nvm use
npm install
npm test
npm run build:demo
npm_config_cache=.npm-cache npm pack --dry-run
```

Check package metadata:

```bash
npm view a11y-shiftleft-cli version
```

If the package does not exist yet, npm should return a 404-style error.
As of the v0.1.0 release preparation, the registry endpoint returned `404` for
`a11y-shiftleft-cli`, so the package name appears available.

## GitHub Actions

The repository includes two workflows:

```txt
.github/workflows/quality.yml
.github/workflows/a11y.yml
```

`quality.yml` should pass on pull requests and pushes to `main`.

`a11y.yml` scans the intentionally broken demo app with `--fail-on none`, so it
uploads accessibility artifacts without failing the workflow.

## Demo Verification

Terminal 1:

```bash
npm run demo -- --port 3000
```

Terminal 2:

```bash
node bin/cli.js check \
  --dynamic \
  --url http://127.0.0.1:3000 \
  --out reports
```

Expected result:

```txt
The command exits with a non-zero code because the demo intentionally contains
critical accessibility findings.
```

For a non-failing smoke test:

```bash
node bin/cli.js check \
  --static \
  --framework react \
  --include "demo/react/src/**/*.{js,jsx,ts,tsx}" \
  --out reports-static \
  --fail-on none
```

## Privacy Check

```bash
rg -n "absolute local home path"
```

The command should not return any tracked source files.

## Package Boundary

The npm package should include only runtime files:

```txt
bin/
src/
scripts/
docs/
CHANGELOG.md
README.md
LICENSE
package.json
```

The package should not include:

```txt
demo/
reports/
dist/
node_modules/
.npm-cache/
```

## Consumer Install Smoke Test

Pack the CLI and install it into a clean throwaway project:

```bash
npm_config_cache=.npm-cache npm pack --pack-destination /tmp
mkdir -p /tmp/a11y-consumer-pack-smoke
cd /tmp/a11y-consumer-pack-smoke
npm init -y
npm install --save-dev /tmp/a11y-shiftleft-cli-0.1.0.tgz
npx a11y-shiftleft init
```

Create a minimal React file with an intentional issue:

```jsx
export function App() {
  return <img src="chart.svg" />;
}
```

Run a static scan:

```bash
npx a11y-shiftleft check \
  --static \
  --framework react \
  --include "src/**/*.{js,jsx,ts,tsx}" \
  --out reports \
  --fail-on none
```

Expected result:

```txt
1 warning from jsx-a11y/alt-text
report path uses src/App.jsx, not an absolute local path
```

## Versioning

For the first public MVP:

```bash
npm version patch
git push origin main --tags
npm publish --access public
```

Only publish after verifying the package in a separate test project.

Use [docs/release-notes-v0.1.0.md](release-notes-v0.1.0.md) as the initial
GitHub Release body.
