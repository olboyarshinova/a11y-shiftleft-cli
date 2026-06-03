# Release Checklist

Use this checklist before publishing a public MVP release.

## Local Verification

```bash
nvm use
npm install
npm test
npm run test:fixtures
npm run build:demo
npm_config_cache=.npm-cache npm pack --dry-run
```

Check package metadata:

```bash
npm view a11y-shiftleft-cli version
```

For v0.1.0 and later, this should return the latest published version.

## GitHub Actions

The repository includes two workflows:

```txt
.github/workflows/quality.yml
.github/workflows/a11y.yml
```

`quality.yml` should pass on pull requests and pushes to `main`.

`a11y.yml` scans the intentionally broken demo app with `--fail-on none`, so it
uploads accessibility artifacts without failing the workflow.

PR comments are posted by `scripts/post-a11y-comment.js`. The script skips
commenting when GitHub PR environment variables are missing, and it can build
the comment from either `a11y-comment.md` or `a11y-report.json`.

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
scripts/post-a11y-comment.js
scripts/verify-fixtures.js
scripts/analyze-metrics.js
examples/fixtures/
data/
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

## Public Repository Files

Before publishing, confirm these files exist:

```txt
README.md
CHANGELOG.md
LICENSE
CONTRIBUTING.md
SECURITY.md
docs/empirical-validation.md
docs/research-paper-outline.md
docs/release-notes-v0.1.0.md
docs/release-checklist.md
docs/ide-integration.md
```

## Consumer Install Smoke Test

Install the published CLI into a clean throwaway project:

```bash
mkdir -p /tmp/a11y-consumer-smoke
cd /tmp/a11y-consumer-smoke
npm init -y
npm install --save-dev a11y-shiftleft-cli
npx a11y-shiftleft --help
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

For a new public release:

```bash
npm version patch
git push origin main --tags
npm publish --access public
```

Only publish after verifying the package locally. After publishing, repeat the
consumer install smoke test from npm.

Use [docs/release-notes-v0.1.0.md](release-notes-v0.1.0.md) as the initial
GitHub Release body.
