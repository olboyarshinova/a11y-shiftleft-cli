# v0.4.0 Adoption Snapshot

Date: 2026-06-07

This snapshot records public package metadata shortly after the v0.4.0 release.
It should be treated as early adoption telemetry, not as proof of individual
human usage.

## npm Registry

| Package | Latest | Versions | License | Created | Modified |
|---|---:|---:|---|---|---|
| `a11y-shiftleft-cli` | `0.4.0` | 5 | MIT | 2026-06-02 | 2026-06-06 |
| `@a11y-shiftleft/react` | `0.1.1` | 2 | MIT | 2026-06-06 | 2026-06-06 |
| `@a11y-shiftleft/vue` | `0.1.1` | 2 | MIT | 2026-06-06 | 2026-06-06 |
| `@a11y-shiftleft/angular` | `0.1.1` | 2 | MIT | 2026-06-06 | 2026-06-06 |

## npm Downloads

Public npm downloads for `last-week`:

| Package | Downloads |
|---|---:|
| `a11y-shiftleft-cli` | 142 |
| `@a11y-shiftleft/react` | 0 |
| `@a11y-shiftleft/vue` | 0 |
| `@a11y-shiftleft/angular` | 0 |

The adapter packages were published shortly before this snapshot, so zero
adapter downloads are expected at this stage.

## Interpretation Guardrails

- npm download counts can include humans, CI systems, mirrors, security
  scanners, and bots.
- The public npm downloads API does not expose country-level data.
- GitHub traffic metrics require a repository token and are better evidence for
  unique views, clones, and referrers.
- Use this snapshot as release/adoption telemetry, not as proof of accessibility
  compliance or individual human usage.

## Promotion Angle

```txt
v0.4.0 is published: install the CLI plus one framework adapter package for
React, Vue, or Angular.
```

Example:

```bash
npm install --save-dev a11y-shiftleft-cli @a11y-shiftleft/react
npx a11y-shiftleft init --framework react
npx a11y-shiftleft doctor --framework react
```
