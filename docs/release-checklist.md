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

## Versioning

For the first public MVP:

```bash
npm version patch
git push origin main --tags
npm publish --access public
```

Only publish after verifying the package in a separate test project.
