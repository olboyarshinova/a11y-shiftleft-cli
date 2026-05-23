import fs from "node:fs/promises";
import path from "node:path";

export async function detectFramework(cwd) {
  try {
    const raw = await fs.readFile(path.join(cwd, "package.json"), "utf8");
    const packageJson = JSON.parse(raw);
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (dependencies["@angular/core"] || dependencies["@angular-eslint/eslint-plugin"]) {
      return "angular";
    }

    if (dependencies.vue || dependencies["eslint-plugin-vue"]) {
      return "vue";
    }

    if (dependencies.react || dependencies["eslint-plugin-jsx-a11y"]) {
      return "react";
    }
  } catch {
    return "unknown";
  }

  return "unknown";
}
