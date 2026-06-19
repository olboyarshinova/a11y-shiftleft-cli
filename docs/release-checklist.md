# Release Checklist

Use this checklist before publishing a public release.

## Local Verification

```bash
nvm use
npm install
npm test
npm run test:fixtures
npm run build:demo
npm_config_cache=.npm-cache npm pack --dry-run
npm_config_cache=.npm-cache npm pack --workspace @a11y-shiftleft/react --dry-run --ignore-scripts
npm_config_cache=.npm-cache npm pack --workspace @a11y-shiftleft/vue --dry-run --ignore-scripts
npm_config_cache=.npm-cache npm pack --workspace @a11y-shiftleft/angular --dry-run --ignore-scripts
```

Check package metadata:

```bash
npm view a11y-shiftleft-cli version
npm view @a11y-shiftleft/react version
npm view @a11y-shiftleft/vue version
npm view @a11y-shiftleft/angular version
```

For the main CLI, this should return the latest published version. For new
adapter packages, `E404 Not Found` means the package name has not been
published yet.

Before publishing scoped adapter packages, confirm the npm account owns the
`@a11y-shiftleft` scope or create the `a11y-shiftleft` npm organization. An
unpublished package name is not enough; npm must also allow publishing under
that scope.

## GitHub Actions

The repository includes these workflows:

```txt
.github/workflows/quality.yml
.github/workflows/a11y.yml
.github/workflows/publish-github-package.yml
```

`quality.yml` should pass on pull requests and pushes to `main`.

`a11y.yml` scans the intentionally broken demo app with `--fail-on none`, so it
uploads accessibility artifacts without failing the workflow.

`publish-github-package.yml` is a manual workflow that publishes the same CLI
code to GitHub Packages as `@olboyarshinova/a11y-shiftleft-cli`. GitHub
Packages npm registry requires scoped package names, so the workflow
temporarily changes the package name during the Actions run and publishes to
`https://npm.pkg.github.com` with `GITHUB_TOKEN`. It does not commit the scoped
package name back to the repository.

PR comments are posted by `scripts/post-a11y-comment.js`. The script skips
commenting when GitHub PR environment variables are missing, and it can build
the comment from either `a11y-comment.md` or `a11y-report.json`.

## Demo Verification

Terminal 1:

```bash
npm run demo -- --port 5173
```

Terminal 2:

```bash
node bin/cli.js check \
  --dynamic \
  --url http://localhost:5173 \
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
  --include "examples/demo-react-vite/src/**/*.{js,jsx,ts,tsx}" \
  --out reports-static \
  --fail-on none
```

## v0.6 Workflow Smoke Tests

Use a running demo app:

```bash
npm run demo -- --port 5173
```

In another terminal, verify PDF export:

```bash
node bin/cli.js explore \
  --url http://localhost:5173 \
  --depth 1 \
  --limit 2 \
  --actions-per-state 2 \
  --pdf \
  --no-screenshots \
  --fail-on none \
  --out reports-smoke
```

Expected files:

```txt
reports-smoke/exploration.html
reports-smoke/exploration.pdf
reports-smoke/a11y-report.json
reports-smoke/a11y-findings.csv
```

Verify ticket drafts:

```bash
node bin/cli.js ticket export \
  --report reports-smoke/a11y-report.json \
  --tracker linear \
  --out reports-smoke/a11y-tickets.md
```

Verify dashboard PDF:

```bash
node bin/cli.js dashboard \
  --reports reports-smoke \
  --pdf \
  --out reports-smoke/dashboard.html
```

Expected files:

```txt
reports-smoke/a11y-tickets.md
reports-smoke/dashboard.html
reports-smoke/dashboard.pdf
```

Verify watch help:

```bash
node bin/cli.js watch --help
```

Verify dynamic UI wait options and annotated screenshots:

```bash
node bin/cli.js explore \
  --url http://localhost:5173 \
  --depth 1 \
  --limit 2 \
  --actions-per-state 2 \
  --wait-ms 500 \
  --fail-on none \
  --out reports-visual-smoke
```

Expected checks:

```txt
reports-visual-smoke/exploration.html exists
exploration.html contains "Open annotated screenshot"
exploration.html contains "Exploration Details"
```

Verify safe-mode and PR-comment behavior:

```bash
node --test \
  dist-test/adapters/explorePlaywrightAdapter.test.js \
  dist-test/scripts/postA11yComment.test.js
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
dist/
src/
scripts/post-a11y-comment.js
scripts/verify-fixtures.js
scripts/analyze-metrics.js
scripts/collect-adoption-metrics.js
scripts/collect-adoption-snapshot.js
scripts/clean-dist.js
examples/fixtures/
examples/demo-react-vite/
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
demo-dist/
reports/
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
docs/roadmap.md
docs/release-notes-v0.1.0.md
docs/release-notes-v0.4.0.md
docs/release-notes-v0.5.0.md
docs/release-notes-v0.6.0.md
docs/release-checklist.md
docs/ide-integration.md
docs/ticket-export.md
packages/react/package.json
packages/vue/package.json
packages/angular/package.json
```

## Publish Order

Log in first:

```bash
npm login
npm whoami
```

Publish the main CLI first:

```bash
npm publish --access public
```

Then publish adapter packages:

```bash
npm publish --workspace @a11y-shiftleft/react --access public
npm publish --workspace @a11y-shiftleft/vue --access public
npm publish --workspace @a11y-shiftleft/angular --access public
```

If npm two-factor authentication is enabled, enter the current authenticator
app code when prompted. Do not store OTP values in shell history, scripts, or
repository files.

Optionally publish the GitHub Packages mirror from the GitHub UI:

```txt
Actions -> Publish GitHub Package -> Run workflow
```

After it succeeds, the package should appear in the repository sidebar under
`Packages` as `@olboyarshinova/a11y-shiftleft-cli`.

After publishing, verify:

```bash
npm view a11y-shiftleft-cli version
npm view @a11y-shiftleft/react version
npm view @a11y-shiftleft/vue version
npm view @a11y-shiftleft/angular version
```

## Consumer Install Smoke Test

Install the published CLI into a clean throwaway project:

```bash
mkdir -p /tmp/a11y-consumer-smoke
cd /tmp/a11y-consumer-smoke
npm init -y
npm install --save-dev a11y-shiftleft-cli
npx a11y-shiftleft adapter add react
npm install --save-dev @a11y-shiftleft/react
npx a11y-shiftleft --help
npx a11y-shiftleft init --framework react
npx a11y-shiftleft ticket --help
npx a11y-shiftleft dashboard --help
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
npm version patch # or: npm version minor
git push origin main --tags
npm publish --access public
```

Only publish after verifying the package locally. After publishing, repeat the
consumer install smoke test from npm.

Use the matching `docs/release-notes-v*.md` file as the GitHub Release body.
