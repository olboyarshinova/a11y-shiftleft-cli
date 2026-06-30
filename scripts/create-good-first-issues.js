#!/usr/bin/env node

import https from "node:https";

const DEFAULT_REPO = "olboyarshinova/a11y-shiftleft-cli";

const staleIssues = [
  {
    number: 11,
    comment: "Closing this because the demo docs and visual report workflow have changed since this issue was opened. I am replacing it with smaller, more current good-first-issue tasks."
  },
  {
    number: 12,
    comment: "Closing this because the visual report empty states have changed since this issue was opened. I am replacing it with narrower, current good-first-issue tasks."
  }
];

const issues = [
  {
    title: "[Good first issue]: Add FAQ entry explaining third-party iframe findings",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Add a short FAQ entry that explains why a report may show findings inside third-party iframes such as YouTube, Vimeo, Spotify, Google Maps, or CodePen.",
      why: "Users need to understand which findings are directly fixable by their site and which ones require third-party review or an accessible alternative.",
      files: [
        "docs/faq.md"
      ],
      acceptance: [
        "The FAQ includes a question about third-party iframe findings.",
        "The answer mentions that embedded content can be outside the website owner's direct control.",
        "The answer suggests manual verification and checking for an accessible alternative when needed.",
        "The answer does not claim that third-party findings can always be fixed in the host site.",
        "This is a docs-only change; tests are not required."
      ],
      notes: "Keep the wording friendly and practical. Do not add legal or compliance claims."
    })
  },
  {
    title: "[Good first issue]: Add a check vs explore vs audit docs recipe",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Add a short recipe that explains when to use `check`, `explore`, and `audit`.",
      why: "New users can confuse `npm run check explore ...` with the real `explore` command. A small recipe prevents failed first runs.",
      files: [
        "docs/recipes/check-explore-audit.md",
        "docs/recipes/index.md"
      ],
      acceptance: [
        "`docs/recipes/check-explore-audit.md` exists.",
        "The recipe has one short section each for `check`, `explore`, and `audit`.",
        "The recipe includes copy-paste commands using `npx a11y-shiftleft-cli`.",
        "The recipe explains that npm script arguments must come after `--`.",
        "The recipe is linked from `docs/recipes/index.md`."
      ],
      notes: "This is a docs-only change; tests are not required."
    })
  },
  {
    title: "[Good first issue]: Add a public website audit example to README",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Add one small README example showing how to run `explore` against a public website URL.",
      why: "Some users test public websites instead of local projects. A clear example helps them use the right command and understand scan limitations.",
      files: [
        "README.md"
      ],
      acceptance: [
        "README includes a copy-paste `npx a11y-shiftleft-cli explore --url https://example.com --out reports` style command.",
        "The text says to test only sites the user is authorized to scan.",
        "The text mentions that public sites may block automated scans.",
        "The section stays short and beginner-friendly.",
        "This is a docs-only change; tests are not required."
      ],
      notes: "Do not add a long troubleshooting section; link or point to the existing report explanation if useful."
    })
  },
  {
    title: "[Good first issue]: Improve Audit Coverage empty-state wording",
    labels: ["good first issue", "help wanted", "enhancement"],
    body: issueBody({
      task: "Improve one or two empty-state messages in the visual report Audit Coverage table.",
      why: "Clear wording helps users understand the difference between `not-tested`, `needs-review`, and `unavailable` evidence states.",
      files: [
        "src/reporters/writeExplorationHtml.ts",
        "test/reporters/writeExplorationHtml.test.ts"
      ],
      acceptance: [
        "At least one Audit Coverage empty-state message is clearer for beginners.",
        "The wording remains factual and does not claim full accessibility conformance.",
        "A focused visual report test is updated if the changed text is asserted.",
        "`npm test` passes."
      ],
      notes: "Keep this small. Do not redesign the table in this issue."
    })
  },
  {
    title: "[Good first issue]: Add demo README expected output section",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Add a short `What you should see` section to the React/Vite demo README.",
      why: "The demo is often the first thing contributors try. Expected output helps them know whether the scan worked.",
      files: [
        "examples/demo-react-vite/README.md"
      ],
      acceptance: [
        "The demo README has a section named `What you should see` or similar.",
        "It mentions `reports/a11y-comment.md` and `reports/exploration.html`.",
        "It explains that the demo intentionally contains accessibility defects.",
        "It tells users not to commit generated report folders.",
        "This is a docs-only change; tests are not required."
      ],
      notes: "Do not add real screenshots in this issue. Text-only documentation is enough."
    })
  },
  {
    title: "[Good first issue]: Add a short docs note for Copy issue",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Add a short note explaining the `Copy issue` button in the visual HTML report.",
      why: "Users may not realize the button copies a local Markdown draft and does not send data to GitHub, Jira, or Linear automatically.",
      files: [
        "README.md",
        "docs/visual-reports.md"
      ],
      acceptance: [
        "Docs explain that `Copy issue` copies Markdown locally in the browser.",
        "Docs mention that it is useful for GitHub Issues, Jira, Linear, or team notes.",
        "Docs clarify that no external tracker issue is created automatically.",
        "This is a docs-only change; tests are not required."
      ],
      notes: "Keep this concise; do not duplicate the whole report documentation."
    })
  }
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const closeStale = args.has("--close-stale");
const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!dryRun && !token) {
  console.error("Missing GH_TOKEN or GITHUB_TOKEN. Run with --dry-run to preview issues.");
  process.exit(1);
}

