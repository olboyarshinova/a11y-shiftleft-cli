# GitLab CI Recipe

Use this recipe when your app can start inside a GitLab pipeline and expose a
local URL for browser checks.

## Minimal Report-Only Job

Start with report-only CI so the team can review findings before blocking merge
requests.

```yaml
stages:
  - test

a11y:
  stage: test
  image: mcr.microsoft.com/playwright:v1.49.1-jammy
  variables:
    APP_URL: "http://localhost:5173"
    GIT_DEPTH: "0"
  script:
    - npm ci
    - npm run build --if-present
    - npm run dev -- --host 0.0.0.0 --port 5173 &
    - npx wait-on "$APP_URL"
    - |
      if [ -n "${CI_MERGE_REQUEST_TARGET_BRANCH_NAME:-}" ]; then
        git fetch origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
        npx a11y-shiftleft-cli check --static --dynamic --changed-since "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME" --url "$APP_URL" --out reports --gate report-only --verbose
      else
        npx a11y-shiftleft-cli check --static --dynamic --url "$APP_URL" --out reports --gate report-only --verbose
      fi
  artifacts:
    when: always
    paths:
      - reports/
```

Change `APP_URL`, the port, and the start command to match your project.

## Block Only New Critical Issues

For existing projects with known findings, use a gentler rollout that focuses
on new critical regressions:

```yaml
a11y:
  stage: test
  image: mcr.microsoft.com/playwright:v1.49.1-jammy
  variables:
    APP_URL: "http://localhost:5173"
    GIT_DEPTH: "0"
  script:
    - npm ci
    - npm run build --if-present
    - npm run dev -- --host 0.0.0.0 --port 5173 &
    - npx wait-on "$APP_URL"
    - |
      if [ -n "${CI_MERGE_REQUEST_TARGET_BRANCH_NAME:-}" ]; then
        git fetch origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
        npx a11y-shiftleft-cli check --static --dynamic --changed-since "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME" --url "$APP_URL" --out reports --baseline --gate new-critical-only --verbose
      else
        npx a11y-shiftleft-cli check --static --dynamic --url "$APP_URL" --out reports --baseline --gate new-critical-only --verbose
      fi
  artifacts:
    when: always
    paths:
      - reports/
      - .a11y-baseline.json
```

Create the baseline locally first:

```bash
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --update-baseline --out reports
git add .a11y-baseline.json
git commit -m "Add accessibility baseline"
```

## Authenticated Preview URLs

For pages behind login, use a dedicated test account and store credentials as
masked GitLab CI/CD variables such as `A11Y_USERNAME` and `A11Y_PASSWORD`.

```bash
npx a11y-shiftleft-cli generate-ci \
  --provider gitlab \
  --url https://preview.example.com/dashboard \
  --start-command "npm run dev -- --host 0.0.0.0 --port 5173" \
  --gate report-only \
  --auth-login-url https://preview.example.com/login \
  --auth-username-selector 'input[name="email"]' \
  --auth-password-selector 'input[name="password"]' \
  --auth-submit-selector 'button[type="submit"]' \
  --auth-wait-for-url "**/dashboard"
```

The generated job creates `.a11y-auth/state.json` inside the CI runner before
running `check --auth-state .a11y-auth/state.json`. Do not commit credentials or
generated auth-state files.

## Notes

- Keep generated `reports/` as artifacts, not committed files.
- Use `audit` instead of `check` when you want the visual HTML report in CI:

```yaml
- npx a11y-shiftleft-cli audit --url "$APP_URL" --out reports --profile risk --no-screenshots
```

- Use `--no-screenshots` for authenticated, private, or production customer
  pages.
