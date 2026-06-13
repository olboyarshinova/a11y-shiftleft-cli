#!/usr/bin/env node

const DEFAULT_REPO = "olboyarshinova/a11y-shiftleft-cli";

const issues = [
  {
    title: "[Good first issue]: Add WCAG mapping for aria-hidden-focus",
    labels: ["good first issue", "help wanted", "enhancement"],
    body: issueBody({
      task: "Add WCAG metadata and a remediation hint for the axe rule `aria-hidden-focus`.",
      why: "This rule is common in real apps with hidden menus, drawers, and modals. Mapping it improves report clarity and gives developers a concrete fix path.",
      files: [
        "src/core/wcagMap.ts",
        "src/core/remediation.ts",
        "test/core/wcagMap.test.ts",
        "test/core/remediation.test.ts"
      ],
      acceptance: [
        "`mapRuleToWcag(\"aria-hidden-focus\")` returns the expected WCAG criterion.",
        "`getRemediationHint(\"aria-hidden-focus\", ...)` returns a useful summary, docs link, and fix steps.",
        "A focused test covers the new mapping and remediation hint.",
        "`npm test` passes."
      ],
      notes: "Keep the wording practical: focusable content should not be placed inside `aria-hidden=\"true\"` containers."
    })
  },
  {
    title: "[Good first issue]: Add WCAG 1.4.4 metadata for meta-viewport",
    labels: ["good first issue", "help wanted", "enhancement"],
    body: issueBody({
      task: "Add WCAG criterion metadata for `1.4.4 Resize Text` and map the axe rule `meta-viewport` to it.",
      why: "Reports can currently explain contrast and language findings well, but viewport zoom restrictions need the same WCAG-level explanation.",
      files: [
        "src/core/wcagMap.ts",
        "src/core/remediation.ts",
        "test/core/wcagMap.test.ts",
        "test/core/remediation.test.ts"
      ],
      acceptance: [
        "`getWcagCriteria([\"1.4.4\"])` returns title, level, principle, introduced version, and W3C URL.",
        "`mapRuleToWcag(\"meta-viewport\")` returns `[\"1.4.4\"]`.",
        "A remediation hint explains that users must be able to zoom text/content.",
        "`npm test` passes."
      ],
      notes: "Use the WCAG Understanding URL for Resize Text: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html"
    })
  },
  {
    title: "[Good first issue]: Add remediation for jsx-a11y/no-autofocus",
    labels: ["good first issue", "help wanted", "enhancement"],
    body: issueBody({
      task: "Add WCAG mapping and remediation guidance for `jsx-a11y/no-autofocus`.",
      why: "Unexpected autofocus can move keyboard and screen reader users away from the expected reading order. A targeted hint makes static React findings easier to fix.",
      files: [
        "src/core/wcagMap.ts",
        "src/core/remediation.ts",
        "test/core/wcagMap.test.ts",
        "test/core/remediation.test.ts"
      ],
      acceptance: [
        "`jsx-a11y/no-autofocus` maps to a focus-order-related WCAG criterion.",
        "The remediation hint explains when to avoid autofocus and how to move focus intentionally after user action.",
        "React example code is included when useful.",
        "`npm test` passes."
      ],
      notes: "Keep this scoped to metadata and hints. Do not change ESLint adapter behavior."
    })
  },
  {
    title: "[Good first issue]: Add remediation for jsx-a11y/anchor-is-valid",
    labels: ["good first issue", "help wanted", "enhancement"],
    body: issueBody({
      task: "Add WCAG mapping and remediation guidance for `jsx-a11y/anchor-is-valid`.",
      why: "Invalid anchors are common in React apps and often need a simple fix: use a real link for navigation or a button for actions.",
      files: [
        "src/core/wcagMap.ts",
        "src/core/remediation.ts",
        "test/core/wcagMap.test.ts",
        "test/core/remediation.test.ts"
      ],
      acceptance: [
        "`jsx-a11y/anchor-is-valid` maps to link purpose/name-role-value related WCAG metadata where appropriate.",
        "The remediation hint explains when to use `<a href>` and when to use `<button type=\"button\">`.",
        "A React example is included.",
        "`npm test` passes."
      ],
      notes: "Do not add automatic code changes. This is a report guidance improvement only."
    })
  },
  {
    title: "[Good first issue]: Add Vue remediation for vue/html-button-has-type",
    labels: ["good first issue", "help wanted", "enhancement"],
    body: issueBody({
      task: "Add a direct remediation hint for `vue/html-button-has-type`.",
      why: "The Vue fallback can report missing button types, but the remediation hint is currently clearer for Angular than Vue. This makes Vue reports easier for beginners.",
      files: [
        "src/core/remediation.ts",
        "test/core/remediation.test.ts"
      ],
      acceptance: [
        "`getRemediationHint(\"vue/html-button-has-type\", [], \"vue\")` returns a Vue-specific example.",
        "The hint explains `type=\"button\"` versus `type=\"submit\"`.",
        "A focused remediation test is added.",
        "`npm test` passes."
      ],
      notes: "This does not need a WCAG mapping because explicit button type is primarily a prevention and developer-experience rule."
    })
  },
  {
    title: "[Good first issue]: Add Angular fixture for label-has-associated-control",
    labels: ["good first issue", "help wanted", "enhancement"],
    body: issueBody({
      task: "Add a small Angular fixture that exercises `@angular-eslint/template/label-has-associated-control`.",
      why: "Angular label coverage exists in the adapter list, but a focused fixture makes the behavior easier to verify and safer to maintain.",
      files: [
        "examples/fixtures/angular/src/app/app.component.html",
        "test/adapters/eslintAdapter.test.ts"
      ],
      acceptance: [
        "The Angular fixture contains one intentionally invalid label/control example.",
        "The ESLint adapter test expects `@angular-eslint/template/label-has-associated-control`.",
        "Existing Angular fallback findings still pass.",
        "`npm test` passes."
      ],
      notes: "Keep the fixture tiny. Avoid turning this into a full Angular app."
    })
  },
  {
    title: "[Good first issue]: Document confidence score examples",
    labels: ["good first issue", "help wanted", "documentation"],
    body: issueBody({
      task: "Add a short confidence-score example section to the evidence methodology docs.",
      why: "New users ask what `confidence: high/medium/low` means. A small example table will make reports easier to interpret.",
      files: [
        "docs/evidence-methodology.md",
        "README.md"
      ],
      acceptance: [
        "Docs include examples for high, medium, and low confidence findings.",
        "Docs explain that confidence is tooling evidence, not legal certainty.",
        "README links to the deeper explanation if needed.",
        "No code changes are required."
      ],
      notes: "This is a docs-only task. `npm test` is not required if no code changes are made."
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
  const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100`, {
    headers: githubHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch existing issues: ${response.status} ${response.statusText}`);
  }

  const issues = await response.json();
  return new Set(issues.map((issue) => issue.title));
}

async function createIssue(repo, token, issue) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify(issue)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create issue: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  return response.json();
}

function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "a11y-shiftleft-cli-issue-seed",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}
