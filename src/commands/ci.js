import fs from "node:fs/promises";
import path from "node:path";

export function registerCiCommand(program) {
  program
    .command("ci")
    .description("Generate GitHub Actions workflow for accessibility checks.")
    .option("--cwd <dir>", "Target project directory", process.cwd())
    .option("--url <url>", "URL to scan in CI", "http://127.0.0.1:3000")
    .option("--start-command <command>", "Command that starts the app in CI", "npm run dev -- --host 127.0.0.1 --port 3000")
    .option("--force", "Overwrite existing workflow")
    .action(async (options) => {
      const cwd = path.resolve(options.cwd);
      const target = path.join(cwd, ".github/workflows/a11y.yml");

      if (!options.force && await exists(target)) {
        console.log(`${target} already exists. Use --force to overwrite.`);
        return;
      }

      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, workflowTemplate({
        url: options.url,
        startCommand: options.startCommand
      }));
      console.log(`Created ${target}`);
    });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function workflowTemplate({ url, startCommand }) {
  return `name: Accessibility Shift-Left

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  a11y:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Start application
        run: ${startCommand} &

      - name: Wait for application
        run: |
          for i in {1..30}; do
            curl -fsS ${url} && exit 0
            sleep 2
          done
          exit 1

      - name: Run accessibility checks
        run: npx a11y-shiftleft check --dynamic --url ${url} --out reports

      - name: Upload accessibility report
        uses: actions/upload-artifact@v4
        with:
          name: a11y-report
          path: reports/

      - name: Comment on PR
        if: always()
        run: npm run post-a11y-comment
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: \${{ github.repository }}
          PR_NUMBER: \${{ github.event.pull_request.number }}
`;
}
