# Frequently Asked Questions

Common questions from new users about installing, running, and reading reports.

---

## Installation

### Do I need React, Vue, or Angular installed to use this CLI?

No. `a11y-shiftleft-cli` works with any web app that runs at a local or preview URL — React, Vue, Angular, Next.js, Svelte, Astro, Rails, Django, static HTML, and others. Framework-specific adapter packages (`@a11y-shiftleft/react`, `/vue`, `/angular`) are optional and only needed for static lint checks on top of the dynamic browser scan.

### Do I need to install Playwright separately?

Yes. After installing the CLI, also install the Chromium browser Playwright uses:

```bash
npm install --save-dev a11y-shiftleft-cli
npx playwright install chromium
```

Run `npx a11y-shiftleft doctor --url <your-url>` if Chromium is missing — it will tell you exactly what to install.

---

## Running Scans

### Which URL should I use when scanning my app?

Use the URL printed by your development server when you run `npm run dev` (or equivalent). Common defaults are:

| Framework / Tool | Default URL |
|---|---|
| Vite (React, Vue, Svelte) | `http://localhost:5173` |
| Create React App | `http://localhost:3000` |
| Angular CLI | `http://localhost:4200` |
| Next.js | `http://localhost:3000` |
| Astro | `http://localhost:4321` |
| Webpack Dev Server | `http://localhost:8080` |

Pass the URL with `--url`:

```bash
npx a11y-shiftleft check --dynamic --url http://localhost:5173 --out reports
```

Not sure? Check your terminal output after starting the dev server — it always prints the port.

### What do I do if the CLI cannot reach my app?

Run the built-in doctor command to diagnose Node, Playwright, Chromium, config, and URL issues:

```bash
npx a11y-shiftleft doctor --url http://localhost:5173
```

It prints a checklist of what passed, what failed, and suggested fixes.

### Can I scan more than one page at a time?

Yes — pass multiple URLs with `--url`, or use `--crawl` to let the CLI discover same-origin pages automatically:

```bash
# Multiple explicit pages
npx a11y-shiftleft check --dynamic \
  --url http://localhost:5173 http://localhost:5173/settings http://localhost:5173/checkout \
  --out reports

# Auto-discover up to 10 same-origin pages
npx a11y-shiftleft check --dynamic --url http://localhost:5173 \
  --crawl --crawl-depth 1 --crawl-limit 10 --out reports
```

---

## Reading Reports

### Where is the report after a scan?

After a scan, the output folder you specified with `--out` contains several files:

```
reports/a11y-comment.md   ← start here
reports/a11y-report.json
reports/a11y-metrics.csv
```

Open `reports/a11y-comment.md` in your editor or any Markdown viewer. It contains a compact table of findings with severity, WCAG metadata, confidence score, and remediation hints.

### Should I commit generated reports to my repository?

Usually no. Report files (`a11y-comment.md`, `a11y-report.json`, `a11y-metrics.csv`, `exploration.html`, `screenshots/`) change on every run and quickly inflate repository size. Add the reports folder to `.gitignore`:

```
# .gitignore
reports/
```

Run `npx a11y-shiftleft init --gitignore` to have the CLI add this for you automatically.

The exceptions are shared config and baseline files:

| File | Commit? |
|---|---|
| `.a11y-shiftleft.json` | ✅ Yes — shared project config |
| `.a11y-baseline.json` | ✅ Yes — accepted known findings (baseline mode) |
| `a11y-ignore.json` | ✅ Yes — reviewed temporary exceptions |
| `reports/` | ❌ No — regenerate on demand |

---

## Still Stuck?

- Run `npx a11y-shiftleft doctor --url <your-url>` to diagnose setup issues.
- Check the [Recipes](recipes/index.md) page for framework-specific guides.
- Open a [GitHub issue](https://github.com/olboyarshinova/a11y-shiftleft-cli/issues) if you find a bug or missing docs.
