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
    device: undefined,
    crawl: false,
    crawlDepth: 1,
    crawlLimit: 10,
    scopeSelector: undefined,
    scroll: {
      enabled: true,
      stepPx: 800,
      maxSteps: 25,
      waitMs: 100
    }
  },
  metrics: {
    enabled: true,
    csv: true,
    json: true
  },
  explore: {
    browser: "chromium",
    device: undefined,
    scopeSelector: undefined,
    waitMs: 250,
    scroll: {
      enabled: true,
      stepPx: 800,
      maxSteps: 25,
      waitMs: 100
    },
    safeMode: {
      enabled: true,
      blockedText: [],
      blockedRoles: [],
      blockedUrls: [],
      blockedSelectors: [],
      allowedSelectors: ["[data-a11y-explore]"],
      dismissDialogs: true,
      isolateCookies: true
    }
  },
  retention: {
    enabled: false,
    maxRuns: 5,
    maxAgeDays: 14,
    dryRun: false
  }
} satisfies Omit<A11yConfig, "cwd" | "configPath">;
