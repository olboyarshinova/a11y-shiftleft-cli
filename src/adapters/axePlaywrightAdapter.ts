import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import type { A11yConfig, Issue } from "../types.js";

export async function runAxePlaywrightAdapter(config: A11yConfig): Promise<Issue[]> {
  const browser = await chromium.launch();
  const issues: Issue[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const url of config.dynamic.urls) {
      await page.goto(url, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).analyze();

      for (const violation of results.violations) {
        for (const node of violation.nodes) {
          issues.push({
            source: "axe",
            framework: config.framework,
            ruleId: violation.id,
            impact: violation.impact || undefined,
            wcag: violation.tags.filter((tag: string) => tag.startsWith("wcag")),
            selector: node.target.join(" "),
            message: violation.help,
            url
          });
        }
      }
    }
  } finally {
    await browser.close();
  }

  return issues;
}
