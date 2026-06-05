import type { A11yConfig } from "../types.js";

export const defaultConfig = {
  framework: "auto",
  standard: "wcag22-aa",
  wcagVersion: "2.2",
  wcagLevel: "AA",
  failOn: "critical",
  outputDir: "reports",
  static: {
    enabled: true,
    include: ["src/**/*.{js,jsx,ts,tsx,vue,html}"]
  },
  dynamic: {
    enabled: false,
    urls: ["http://localhost:3000"],
    browser: "chromium",
    crawl: false,
    crawlDepth: 1,
    crawlLimit: 10
  },
  metrics: {
    enabled: true,
    csv: true,
    json: true
  }
} satisfies Omit<A11yConfig, "cwd" | "configPath">;
