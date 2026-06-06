# GitHub Actions Recipe

Use this recipe to add accessibility checks to pull requests.

## Generate Workflow

```bash
npx a11y-shiftleft ci \
  --url http://localhost:3000 \
  --start-command "npm run dev -- --host localhost --port 3000" \
  --fail-on warning
```

## Commit Workflow

The generator writes:

```txt
.github/workflows/a11y.yml
```

Commit that file with the project changes:

```bash
git add .github/workflows/a11y.yml
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
