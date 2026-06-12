# Visual Reports

Use `explore` when you want the CLI to walk safe parts of a running app and
produce a visual report:

```bash
npx a11y-shiftleft explore --url $APP_URL --depth 2 --out reports
```

`explore` opens the start URL, scans it with axe, then safely follows
same-origin links and low-risk UI expansion controls such as menu buttons,
tabs, disclosure widgets, and modal triggers.

It saves:

```txt
reports/a11y-report.json
reports/a11y-comment.md
reports/exploration.html
reports/exploration-graph.json
reports/screenshots/state-*.jpg
```

`exploration.html` shows summary metrics, checked states, screenshots, top
findings, recorded transitions, skipped actions, and reviewable overlays around
affected elements when Playwright can resolve their bounds.

## Screenshot Privacy

Screenshots are compressed by default as viewport JPEG files at quality `70` to
keep reports small:

```bash
npx a11y-shiftleft explore --url $APP_URL --out reports
```

Sensitive form fields are masked in screenshots by default. The redaction covers
common password, email, phone, token, card, address, and one-time-code inputs, as
well as elements marked with `data-a11y-sensitive`, `data-a11y-redact`, or
`data-private`.

For applications that may expose real personal data, login screens, payment
details, or production customer records, disable screenshots entirely:

```bash
npx a11y-shiftleft explore --url $APP_URL --no-screenshots --out reports
```

If you intentionally need raw local screenshots for debugging, disable masking:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --no-screenshot-redaction \
  --out reports
```

Use PNG or full-page screenshots only when the extra detail is worth the larger
artifact size:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --screenshot-format png \
  --screenshot-full-page \
  --out reports
```

## Safe Mode

Safe mode skips submit/reset buttons, form buttons without an explicit safe
marker, external links, and actions whose labels look destructive or
transactional, such as delete, logout, save, checkout, or payment.

Add `data-a11y-skip` to any element that should never be clicked during
automated exploration. Add `data-a11y-explore` only when a form button or custom
control is safe to exercise in automated scans.

Project-specific rules can live in `.a11y-shiftleft.json`:

```json
{
  "explore": {
    "safeMode": {
      "blockedText": ["logout", "delete", "pay*", "confirm"],
      "blockedRoles": ["menuitem"],
      "blockedUrls": ["*/checkout*", "*/account/billing*"],
      "blockedSelectors": ["[data-danger]", "[data-payment]"],
      "allowedSelectors": ["[data-a11y-explore]"],
      "dismissDialogs": true
    }
  }
}
```

Safe-mode patterns are case-insensitive strings with optional `*` wildcards.
They are not executable JavaScript regexes.

You can also add one-off rules from the command line:

```bash
npx a11y-shiftleft explore \
  --url $APP_URL \
  --safe-block-text logout delete pay \
  --safe-block-url "*/checkout*" \
  --safe-block-selector "[data-danger]" \
  --out reports
```

## Output Modes

Suppress progress logs and console summary while still writing report files:

```bash
npx a11y-shiftleft explore --url $APP_URL --quiet --out reports
```

Ask for JSON when a script needs to parse stdout:

```bash
npx a11y-shiftleft explore --url $APP_URL --json-summary --out reports
```

Print exploration limits, screenshot settings, safe-mode settings, and output
formats before progress logs and the final summary:

```bash
npx a11y-shiftleft explore --url $APP_URL --verbose --out reports
```
