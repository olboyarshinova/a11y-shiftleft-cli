import fs from "node:fs/promises";
import path from "node:path";

export async function detectFramework(cwd) {
  try {
    const raw = await fs.readFile(path.join(cwd, "package.json"), "utf8");
    const packageJson = JSON.parse(raw);
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    if (dependencies["@angular/core"] || devDependencies["@angular/core"]) {
      return "angular";
    }

    if (dependencies.vue || devDependencies.vue) {
      return "vue";
    }

    if (dependencies.react || devDependencies.react) {
      return "react";
    }

    if (devDependencies["@angular-eslint/eslint-plugin"]) return "angular";
    if (devDependencies["eslint-plugin-vue"]) return "vue";
    if (devDependencies["eslint-plugin-jsx-a11y"]) return "react";
  } catch {
    return "unknown";
  }

  return "unknown";
}
