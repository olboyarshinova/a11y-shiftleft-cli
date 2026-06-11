# GitHub Actions Recipe

Use this recipe to add accessibility checks to pull requests without making
every PR wait for a full-site crawl.

## Generate Fast PR Workflow

```bash
npx a11y-shiftleft ci \
  --url http://localhost:3000 \
  --start-command "npm run dev -- --host localhost --port 3000" \
  --fail-on warning
```

The default workflow runs on `pull_request` and uses a bounded crawl
(`--crawl-depth 1`, `--crawl-limit 10`) so feedback usually stays in the
30-90 second range for small and medium frontend apps.

## Generate Split PR And Full-Site Workflows

```bash
npx a11y-shiftleft ci \
  --profile split \
  --url http://localhost:3000 \
  --start-command "npm run dev -- --host localhost --port 3000" \
  --fail-on critical \
  --full-fail-on none \
  --crawl-limit 10 \
  --full-crawl-depth 3 \
  --full-crawl-limit 100
```

This creates two workflows:

```txt
.github/workflows/a11y-pr.yml
.github/workflows/a11y-full.yml
```

Use the PR workflow for fast blocking feedback. Use the full-site workflow for
manual or scheduled coverage through `workflow_dispatch` and the weekly cron
schedule. The full-site workflow uploads artifacts and keeps `--fail-on none`
by default so it does not create noisy scheduled failures while the team is
tracking remediation.

## Commit Workflow Files

The single-profile generator writes:

```txt
.github/workflows/a11y.yml
```

The split-profile generator writes `a11y-pr.yml` and `a11y-full.yml`.
Commit the generated workflow file or files with the project changes:

```bash
git add .github/workflows/
git commit -m "Add accessibility CI"
```

## Example PR Summary

```markdown
| Metric | Value |
|---|---:|
| Total | 2 |
| Critical | 0 |
| Warning | 1 |
| Info | 1 |
| Duplicates removed | 3 |
```

## Notes

Use `--fail-on warning` when a team is ready to block pull requests on warnings.
Use `--fail-on none` during early rollout if the team only wants visibility.
