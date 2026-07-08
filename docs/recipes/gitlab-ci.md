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
  script:
    - npm ci
    - npm run build --if-present
    - npm run dev -- --host 0.0.0.0 --port 5173 &
    - npx wait-on "$APP_URL"
    - npx a11y-shiftleft-cli check --dynamic --url "$APP_URL" --out reports --gate report-only
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
  script:
    - npm ci
    - npm run build --if-present
    - npm run dev -- --host 0.0.0.0 --port 5173 &
    - npx wait-on "$APP_URL"
    - npx a11y-shiftleft-cli check --dynamic --url "$APP_URL" --out reports --baseline --gate new-critical-only
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

## Notes

- Keep generated `reports/` as artifacts, not committed files.
- Use `audit` instead of `check` when you want the visual HTML report in CI:

```yaml
- npx a11y-shiftleft-cli audit --url "$APP_URL" --out reports --profile risk --no-screenshots
```

- Use `--no-screenshots` for authenticated, private, or production customer
  pages.
