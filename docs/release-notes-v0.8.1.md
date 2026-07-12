# v0.8.1 Release Notes

`a11y-shiftleft-cli` v0.8.1 is a polish release for the visual audit workflow.
It focuses on making reports easier to triage, making SPA/authenticated pages
less fragile to scan, and keeping the published npm package smaller.

## Added

- Cross-page impact signals in visual report Top Rules:
  - grouped occurrences
  - affected pages
  - affected states
  - target patterns
  - likely shared-component or cross-page fix scope
- Bounded SPA readiness flags for `audit` and `explore`:
  - `--wait-until-url <pattern>`
  - `--wait-until-path <path>`
- Authenticated-pages recipe for:
  - manual login with `auth login`
  - post-login redirects
  - existing Playwright `storageState` files
  - manual CAPTCHA or human-verification completion for local visual audits
  - authenticated `audit`, `explore`, `check`, and `keyboard`
  - `.gitignore` and screenshot privacy guidance
- Manual human-verification mode for local visual audits:
  - `--pause-on-human-verification`
  - `--human-verification-timeout-ms <ms>`

## Changed

- Audit Coverage table rows are more compact in the visual HTML report.
- CLI URL input is normalized consistently across `audit`, `explore`, and
  `check`, including leading/trailing whitespace and common smart quotes.
- Published npm package contents exclude TypeScript source files while keeping
  compiled runtime files, declaration files, docs, and examples.
- Generated GitHub Actions workflows now use current checkout/setup-node
  actions and Node.js 22.
- Removed an unused legacy README screenshot asset from package contents.

## Why It Matters

This release makes the day-to-day developer workflow smoother:

- Reports now explain whether a finding likely belongs to one shared component
  or many separate pages.
- SPA scans can wait for redirects or app-ready paths without adding long fixed
  sleeps.
- Authenticated pages have a clear local-first recipe that avoids sending
  credentials, screenshots, or reports to an external service.
- Generated CI workflows start from a more current GitHub Actions template.
- The npm package is lighter for new installations.

## Try It

Run a normal visual audit:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open
```

Wait for a post-login or SPA route before capturing evidence:

```bash
npx a11y-shiftleft-cli audit \
  --url $APP_URL \
  --wait-until-path /dashboard \
  --out reports \
  --open
```

Create and reuse local auth state:

```bash
npx a11y-shiftleft-cli auth login --url https://example.com/login
npx a11y-shiftleft-cli audit \
  --url https://example.com/dashboard \
  --auth-state .a11y-auth/state.json \
  --wait-until-path /dashboard \
  --out reports \
  --open
```

## Update

```bash
npm install --save-dev a11y-shiftleft-cli@0.8.1
```
