import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";

interface CiOptions {
  cwd: string;
  url: string[];
  startCommand: string;
  failOn: string;
  standard: string;
  force?: boolean;
}

export function registerCiCommand(program: Command): void {
  program
    .command("ci")
    .description("Generate GitHub Actions workflow for accessibility checks.")
    .option("--cwd <dir>", "Target project directory", process.cwd())
    .option("--url <urls...>", "URL(s) to scan in CI", ["http://localhost:3000"])
    .option("--start-command <command>", "Command that starts the app in CI", "npm run dev -- --host localhost --port 3000")
    .option("--fail-on <severity>", "critical, warning, info, or none", "critical")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, or section508", "wcag22-aa")
    .option("--force", "Overwrite existing workflow")
    .action(async (options: CiOptions) => {
      const cwd = path.resolve(options.cwd);
      const target = path.join(cwd, ".github/workflows/a11y.yml");

      if (!options.force && await exists(target)) {
        console.log(`${target} already exists. Use --force to overwrite.`);
        return;
      }

      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, workflowTemplate({
        urls: parseUrls(options.url),
        startCommand: options.startCommand,
        failOn: options.failOn,
        standard: options.standard
      }));
      console.log(`Created ${target}`);
    });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

interface WorkflowTemplateOptions {
  urls: string[];
  startCommand: string;
  failOn: string;
  standard: string;
}

export function workflowTemplate({ urls, startCommand, failOn, standard }: WorkflowTemplateOptions): string {
  const scanUrls = urls.length > 0 ? urls : ["http://localhost:3000"];
  const firstUrl = scanUrls[0];
  const urlArgs = scanUrls.join(" ");

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
            curl -fsS ${firstUrl} && exit 0
            sleep 2
          done
          exit 1

      - name: Run accessibility checks
        run: npx a11y-shiftleft check --dynamic --url ${urlArgs} --out reports --fail-on ${failOn} --standard ${standard}

      - name: Upload accessibility report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: a11y-report
          path: reports/

      - name: Comment on PR
        if: always()
        run: node node_modules/a11y-shiftleft-cli/scripts/post-a11y-comment.js
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: \${{ github.repository }}
          PR_NUMBER: \${{ github.event.pull_request.number }}
`;
}

function parseUrls(urls?: string[]): string[] {
  if (!urls || urls.length === 0) return [];

  return [...new Set(urls
    .flatMap((url) => url.split(","))
    .map((url) => url.trim())
    .filter(Boolean))];
}
