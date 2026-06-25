import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Command } from "commander";
import {
  collectDashboardData,
  renderDashboardHtml,
  type DashboardData
} from "../core/dashboard.js";
import { writeHtmlPdf } from "../reporters/writeHtmlPdf.js";

interface DashboardOptions {
  reports?: string;
  host?: string;
  port?: string;
  out?: string;
  serve?: boolean;
  pdf?: boolean;
  json?: boolean;
  maxDepth?: string;
}

interface DashboardDestination {
  mode: "json" | "file" | "server";
  outputPath?: string;
  jsonPath?: string;
  pdfPath?: string;
  url?: string;
}

export function registerDashboardCommand(program: Command): void {
  program
    .command("dashboard")
    .description("Build or serve a local dashboard from generated accessibility reports.")
    .option("--reports <dir>", "Reports root directory to index", "reports")
    .option("--host <host>", "Host for the local dashboard server", "localhost")
    .option("--port <port>", "Port for the local dashboard server", "3333")
    .option("--out <file>", "Write a static HTML dashboard and exit")
    .option("--pdf", "Write dashboard.pdf alongside the static HTML dashboard")
    .option("--no-serve", "Write dashboard.html into the reports directory instead of starting a server")
    .option("--json", "Print dashboard data as JSON and exit")
    .option("--max-depth <depth>", "Maximum directory depth when discovering a11y-report.json files", "6")
    .action(async (options: DashboardOptions) => {
      const reportsRoot = path.resolve(options.reports || "reports");
      const data = await collectDashboardData(reportsRoot, {
        maxDepth: toPositiveInteger(options.maxDepth)
      });

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      const html = renderDashboardHtml(data);

      if (options.serve === false || options.out || options.pdf) {
        const outputPath = path.resolve(options.out || path.join(reportsRoot, "dashboard.html"));
        const jsonPath = await writeStaticDashboardFiles(outputPath, html, data);
        const pdfPath = options.pdf ? await writeHtmlPdf(outputPath, toPdfPath(outputPath)) : undefined;
        console.log(formatDashboardSummary(data, {
          mode: "file",
          outputPath,
          jsonPath,
          pdfPath
        }));
        return;
      }

      const server = http.createServer((request, response) => {
        if (request.url === "/dashboard.json") {
          response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          response.end(JSON.stringify(data, null, 2));
          return;
        }

        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html);
      });
      const host = options.host || "localhost";
      const port = toPositiveInteger(options.port) || 3333;

      server.listen(port, host, () => {
        const address = server.address() as AddressInfo;
        const url = `http://${host}:${address.port}`;

        console.log(formatDashboardSummary(data, {
          mode: "server",
          url
        }));
      });
    });
}

export async function writeStaticDashboardFiles(
  outputPath: string,
  html: string,
  data: DashboardData
): Promise<string> {
  const jsonPath = toJsonPath(outputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await Promise.all([
    fs.writeFile(outputPath, html),
    fs.writeFile(jsonPath, `${JSON.stringify(data, null, 2)}\n`)
  ]);
  return jsonPath;
}

export function formatDashboardSummary(data: DashboardData, destination: DashboardDestination): string {
  const latest = data.latestRun;
  const topRule = data.topRules[0];
  const target = destination.mode === "json"
    ? "JSON stdout"
    : destination.mode === "server"
      ? destination.url
      : destination.outputPath;

  return [
    "a11y-shiftleft dashboard",
    `Runs indexed: ${data.totalRuns}`,
    latest
      ? `Latest run: ${latest.id} total=${latest.total} critical=${latest.critical} warning=${latest.warning} info=${latest.info}`
      : "Latest run: none",
    data.latestDelta
      ? `Latest change: total ${formatDelta(data.latestDelta.total.change)}, critical ${formatDelta(data.latestDelta.critical.change)}, warning ${formatDelta(data.latestDelta.warning.change)}, Lighthouse ${formatDelta(data.latestDelta.lighthouseScore.change)}`
      : "Latest change: n/a (need 2 runs)",
    `New/worse problems: ${formatRulePageCounts(data.regressions?.rules.length, data.regressions?.pages.length)}`,
    `Resolved problems: ${formatRulePageCounts(data.resolved?.rules.length, data.resolved?.pages.length)}`,
    topRule
      ? `Top rule: ${topRule.ruleId} (${topRule.total})`
      : "Top rule: none",
    `Output: ${target}`,
    ...(destination.jsonPath ? [`JSON: ${destination.jsonPath}`] : []),
    ...(destination.pdfPath ? [`PDF: ${destination.pdfPath}`] : [])
  ].join("\n");
}

function formatDelta(value: number | null): string {
  if (value === null) return "n/a";
  return value > 0 ? `+${value}` : String(value);
}

function formatRulePageCounts(rules: number | undefined, pages: number | undefined): string {
  if (typeof rules !== "number" || typeof pages !== "number") return "n/a (need 2 runs)";
  return `${rules} rule(s), ${pages} page(s)`;
}

function toPdfPath(htmlPath: string): string {
  const extension = path.extname(htmlPath);
  if (!extension) return `${htmlPath}.pdf`;
  return `${htmlPath.slice(0, -extension.length)}.pdf`;
}

function toJsonPath(htmlPath: string): string {
  const extension = path.extname(htmlPath);
  if (!extension) return `${htmlPath}.json`;
  return `${htmlPath.slice(0, -extension.length)}.json`;
}

function toPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}
