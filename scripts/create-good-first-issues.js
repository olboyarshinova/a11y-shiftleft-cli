#!/usr/bin/env node

import https from "node:https";

const DEFAULT_REPO = "olboyarshinova/a11y-shiftleft-cli";

const issues = [
  {
    title: "[Good first issue]: Add a FAQ page for new users",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Create a short `docs/faq.md` page with beginner questions about installing, running, and reading reports.",
      why: "New users should be able to answer the most common setup questions without reading every docs page.",
      files: [
        "docs/faq.md",
        "README.md"
      ],
      acceptance: [
        "`docs/faq.md` exists.",
        "The FAQ answers at least 4 beginner questions.",
        "The FAQ explains that generated reports usually should not be committed.",
        "README links to the FAQ from the More Documentation section.",
        "This is a docs-only change; tests are not required."
      ],
      notes: "Good starter questions: Do I need React/Vue/Angular? Which URL should I scan? Where is the report? Should reports be committed?"
    })
  },
  {
    title: "[Good first issue]: Add common dev server port examples to README",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Add a small table to the README quick start showing common local dev server URLs.",
      why: "Beginners often copy `localhost:3000` even when their dev server uses another port. A small table makes the first scan easier.",
      files: [
        "README.md"
      ],
      acceptance: [
        "README includes examples for at least Vite, Next.js, Angular, and Vue dev server URLs.",
        "The text tells users to use the URL printed by their own dev server.",
        "The section stays short and copy-paste friendly.",
        "This is a docs-only change; tests are not required."
      ],
      notes: "Suggested examples: Vite `http://localhost:5173`, Next.js `http://localhost:3000`, Angular `http://localhost:4200`, Vue/Vite `http://localhost:5173`."
    })
  },
  {
    title: "[Good first issue]: Add a beginner-friendly demo README screenshot placeholder section",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Improve the demo README with a short section explaining what users should see after running the demo scan.",
      why: "The demo is often the first thing contributors try. A short expected-output section makes it easier to know whether the scan worked.",
      files: [
        "examples/demo-react-vite/README.md"
      ],
      acceptance: [
        "The demo README has a section named `What you should see` or similar.",
        "It mentions `reports/a11y-comment.md` and `reports/exploration.html`.",
        "It explains that the demo intentionally contains accessibility defects.",
        "This is a docs-only change; tests are not required."
      ],
      notes: "Do not add real screenshots in this issue. Text-only documentation is enough."
    })
  },
  {
    title: "[Good first issue]: Add a docs recipe for scanning multiple URLs",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Create a short recipe that shows how to scan more than one URL in a single command.",
      why: "Users often ask whether they need to run the CLI separately for every page. A recipe makes the workflow obvious.",
      files: [
        "docs/recipes/multiple-urls.md",
        "docs/recipes/index.md",
        "README.md"
      ],
      acceptance: [
        "`docs/recipes/multiple-urls.md` exists.",
        "The recipe includes a copy-paste command with 2-3 URLs.",
        "The recipe mentions when to use `--crawl` instead.",
        "The recipe is linked from `docs/recipes/index.md`.",
        "README links to the recipe or keeps the existing recipes index link clear."
      ],
      notes: "This is a docs-only change; tests are not required."
    })
  },
  {
    title: "[Good first issue]: Clarify screenshot privacy in the README",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Add one short paragraph to the README explaining when to use `--no-screenshots`.",
      why: "Visual reports are useful, but users should understand screenshot privacy before scanning apps with personal or sensitive data.",
      files: [
        "README.md",
        "docs/visual-reports.md"
      ],
      acceptance: [
        "README mentions `--no-screenshots` near the visual exploration section.",
        "The wording is short and links to `docs/visual-reports.md` for details.",
        "The paragraph mentions personal data, login screens, or payment details.",
        "This is a docs-only change; tests are not required."
      ],
      notes: "Keep the README concise. The detailed explanation should stay in `docs/visual-reports.md`."
    })
  }
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!dryRun && !token) {
  console.error("Missing GH_TOKEN or GITHUB_TOKEN. Run with --dry-run to preview issues.");
  process.exit(1);
}

const existingTitles = dryRun ? new Set() : await fetchExistingIssueTitles(repo, token);

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
