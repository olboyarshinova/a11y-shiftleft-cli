# Scan Multiple URLs In One Run

Use one `check` command with 2-3 explicit URLs when you already know the pages
that matter most, such as the home page, settings page, and checkout flow.

```bash
export APP_URL=http://localhost:5173

npx a11y-shiftleft check \
  --dynamic \
  --url "$APP_URL" "$APP_URL/settings" "$APP_URL/checkout" \
  --out reports
```

This keeps the scan focused and makes it easy to compare the same key routes on
every run.

Multi-page runs compare document titles in addition to running axe on each
page. A warning is reported when distinct URLs reuse the same title or retain a
common framework starter title. Missing titles continue to be reported by axe.

Use `--crawl` instead when you want the CLI to discover same-origin pages for
you instead of maintaining the route list by hand.
