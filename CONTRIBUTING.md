# Contributing

Thank you for helping improve `a11y-shiftleft-cli`. This guide assumes you are
new to the project and walks through the full path from downloading the code to
opening a pull request.

## What This Project Does

`a11y-shiftleft-cli` is a Node.js CLI for accessibility checks in web projects.
It can scan a rendered app in a browser, run optional framework-specific static
checks, deduplicate findings, map rules to WCAG metadata, and generate reports
for developers and CI.

Good contributions make the tool easier to adopt, easier to trust, or easier to
use in real projects.

## Fast Path For Your First PR

If you want the shortest useful path:

```bash
git clone https://github.com/olboyarshinova/a11y-shiftleft-cli.git
cd a11y-shiftleft-cli
nvm use
npm install
npx playwright install chromium
npm test
```

Then choose one issue labeled `good first issue`, create a branch, make the
smallest useful change, run the relevant test command, and open a pull request.

Beginner-friendly PRs are welcome when they:

- improve one rule mapping;
- add one remediation hint;
- add one focused fixture;
- clarify one docs section;
- improve one error message.

You do not need to understand the whole project before opening a small PR.

## Before You Start

You need:

- Git
- Node.js 22 recommended
- npm
- Chromium installed through Playwright

The package supports Node.js 18+, but contributors should use Node.js 22 because
the test and release workflows use it.

If you use `nvm`:

```bash
nvm use
```

If Node.js is too old, tests may fail with an error like:

```txt
node: bad option: --test
```

Use Node.js 22 before running tests.

## Download The Code

Clone the repository:

```bash
git clone https://github.com/olboyarshinova/a11y-shiftleft-cli.git
cd a11y-shiftleft-cli
```

Or with SSH:

```bash
git clone git@github.com:olboyarshinova/a11y-shiftleft-cli.git
cd a11y-shiftleft-cli
```

Install dependencies:

```bash
npm install
```

Install the browser used by dynamic accessibility checks:

```bash
npx playwright install chromium
```

## Run The Project Locally

Build the CLI:

```bash
npm run build
```

Run the local CLI directly from the repository:

```bash
node bin/cli.js --help
node bin/cli.js doctor
```

Run the demo app:

```bash
npm run demo -- --port 3000
```

In another terminal, scan the demo:

```bash
node bin/cli.js check --dynamic --url http://localhost:3000 --out reports
```

When you run CLI commands through npm scripts, pass command options after `--`:

```bash
npm run check -- --dynamic --url http://localhost:3000 --out reports
npm run explore -- --url http://localhost:3000 --depth 2 --out reports
```

Do not use `npm run check explore ...`; that still runs the `check` command and
can drop the intended URL/options.

Generated reports should stay out of commits.

## Project Structure

Start here when looking for files:

```txt
src/cli.ts                         CLI entry and command registration
src/commands/                      User-facing commands
src/adapters/                      Static and dynamic scan adapters
src/core/                          Deduplication, severity, WCAG, baseline, ignores
src/reporters/                     JSON, CSV, Markdown, and visual report writers
src/scripts/                       Utility scripts used by package scripts
test/                              Node test runner tests
docs/                              Guides, roadmap, evidence methodology
examples/fixtures/                 Small framework fixtures for tests
examples/demo-react-vite/          Demo app with intentional a11y issues
packages/react|vue|angular/        Optional adapter convenience packages
```

## Choose A Task

Good first contributions:

- Add WCAG metadata for one known rule.
- Add one remediation hint and a focused unit test.
- Add or improve a small fixture for React, Vue, or Angular.
- Improve one README or recipe section with a copy-paste command.
- Clarify one report field or troubleshooting message.

Use issues labeled `good first issue` when you want a small, well-scoped task.
Those issues should include likely files and acceptance criteria.

Avoid starting with broad architecture changes, release automation, browser
overlay work, security-sensitive behavior, or compliance/legal interpretation.

If there is no issue for the improvement you want to make, open a feature
request first unless the change is tiny documentation cleanup.

## Make A Branch

Create a short branch name:

```bash
git checkout -b your-name/short-description
```

Examples:

```bash
git checkout -b alex/add-label-title-only-mapping
git checkout -b alex/docs-angular-quickstart
```

## Development Rules

Keep changes focused:

- Follow existing TypeScript patterns.
- Prefer existing adapters and helpers over new abstractions.
- Do not add custom AST parsers for the MVP.
- Do not add ML or AI behavior to the core CLI.
- Do not add SaaS authorization to the core CLI.
- Do not claim WCAG, ADA, or Section 508 certification.
- Do not commit generated report folders.
- Do not commit local absolute paths, usernames, tokens, logs, or private data.

Generated folders usually include:

```txt
reports/
.a11y-reports/
playwright-report/
dist/
dist-test/
```

## Testing

Use the smallest test set that matches your change. When in doubt, run
`npm test`.

