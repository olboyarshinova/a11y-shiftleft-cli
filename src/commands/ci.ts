import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";

interface CiOptions {
  cwd?: string;
  provider: string;
  url: string[];
  startCommand: string;
  failOn: string;
  gate?: string;
  fullFailOn: string;
  standard: string;
  profile: string;
  crawlDepth: string;
  crawlLimit: string;
  fullCrawlDepth: string;
  fullCrawlLimit: string;
  fullSchedule: string;
  force?: boolean;
}

type CiProfile = "pr" | "full" | "split";
type CiProvider = "github" | "gitlab" | "circleci";

type WorkflowFile = {
  fileName: string;
  contents: string;
};

export function registerCiCommand(program: Command): void {
  program
    .command("generate-ci")
    .alias("ci")
    .description("Generate CI workflow files for accessibility checks.")
    .option("--cwd <dir>", "Target project directory")
    .option("--provider <provider>", "CI provider: github, gitlab, or circleci", "github")
    .option("--url <urls...>", "URL(s) to scan in CI", ["http://localhost:3000"])
    .option("--start-command <command>", "Command that starts the app in CI", "npm run dev -- --host localhost --port 3000")
    .option("--fail-on <severity>", "critical, warning, info, or none", "critical")
    .option("--gate <profile>", "PR quality gate profile: critical, warning, report-only, or new-critical-only")
    .option("--full-fail-on <severity>", "critical, warning, info, or none for scheduled full-site scans", "none")
    .option("--standard <standard>", "Compliance support preset: wcag22-aa, ada-title-ii, section508, or en301549", "wcag22-aa")
    .option("--profile <profile>", "CI profile: pr, full, or split", "pr")
    .option("--crawl-depth <depth>", "Fast PR crawl depth", "1")
    .option("--crawl-limit <limit>", "Fast PR crawl URL limit", "10")
    .option("--full-crawl-depth <depth>", "Scheduled full-site crawl depth", "3")
    .option("--full-crawl-limit <limit>", "Scheduled full-site crawl URL limit", "100")
    .option("--full-schedule <cron>", "Scheduled full-site workflow cron expression", "0 7 * * 1")
    .option("--force", "Overwrite existing workflow")
    .action(async (options: CiOptions) => {
      const cwd = path.resolve(options.cwd || process.cwd());
      const provider = toCiProvider(options.provider);
      const workflowOptions = {
        profile: toCiProfile(options.profile),
        urls: parseUrls(options.url),
        startCommand: options.startCommand,
        failOn: options.failOn,
        gate: options.gate,
        fullFailOn: options.fullFailOn,
        standard: options.standard,
        crawlDepth: toPositiveInteger(options.crawlDepth, 1),
        crawlLimit: toPositiveInteger(options.crawlLimit, 10),
        fullCrawlDepth: toPositiveInteger(options.fullCrawlDepth, 3),
        fullCrawlLimit: toPositiveInteger(options.fullCrawlLimit, 100),
        fullSchedule: options.fullSchedule
      };
      const workflows = ciWorkflowFiles(provider, workflowOptions);

      for (const workflow of workflows) {
        const target = ciTargetPath(cwd, provider, workflow.fileName);

        if (!options.force && await exists(target)) {
          console.log(`${target} already exists. Use --force to overwrite.`);
          return;
        }
      }

      for (const workflow of workflows) {
        const target = ciTargetPath(cwd, provider, workflow.fileName);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, workflow.contents);
        console.log(`Created ${target}`);
      }
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
  gate?: string;
  standard: string;
  crawlDepth?: number;
  crawlLimit?: number;
}

export function workflowTemplate(options: WorkflowTemplateOptions): string {
  const { urls, startCommand, failOn, standard } = options;
  const scanUrls = urls.length > 0 ? urls : ["http://localhost:3000"];
  const firstUrl = scanUrls[0];
  const urlArgs = scanUrls.join(" ");
  const crawlDepth = toPositiveInteger(options.crawlDepth, 1);
  const crawlLimit = toPositiveInteger(options.crawlLimit, 10);
  const gateArg = checkGateArgument(options.gate, failOn);

  return `name: Accessibility PR

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
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 22
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

      - name: Run fast accessibility checks
        run: npx a11y-shiftleft check --dynamic --url ${urlArgs} --crawl --crawl-depth ${crawlDepth} --crawl-limit ${crawlLimit} --out reports ${gateArg} --standard ${standard}

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
          REPORT_ARTIFACT_NAME: a11y-report
`;
}

interface FullWorkflowTemplateOptions {
  urls: string[];
  startCommand: string;
  fullFailOn: string;
  standard: string;
  crawlDepth: number;
  crawlLimit: number;
  schedule: string;
}

export function fullWorkflowTemplate({
  urls,
  startCommand,
  fullFailOn,
  standard,
  crawlDepth,
  crawlLimit,
  schedule
}: FullWorkflowTemplateOptions): string {
  const scanUrls = urls.length > 0 ? urls : ["http://localhost:3000"];
  const firstUrl = scanUrls[0];
  const urlArgs = scanUrls.join(" ");

  return `name: Accessibility Full Site

on:
  workflow_dispatch:
  schedule:
    - cron: "${schedule}"

permissions:
  contents: read

jobs:
  a11y-full:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 22
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

      - name: Run full-site accessibility crawl
        run: npx a11y-shiftleft check --dynamic --url ${urlArgs} --crawl --crawl-depth ${crawlDepth} --crawl-limit ${crawlLimit} --semi-auto --out reports-full --fail-on ${fullFailOn} --standard ${standard}

      - name: Upload full-site accessibility report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: a11y-full-site-report
          path: reports-full/
`;
}

export function gitLabWorkflowTemplate(options: WorkflowTemplateOptions): string {
  const { urls, startCommand, failOn, standard } = options;
  const scanUrls = urls.length > 0 ? urls : ["http://localhost:3000"];
  const firstUrl = scanUrls[0];
  const urlArgs = scanUrls.join(" ");
  const crawlDepth = toPositiveInteger(options.crawlDepth, 1);
  const crawlLimit = toPositiveInteger(options.crawlLimit, 10);
  const gateArg = checkGateArgument(options.gate, failOn);

  return `stages:
  - test

a11y:
  stage: test
  image: mcr.microsoft.com/playwright:v1.49.1-jammy
  variables:
    APP_URL: "${firstUrl}"
  script:
    - npm ci
    - npm run build --if-present
    - ${startCommand} &
    - |
      for i in {1..30}; do
        curl -fsS "$APP_URL" && exit 0
        sleep 2
      done
      exit 1
    - npx a11y-shiftleft check --dynamic --url ${urlArgs} --crawl --crawl-depth ${crawlDepth} --crawl-limit ${crawlLimit} --out reports ${gateArg} --standard ${standard}
  artifacts:
    when: always
    paths:
      - reports/
`;
}

export function circleCiWorkflowTemplate(options: WorkflowTemplateOptions): string {
  const { urls, startCommand, failOn, standard } = options;
  const scanUrls = urls.length > 0 ? urls : ["http://localhost:3000"];
  const firstUrl = scanUrls[0];
  const urlArgs = scanUrls.join(" ");
  const crawlDepth = toPositiveInteger(options.crawlDepth, 1);
  const crawlLimit = toPositiveInteger(options.crawlLimit, 10);
  const gateArg = checkGateArgument(options.gate, failOn);

  return `version: 2.1

jobs:
  a11y:
    docker:
      - image: mcr.microsoft.com/playwright:v1.49.1-jammy
    environment:
      APP_URL: "${firstUrl}"
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: npm ci
      - run:
          name: Build app if needed
          command: npm run build --if-present
      - run:
          name: Start application
          command: ${startCommand}
          background: true
      - run:
          name: Wait for application
          command: |
            for i in {1..30}; do
              curl -fsS "$APP_URL" && exit 0
              sleep 2
            done
            exit 1
      - run:
          name: Run accessibility checks
          command: npx a11y-shiftleft check --dynamic --url ${urlArgs} --crawl --crawl-depth ${crawlDepth} --crawl-limit ${crawlLimit} --out reports ${gateArg} --standard ${standard}
      - store_artifacts:
          path: reports
          destination: a11y-report

workflows:
  accessibility:
    jobs:
      - a11y
`;
}

interface WorkflowFilesOptions {
  profile: CiProfile;
  urls: string[];
  startCommand: string;
  failOn: string;
  gate?: string;
  fullFailOn: string;
  standard: string;
  crawlDepth: number;
  crawlLimit: number;
  fullCrawlDepth: number;
  fullCrawlLimit: number;
  fullSchedule: string;
}

export function workflowFiles(options: WorkflowFilesOptions): WorkflowFile[] {
  const prWorkflow = {
    fileName: options.profile === "split" ? "a11y-pr.yml" : "a11y.yml",
    contents: workflowTemplate({
      urls: options.urls,
      startCommand: options.startCommand,
      failOn: options.failOn,
      gate: options.gate,
      standard: options.standard,
      crawlDepth: options.crawlDepth,
      crawlLimit: options.crawlLimit
    })
  };
  const fullWorkflow = {
    fileName: options.profile === "split" ? "a11y-full.yml" : "a11y.yml",
    contents: fullWorkflowTemplate({
      urls: options.urls,
      startCommand: options.startCommand,
      fullFailOn: options.fullFailOn,
      standard: options.standard,
      crawlDepth: options.fullCrawlDepth,
      crawlLimit: options.fullCrawlLimit,
      schedule: options.fullSchedule
    })
  };

  if (options.profile === "pr") return [prWorkflow];
  if (options.profile === "full") return [fullWorkflow];
  return [prWorkflow, fullWorkflow];
}

export function gitLabWorkflowFiles(options: WorkflowFilesOptions): WorkflowFile[] {
  if (options.profile !== "pr") {
    throw new Error("GitLab setup currently supports the pr CI profile. Use the GitLab recipe for scheduled full audits.");
  }

  return [{
    fileName: ".gitlab-ci.yml",
    contents: gitLabWorkflowTemplate({
      urls: options.urls,
      startCommand: options.startCommand,
      failOn: options.failOn,
      gate: options.gate,
      standard: options.standard,
      crawlDepth: options.crawlDepth,
      crawlLimit: options.crawlLimit
    })
  }];
}

export function circleCiWorkflowFiles(options: WorkflowFilesOptions): WorkflowFile[] {
  if (options.profile !== "pr") {
    throw new Error("CircleCI setup currently supports the pr CI profile. Use a custom workflow for scheduled full audits.");
  }

  return [{
    fileName: "config.yml",
    contents: circleCiWorkflowTemplate({
      urls: options.urls,
      startCommand: options.startCommand,
      failOn: options.failOn,
      gate: options.gate,
      standard: options.standard,
      crawlDepth: options.crawlDepth,
      crawlLimit: options.crawlLimit
    })
  }];
}

export function ciWorkflowFiles(provider: CiProvider, options: WorkflowFilesOptions): WorkflowFile[] {
  if (provider === "github") return workflowFiles(options);
  if (provider === "gitlab") return gitLabWorkflowFiles(options);
  return circleCiWorkflowFiles(options);
}

export function checkGateArgument(gate: string | undefined, failOn: string): string {
  if (!gate) return `--fail-on ${failOn}`;
  const normalized = gate.trim().toLowerCase();
  if (
    normalized === "critical" ||
    normalized === "warning" ||
    normalized === "report-only" ||
    normalized === "new-critical-only"
  ) {
    return `--gate ${normalized}`;
  }

  throw new Error(`Unsupported CI quality gate: ${gate}`);
}

export function toCiProfile(profile: string): CiProfile {
  const normalized = profile.trim().toLowerCase();

  if (normalized === "quick") return "pr";
  if (normalized === "pr" || normalized === "full" || normalized === "split") {
    return normalized;
  }

  throw new Error(`Unsupported CI profile: ${profile}`);
}

export function toCiProvider(provider: string): CiProvider {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "github" || normalized === "gitlab" || normalized === "circleci") return normalized;
  if (normalized === "circle") return "circleci";
  throw new Error(`Unsupported CI provider: ${provider}`);
}

export function ciTargetPath(cwd: string, provider: CiProvider, fileName: string): string {
  if (provider === "github") return path.join(cwd, ".github/workflows", fileName);
  if (provider === "circleci") return path.join(cwd, ".circleci", fileName);
  return path.join(cwd, fileName);
}

function parseUrls(urls?: string[]): string[] {
  if (!urls || urls.length === 0) return [];

  return [...new Set(urls
    .flatMap((url) => url.split(","))
    .map((url) => url.trim())
    .filter(Boolean))];
}

function toPositiveInteger(value: number | string | undefined, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
