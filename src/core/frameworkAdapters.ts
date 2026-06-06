import type { Framework } from "../types.js";

export interface FrameworkAdapterRecommendation {
  framework: Exclude<Framework, "auto" | "unknown">;
  packages: string[];
  note: string;
}

export type PackageManager = "npm" | "pnpm" | "yarn";

const ADAPTER_RECOMMENDATIONS: Record<FrameworkAdapterRecommendation["framework"], FrameworkAdapterRecommendation> = {
  react: {
    framework: "react",
    packages: ["eslint-plugin-jsx-a11y"],
    note: "React static checks use eslint-plugin-jsx-a11y."
  },
  vue: {
    framework: "vue",
    packages: ["eslint-plugin-vue"],
    note: "Vue static checks use eslint-plugin-vue template rules."
  },
  angular: {
    framework: "angular",
    packages: [
      "@angular-eslint/eslint-plugin-template",
      "@angular-eslint/template-parser"
    ],
    note: "Angular static checks use angular-eslint template rules."
  }
};

export function adapterPackagesForFramework(framework: Framework): string[] {
  return getAdapterRecommendation(framework)?.packages || [];
}

export function getAdapterRecommendation(framework: Framework): FrameworkAdapterRecommendation | undefined {
  if (framework === "react" || framework === "vue" || framework === "angular") {
    return ADAPTER_RECOMMENDATIONS[framework];
  }

  return undefined;
}

export function listAdapterRecommendations(): FrameworkAdapterRecommendation[] {
  return Object.values(ADAPTER_RECOMMENDATIONS);
}

export function adapterInstallCommand(
  packages: string[],
  packageManager: PackageManager = "npm"
): string {
  if (packages.length === 0) return "";

  if (packageManager === "pnpm") {
    return `pnpm add -D ${packages.join(" ")}`;
  }

  if (packageManager === "yarn") {
    return `yarn add -D ${packages.join(" ")}`;
  }

  return `npm install --save-dev ${packages.join(" ")}`;
}
