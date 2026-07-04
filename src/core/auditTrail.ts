import { createRequire } from "node:module";
import type { A11yReport, ReportAuditTrail, ReportFormat, ReportMetrics } from "../types.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

interface CreateAuditTrailOptions {
  metrics: ReportMetrics;
  formats: ReportFormat[];
  report?: Pick<A11yReport, "exploration" | "keyboard" | "manualChecklist" | "lighthouse">;
  generatedFiles?: string[];
  issueSources?: string[];
}

export function createReportAuditTrail(options: CreateAuditTrailOptions): ReportAuditTrail {
  const { metrics, formats, report, generatedFiles = [], issueSources = [] } = options;
  const includedUrls = report?.exploration
    ? [...new Set(report.exploration.states.map((state) => state.url))]
    : [...new Set(metrics.urls || [])];
  const sources = [...new Set(issueSources.filter(Boolean))];
  const keyboard = Boolean(report?.keyboard);
  const lighthouse = Boolean(report?.lighthouse?.length || metrics.lighthouse?.length);
  const manualChecklist = Boolean(report?.manualChecklist);
  const exploration = report?.exploration;

  return {
    version: 1,
    tool: {
      name: "a11y-shiftleft-cli",
      version,
      nodeVersion: process.version
    },
    command: {
      name: metrics.commandName || "unknown",
      profile: metrics.commandProfile || inferProfile(metrics, report)
    },
    requestedUrls: [...new Set(metrics.urls || includedUrls)],
    includedUrls,
    outputFormats: [...formats],
    generatedFiles,
    automation: {
      staticAnalysis: sources.includes("eslint"),
      browserAutomation: Boolean(exploration || sources.includes("axe")),
      keyboardTraversal: keyboard,
      lighthouseComparison: lighthouse,
      manualChecklist
    },
    ...(exploration || keyboard ? {
      limits: {
        ...(exploration ? {
          maxDepth: exploration.summary.maxDepth,
          maxStates: exploration.summary.maxStates
        } : {}),
        ...(keyboard ? { maxTabs: report?.keyboard?.maxTabs } : {})
      }
    } : {}),
    ...ciContext(),
    boundaries: [
      "Automated findings are evidence for triage, not a WCAG conformance certification.",
      "Manual review is still required for screen reader behavior, task completion, content clarity, media quality, and assistive-technology-specific behavior.",
      "Screenshots and raw browser evidence stay local unless the user explicitly shares or exports them."
    ]
  };
}

function inferProfile(metrics: ReportMetrics, report: CreateAuditTrailOptions["report"]): string {
  if (report?.exploration || report?.keyboard || report?.manualChecklist) return "visual-audit";
  if (metrics.commandName === "keyboard") return "keyboard";
  return "automated-check";
}

function ciContext(): Pick<ReportAuditTrail, "ci"> {
  if (process.env.GITHUB_ACTIONS === "true") {
    return {
      ci: {
        provider: "github-actions",
        runId: process.env.GITHUB_RUN_ID,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        workflow: process.env.GITHUB_WORKFLOW,
        job: process.env.GITHUB_JOB,
        commitSha: process.env.GITHUB_SHA,
        branch: process.env.GITHUB_REF_NAME
      }
    };
  }

  if (process.env.CI) {
    return {
      ci: {
        provider: "unknown-ci",
        commitSha: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA,
        branch: process.env.GITHUB_REF_NAME || process.env.CI_COMMIT_REF_NAME
      }
    };
  }

  return {};
}
