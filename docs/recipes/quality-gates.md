# Quality Gates For Existing Projects

Use this recipe when a project already has accessibility findings and the team
needs a staged rollout instead of failing every pull request on day one.

## Recommended Rollout

| Stage | Goal | Command |
|---|---|---|
| 1. Observe | Collect reports without blocking CI | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate report-only` |
| 2. Baseline | Accept the current known state | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --update-baseline` |
| 3. Protect | Block only new critical regressions | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate new-critical-only` |
| 4. Tighten | Block all critical findings | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate critical` |
| 5. Mature | Block warnings when the team is ready | `npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate warning` |

## First CI Setup

Start with generated report-only CI:

```bash
export APP_URL=http://localhost:5173
npx a11y-shiftleft-cli setup \
  --url $APP_URL \
  --start-command "npm run dev -- --host localhost --port 5173" \
  --gate report-only
```

This lets the team review accessibility reports before deciding what should
block pull requests.

## Create A Baseline

After reviewing the first reports, create a baseline from the current accepted
state:

```bash
export APP_URL=http://localhost:5173
npx a11y-shiftleft-cli check \
  --dynamic \
  --url $APP_URL \
  --out reports \
  --update-baseline
```

Commit the baseline file:

```bash
git add .a11y-baseline.json
git commit -m "Add accessibility baseline"
```

The baseline should represent known existing issues, not a claim that the app is
accessible. Refresh it only when the team intentionally accepts the current
state.

## Block Only New Critical Issues

Once the baseline is committed, switch CI to:

```bash
npx a11y-shiftleft-cli check \
  --dynamic \
  --url $APP_URL \
  --out reports \
  --gate new-critical-only
```

This compares current findings with `.a11y-baseline.json` and fails only when a
new critical issue appears.

## Tighten Later

When the project has fewer legacy findings, move to stricter gates:

```bash
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate critical
npx a11y-shiftleft-cli check --dynamic --url $APP_URL --out reports --gate warning
```

Use `critical` for teams that want to stop high-impact regressions. Use
`warning` only when the team is ready for a stricter standard and has a clear
process for fixing findings quickly.

## Visual Audit For Triage

Use `audit` when a finding needs screenshots, keyboard evidence, or fix
guidance:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --open
```

For private or authenticated pages, keep screenshots local and consider:

```bash
npx a11y-shiftleft-cli audit --url $APP_URL --out reports --no-screenshots
```

## Practical Rules

- Start `report-only` for the first few pull requests.
- Commit `.a11y-baseline.json` only after reviewing the generated report.
- Do not refresh the baseline just to make CI pass.
- Use `new-critical-only` while legacy findings are being cleaned up.
- Move to `critical` or `warning` after the team has a clear owner and fix
  process.
- Keep `reports/` as CI artifacts, not committed files.
