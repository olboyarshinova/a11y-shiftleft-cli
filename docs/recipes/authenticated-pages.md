# Authenticated Pages

Use this recipe when a page is behind login, SSO, or two-factor authentication.
The CLI keeps the flow local: it opens a real browser, you sign in there, and it
saves a Playwright `storageState` file on your machine.

## 1. Save A Local Login Session

```bash
npx a11y-shiftleft-cli auth login --url https://example.com/login
```

Enter your username, password, and two-factor code in the browser window that
opens. Do not type credentials into the terminal. When the logged-in page is
ready, return to the terminal and press Enter.

For SPAs that redirect after login, let the CLI save automatically after the
target page or element appears:

```bash
npx a11y-shiftleft-cli auth login \
  --url https://example.com/login \
  --wait-for-url "**/dashboard" \
  --out .a11y-auth/state.json
```

```bash
npx a11y-shiftleft-cli auth login \
  --url https://example.com/login \
  --wait-for-selector "[data-app-ready]" \
  --out .a11y-auth/state.json
```

## 2. Reuse The Session

Use the saved state with the same browser checks you already run:

```bash
npx a11y-shiftleft-cli audit \
  --url https://example.com/dashboard \
  --auth-state .a11y-auth/state.json \
  --wait-until-path /dashboard \
  --out reports \
  --open
```

```bash
npx a11y-shiftleft-cli explore \
  --url https://example.com/dashboard \
  --auth-state .a11y-auth/state.json \
  --wait-until-path /dashboard \
  --out reports
```

```bash
npx a11y-shiftleft-cli check \
  --dynamic \
  --url https://example.com/dashboard \
  --auth-state .a11y-auth/state.json \
  --out reports
```

```bash
npx a11y-shiftleft-cli keyboard \
  --url https://example.com/dashboard \
  --auth-state .a11y-auth/state.json \
  --out reports
```

## 3. Use Existing Playwright Auth

If your project already creates a Playwright storage-state file, reuse it
directly:

```bash
npx a11y-shiftleft-cli audit \
  --url https://example.com/dashboard \
  --auth-state playwright/.auth/user.json \
  --wait-until-path /dashboard \
  --out reports
```

## 4. Keep Secrets Out Of Git

`auth login` adds the common auth folder to `.gitignore` by default. If your
team uses a custom path, add it manually:

```gitignore
.a11y-auth/
playwright/.auth/
```

Do not commit storage-state files. They may contain session cookies or tokens.

## Privacy Notes

- Reports stay local by default.
- Screenshots mask common sensitive inputs such as passwords, emails, phone
  numbers, payment fields, and elements marked with `data-a11y-sensitive`.
- Use `--no-screenshots` for private customer data, production accounts, or
  pages where screenshots should not be saved.
- Use a test account with the smallest permissions needed for the audit.

## CI Guidance

For CI, prefer a test account and a CI-generated storage-state file. Do not
store real credentials or long-lived session files in the repository. If you
cannot safely create auth state in CI yet, run the authenticated audit locally
and use CI for public or preview pages only.