| Change type | Run |
|---|---|
| Docs only | No test required, but mention docs-only in the PR |
| WCAG mapping or remediation hint | `npm test` |
| CLI command behavior | `npm test` |
| Report output | `npm test` |
| Framework adapter or fixture | `npm test` and `npm run test:fixtures` |
| Demo app or visual report behavior | `npm run build:demo` plus a local scan |
| Package contents, npm scripts, or release files | `npm pack --dry-run` |

Run the full test suite:

```bash
npm test
```

Run fixture verification:

```bash
npm run test:fixtures
```

Check that the demo can build:

```bash
npm run build:demo
```

Check what would be published to npm:

```bash
npm pack --dry-run
```

For docs-only changes, `npm test` is usually not required, but say that the
change is docs-only in the pull request.

For behavior changes, add or update a focused test near the changed code.

Examples:

```txt
test/core/wcagMap.test.ts
test/core/remediation.test.ts
test/commands/check.test.ts
test/reporters/writeReports.test.ts
```

If your local Node.js version prints `node: bad option: --test`, switch to
Node.js 22 and run the command again.

## Common Workflows

Run static checks only:

```bash
node bin/cli.js check --static --out reports
```

Run dynamic checks against a local app:

```bash
node bin/cli.js check --dynamic --url http://localhost:3000 --out reports
```

Run visual exploration:

```bash
node bin/cli.js explore --url http://localhost:3000 --depth 2 --out reports
```

Run watch mode while developing:

```bash
node bin/cli.js watch --url http://localhost:3000 --out reports/watch
```

## Update Documentation

Update docs when user-facing behavior changes.

Common places:

```txt
README.md
CHANGELOG.md
docs/configuration.md
docs/visual-reports.md
docs/watch-mode.md
docs/recipes/
```

Add a short `CHANGELOG.md` entry under `Unreleased` for notable user-facing
changes.

If the change affects beginners, also check whether `README.md` needs a simpler
example or whether a recipe in `docs/recipes/` would be clearer.

## Pull Request Checklist

Before opening a PR:

- [ ] The change is focused and linked to an issue when possible.
- [ ] Tests were added or updated for behavior changes.
- [ ] Documentation was updated for user-facing changes.
- [ ] Generated reports and local files were not committed.
- [ ] `npm test` passes, or the PR explains why it was not needed.
- [ ] `npm run test:fixtures` passes when fixtures or adapters changed.
- [ ] `npm pack --dry-run` was checked for packaging-sensitive changes.

## Open A Pull Request

Push your branch:

```bash
git push --set-upstream origin your-name/short-description
```

Open a pull request on GitHub.

In the PR description:

- Explain what changed.
- Explain why it helps.
- List commands you ran.
- Include screenshots or report excerpts for visual/report changes.
- Mention any follow-up work.

Use the pull request template. It exists so maintainers do not need to ask for
basic testing and scope details later.

## Review Expectations

Maintainers review for:

- correctness and focused scope;
- clear tests for behavior changes;
- no private data or generated reports in the diff;
- no wording that promises legal compliance or complete WCAG coverage;
- docs that match the current CLI behavior.

Small PRs are easier to review than broad PRs. If your idea is large, start with
an issue and split the work into follow-up tasks.

## Issue Templates

Use the closest issue template:

- Bug report: reproducible CLI problems.
- Good first issue: small tasks for new contributors.
- Framework support request: new framework or setup support.
- Accessibility rule mapping request: WCAG metadata or remediation gaps.
- Adoption story: real-world usage, metrics, and workflow examples.
- Feature request: new workflow or integration ideas.

When reporting a bug, include the exact command and `doctor` output:

```bash
npx a11y-shiftleft doctor --url http://localhost:3000
```

## Accessibility And Compliance Language

Automated accessibility checks are not a full WCAG conformance audit. Please
avoid wording that implies legal certification or complete accessibility
coverage.

Use phrases like:

- "supports accessibility risk detection"
- "helps collect automated evidence"
- "requires manual review for full accessibility evaluation"

Avoid phrases like:

- "certifies ADA compliance"
- "guarantees WCAG compliance"
- "finds all accessibility issues"

## Privacy And Security

Do not paste private app data, tokens, cookies, customer records, screenshots
with personal data, or production-only URLs into issues or pull requests.

When sharing reports, prefer redacted excerpts.

For screenshots generated by `explore`, use:

```bash
npx a11y-shiftleft explore --url http://localhost:3000 --no-screenshots --out reports
```

## Maintainer Notes

The repository includes a helper script for seeding beginner-friendly issues.
Preview the issue list first:

```bash
node scripts/create-good-first-issues.js --dry-run
```

To create issues, use a GitHub token with issue-write permission:

```bash
GH_TOKEN=your_token node scripts/create-good-first-issues.js
```

To close the older seeded issues before creating the refreshed list:

```bash
GH_TOKEN=your_token node scripts/create-good-first-issues.js --close-stale
```

The script skips existing issue titles and uses only common public labels:
`good first issue`, `help wanted`, `enhancement`, and `documentation`.

## Getting Help

If you are stuck:

1. Run `npx a11y-shiftleft doctor --url <your-url>`.
2. Check the README and docs recipes.
3. Search existing issues.
4. Open a bug report or framework support request with the template.