const existingTitles = dryRun ? new Set() : await fetchExistingIssueTitles(repo, token);

if (closeStale) {
  for (const issue of staleIssues) {
    if (dryRun) {
      console.log(`dry-run close #${issue.number}: ${issue.comment}`);
      continue;
    }

    await closeIssue(repo, token, issue);
    console.log(`closed #${issue.number}`);
  }
}

for (const issue of issues) {
  if (existingTitles.has(issue.title)) {
    console.log(`skip existing: ${issue.title}`);
    continue;
  }

  if (dryRun) {
    console.log(`dry-run: ${issue.title}`);
    console.log(`labels: ${issue.labels.join(", ")}`);
    console.log("");
    continue;
  }

  const created = await createIssue(repo, token, issue);
  console.log(`created #${created.number}: ${created.html_url}`);
}

function issueBody({ task, why, files, acceptance, notes }) {
  return [
    "## Task",
    "",
    task,
    "",
    "## Why this helps",
    "",
    why,
    "",
    "## Likely files",
    "",
    ...files.map((file) => `- \`${file}\``),
    "",
    "## Acceptance criteria",
    "",
    ...acceptance.map((item) => `- [ ] ${item}`),
    "",
    "## Notes for contributors",
    "",
    notes
  ].join("\n");
}

async function fetchExistingIssueTitles(repo, token) {
  const issues = await requestJson(
    `https://api.github.com/repos/${repo}/issues?state=all&per_page=100`,
    { token }
  );

  return new Set(issues.map((issue) => issue.title));
}

async function createIssue(repo, token, issue) {
  return requestJson(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    token,
    body: issue
  });
}

async function closeIssue(repo, token, issue) {
  await requestJson(`https://api.github.com/repos/${repo}/issues/${issue.number}/comments`, {
    method: "POST",
    token,
    body: { body: issue.comment }
  });

  return requestJson(`https://api.github.com/repos/${repo}/issues/${issue.number}`, {
    method: "PATCH",
    token,
    body: {
      state: "closed",
      state_reason: "not_planned"
    }
  });
}

function requestJson(url, { method = "GET", token, body } = {}) {
  const payload = body ? JSON.stringify(body) : undefined;
  const requestUrl = new URL(url);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        method,
        hostname: requestUrl.hostname,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        headers: githubHeaders(token, payload)
      },
      (response) => {
        let responseBody = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub API request failed: ${response.statusCode}\n${responseBody}`));
            return;
          }

          try {
            resolve(JSON.parse(responseBody));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

function githubHeaders(token, payload) {
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "a11y-shiftleft-cli-issue-seed",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (payload) {
    headers["Content-Length"] = Buffer.byteLength(payload);
  }

  return headers;
}
