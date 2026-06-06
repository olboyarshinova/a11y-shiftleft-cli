import type { Command } from "commander";
import {
  adapterInstallCommand,
  getAdapterRecommendation,
  listAdapterRecommendations,
  type PackageManager
} from "../core/frameworkAdapters.js";
import type { Framework } from "../types.js";

interface AdapterOptions {
  packageManager?: string;
  json?: boolean;
}

export function registerAdapterCommand(program: Command): void {
  const adapter = program
    .command("adapter")
    .description("Show framework adapter dependency recommendations.");

  adapter
    .command("list")
    .description("List supported framework adapters.")
    .option("--json", "Print machine-readable adapter recommendations")
    .action((options: Pick<AdapterOptions, "json">) => {
      const recommendations = listAdapterRecommendations();

      if (options.json) {
        console.log(JSON.stringify({ adapters: recommendations }, null, 2));
        return;
      }

      console.log(formatAdapterList());
    });

  adapter
    .command("add <framework>")
    .description("Print install command for a framework adapter.")
    .option("--package-manager <name>", "npm, pnpm, or yarn", "npm")
    .option("--json", "Print machine-readable adapter install guidance")
    .action((framework: string, options: AdapterOptions) => {
      const recommendation = getAdapterRecommendation(toFramework(framework));
      const packageManager = toPackageManager(options.packageManager);

      if (!recommendation) {
        throw new Error("Unsupported adapter framework. Use react, vue, or angular.");
      }

      const install = adapterInstallCommand(recommendation.packages, packageManager);
      const payload = {
        framework: recommendation.framework,
        packages: recommendation.packages,
        packageManager,
        install,
        init: `npx a11y-shiftleft init --framework ${recommendation.framework}`,
        note: recommendation.note
      };

      if (options.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log(formatAdapterInstall(payload));
    });
}

export function formatAdapterList(): string {
  const lines = [
    "a11y-shiftleft adapters",
    "",
    ...listAdapterRecommendations().map((adapter) => (
      `${adapter.framework}: ${adapter.packages.join(" ")}`
    )),
    "",
    "Example:",
    "npx a11y-shiftleft adapter add react"
  ];

  return lines.join("\n");
}

export function formatAdapterInstall(options: {
  framework: string;
  packages: string[];
  packageManager: PackageManager;
  install: string;
  init: string;
  note: string;
}): string {
  return [
    `Adapter: ${options.framework}`,
    "",
    options.note,
    "",
    "Install:",
    options.install,
    "",
    "Initialize config:",
    options.init
  ].join("\n");
}

function toFramework(framework: string): Framework {
  if (framework === "react" || framework === "vue" || framework === "angular") return framework;
  return "unknown";
}

function toPackageManager(packageManager: string | undefined): PackageManager {
  if (packageManager === "pnpm" || packageManager === "yarn") return packageManager;
  return "npm";
}
