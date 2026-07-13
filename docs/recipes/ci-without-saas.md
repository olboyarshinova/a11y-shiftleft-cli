# CI/CD Without SaaS

Use this recipe when your team wants accessibility evidence in CI without
sending source code, screenshots, DOM evidence, or reports to a hosted
accessibility platform.

## What Stays Local

By default, the CLI runs inside your project, local machine, preview
environment, or CI runner:

| Data | Default behavior |
|---|---|
| Source code | Read locally by installed adapters only |
| Browser scan | Runs in Playwright inside your environment |
| Screenshots | Written to the configured report folder |
| JSON/Markdown/HTML reports | Written as local files or CI artifacts |
| Login state | Stored locally when `auth login` is used |
| Metrics | Exported to local files only |

Nothing is uploaded to an external a11y service unless your CI provider stores
the generated artifacts or you explicitly share/export the report.

## Fast Setup

Start with the generated setup command:

```bash
export APP_URL=http://localhost:5173
npx a11y-shiftleft-cli setup \
  --url $APP_URL \
  --start-command "npm run dev -- --host localhost --port 5173" \
  --gate report-only
```

This creates:

```txt
.a11y-shiftleft.json
.gitignore
.github/workflows/a11y.yml
```

When `package.json` exists, it also adds:

```bash
npm run a11y:audit
npm run a11y:check
```

## Other CI Providers

Generate the same report-only rollout for other runners:

```bash
# GitLab CI
npx a11y-shiftleft-cli setup --ci gitlab --url $APP_URL --start-command "npm run dev"

# CircleCI
npx a11y-shiftleft-cli setup --ci circleci --url $APP_URL --start-command "npm run dev"

# Jenkins, Bitbucket, Azure, or any shell-based runner
npx a11y-shiftleft-cli setup --ci shell --url $APP_URL --start-command "npm run dev"
```

The shell option creates:

```txt
scripts/a11y-ci.sh
```

Call that script from any CI job that can install Node dependencies and start
your app.

## CI Artifacts

Keep generated reports as CI artifacts instead of committed files:

```txt
reports/
.a11y-reports/
```

For private or authenticated pages, consider disabling screenshots in CI:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --no-screenshots
```

When screenshots are enabled, common sensitive fields such as passwords, email,
phone, payment inputs, and elements marked with `data-a11y-sensitive` are
masked before capture.

## Rollout Path

Use a staged adoption path so the team can learn from the reports before CI
starts blocking work:

```bash
# Visibility first
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate report-only

# Then block only new critical regressions
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate new-critical-only

# Later, tighten when ownership and fix flow are clear
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate critical
```

See [Quality Gates For Existing Projects](quality-gates.md) for the full staged
baseline workflow.

## How This Differs From Hosted Platforms

Hosted accessibility platforms can be valuable for governance, dashboards, and
large centralized programs. This CLI focuses on a different workflow:

| Need | CLI approach |
|---|---|
| Early developer feedback | Run from npm scripts, local URLs, and pull requests |
| Evidence review | Save visual HTML reports and CI artifacts |
| Privacy | Keep reports local unless explicitly shared |
| Existing projects | Start report-only, then tighten gates |
| Manual review gaps | Show what automated checks cannot prove |
| Tooling | Build on axe-core, Playwright, Lighthouse when enabled, and ESLint adapters |

Use the CLI when the team wants shift-left evidence without adding a required
hosted account or external dashboard to the development workflow.
