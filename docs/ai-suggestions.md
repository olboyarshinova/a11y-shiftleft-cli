# Optional AI Suggestions

AI-assisted remediation should live outside the core CLI as an optional
companion package:

```bash
npm install --save-dev @a11y-shiftleft/ai
```

The core CLI should remain deterministic and privacy-first. It should keep
producing reproducible accessibility findings, WCAG metadata, static
remediation hints, metrics, and reports without requiring an AI provider.

## Proposed Commands

Start with read-only suggestions:

```bash
npx a11y-shiftleft suggest --report reports/a11y-report.json --issue 3
```

Enable AI suggestions only when the user explicitly opts in:

```bash
A11Y_SHIFTLEFT_AI_PROVIDER=openai \
A11Y_SHIFTLEFT_AI_CONSENT=true \
npx a11y-shiftleft suggest --report reports/a11y-report.json --issue 3 --ai
```

Interactive review can reuse the same suggestion engine:

```bash
npx a11y-shiftleft check --interactive
```

## Package Boundary

`a11y-shiftleft-cli` should own:

- deterministic scans
- deduplication
- severity triage
- WCAG mapping
- static remediation hints
- report generation
- interactive issue browsing

`@a11y-shiftleft/ai` should own:

- provider configuration
- prompt construction
- local or remote model adapters
- privacy consent checks
- contextual remediation suggestions
- copy-paste snippets

The AI package should not be installed by default and should not be required for
CI.

## Privacy Rules

- Never send source code, DOM snippets, screenshots, report contents, or file
  paths to a remote model without explicit consent.
- Keep AI suggestions off by default.
- Support a dry-run mode that prints the exact context that would be sent.
- Prefer small issue-scoped context over full-file or full-page context.
- Redact secrets, tokens, emails, payment fields, and user-provided sensitive
  selectors before building prompts.
- Store no provider credentials in report files.

## Safety Rules

- Do not apply AI changes automatically in the first version.
- Present suggestions as reviewable copy-paste snippets.
- Label suggestions as assistive, not authoritative.
- Keep WCAG documentation links and deterministic remediation hints visible
  next to AI output.
- Never claim that AI suggestions guarantee accessibility compliance.

## Suggested Output

```txt
Issue 3 of 12
Rule: button-name
Target: button.icon-close
WCAG: 4.1.2 Name, Role, Value

Static guidance:
- Use visible button text when possible.
- For icon-only buttons, add aria-label or aria-labelledby.

AI suggestion:
Add an accessible name that describes the action in this UI state.

Copy-paste example:
<button type="button" aria-label="Close dialog">...</button>
```

## Validation Metrics

The AI package should be evaluated as an intervention, not just a feature:

- time-to-fix with static hints vs contextual suggestions
- developer confidence score
- false-positive handling time
- suggestion acceptance rate
- regression rate after suggested fixes
- number of issues reopened after review

These metrics should be collected without sending private project data to a
remote service by default.
