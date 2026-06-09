import { ESLint } from "eslint";
import type { Linter } from "eslint";
import path from "node:path";
import type { A11yConfig, Issue } from "../types.js";

type JsxA11yPlugin = ESLint.Plugin & {
  flatConfigs: {
    recommended: {
      rules: Linter.RulesRecord;
    };
  };
};

type VuePlugin = ESLint.Plugin & {
  configs: {
    "flat/base": Linter.Config[];
  };
};

type AngularTemplatePlugin = ESLint.Plugin & {
  configs: {
    accessibility: {
      rules: Linter.RulesRecord;
    };
  };
};

const VUE_ACCESSIBILITY_RULES = new Set([
  "vue/html-button-has-type",
  "vue/no-v-html"
]);

const ANGULAR_TEMPLATE_ACCESSIBILITY_RULES = new Set([
  "@angular-eslint/template/alt-text",
  "@angular-eslint/template/click-events-have-key-events",
  "@angular-eslint/template/elements-content",
  "@angular-eslint/template/interactive-supports-focus",
  "@angular-eslint/template/label-has-associated-control",
  "@angular-eslint/template/mouse-events-have-key-events",
  "@angular-eslint/template/no-autofocus",
  "@angular-eslint/template/no-distracting-elements",
  "@angular-eslint/template/no-positive-tabindex",
  "@angular-eslint/template/role-has-required-aria",
  "@angular-eslint/template/table-scope",
  "@angular-eslint/template/valid-aria",
  "@angular-eslint/template/button-has-type"
]);

export async function runEslintAdapter(config: A11yConfig): Promise<Issue[]> {
  const patterns = config.static.include;

  try {
    const eslint = new ESLint({
      cwd: config.cwd,
      errorOnUnmatchedPattern: false
    });

    const projectResults = await eslint.lintFiles(patterns);
    const projectIssues = toIssues(projectResults, config);

    if (projectIssues.length > 0) {
      return projectIssues;
    }

    return await runFallbackRules(config, patterns);
  } catch (error) {
    return await recoverWithFallback(config, patterns, error);
  }
}

async function recoverWithFallback(config: A11yConfig, patterns: string[], originalError: unknown): Promise<Issue[]> {
  if (["react", "vue", "angular", "auto"].includes(config.framework)) {
    try {
      return await runFallbackRules(config, patterns);
    } catch {
      return [adapterError(config, originalError)];
    }
  }

  return [adapterError(config, originalError)];
}

async function runFallbackRules(config: A11yConfig, patterns: string[]): Promise<Issue[]> {
  if (config.framework === "vue") {
    return await runVueFallbackRules(config, patterns);
  }

  if (config.framework === "angular") {
    return await runAngularFallbackRules(config, patterns);
  }

  if (config.framework === "react" || config.framework === "auto") {
    return await runReactFallbackRules({ ...config, framework: "react" }, patterns);
  }

  return [];
}

async function runReactFallbackRules(config: A11yConfig, patterns: string[]): Promise<Issue[]> {
  const jsxA11y = await loadAdapterModule<JsxA11yPlugin>(
    "eslint-plugin-jsx-a11y",
    config
  );

  const eslint = new ESLint({
    cwd: config.cwd,
    overrideConfigFile: true,
    errorOnUnmatchedPattern: false,
    overrideConfig: [
      {
        files: ["**/*.{js,jsx,ts,tsx}"],
        plugins: {
          "jsx-a11y": jsxA11y
        },
        languageOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
          parserOptions: {
            ecmaFeatures: {
              jsx: true
            }
          }
        },
        rules: jsxA11y.flatConfigs.recommended.rules as Linter.RulesRecord
      }
    ]
  });

  const results = await eslint.lintFiles(patterns);
  return toIssues(results, config);
}

async function runVueFallbackRules(config: A11yConfig, patterns: string[]): Promise<Issue[]> {
  const vue = await loadAdapterModule<VuePlugin>(
    "eslint-plugin-vue",
    config
  );

  const eslint = new ESLint({
    cwd: config.cwd,
    overrideConfigFile: true,
    errorOnUnmatchedPattern: false,
    overrideConfig: [
      ...vue.configs["flat/base"],
      {
        files: ["**/*.vue"],
        plugins: {
          vue
        },
        rules: {
          "vue/html-button-has-type": "warn",
          "vue/no-v-html": "warn"
        }
      }
    ]
  });

  const results = await eslint.lintFiles(patterns);
  return toIssues(results, config);
}

async function runAngularFallbackRules(config: A11yConfig, patterns: string[]): Promise<Issue[]> {
  const angularTemplate = await loadAdapterModule<AngularTemplatePlugin>(
    "@angular-eslint/eslint-plugin-template",
    config
  );
  const templateParser = await loadAdapterModule<Linter.Parser>(
    "@angular-eslint/template-parser",
    config
  );
  const angularTemplatePlugin = angularTemplate as unknown as ESLint.Plugin;

  const eslint = new ESLint({
    cwd: config.cwd,
    overrideConfigFile: true,
    errorOnUnmatchedPattern: false,
    overrideConfig: [
      {
        files: ["**/*.html"],
        languageOptions: {
          parser: templateParser
        },
        plugins: {
          "@angular-eslint/template": angularTemplatePlugin
        },
        rules: {
          ...angularTemplate.configs.accessibility.rules,
          "@angular-eslint/template/button-has-type": "warn"
        } as Linter.RulesRecord
      }
    ]
  });

  const results = await eslint.lintFiles(patterns);
  return toIssues(results, config);
}

async function loadAdapterModule<T>(packageName: string, config: A11yConfig): Promise<T> {
  try {
    const imported = await import(packageName);
    return (imported.default || imported) as T;
  } catch (error) {
    if (isModuleResolutionError(error)) {
      throw new Error(
        `${packageName} is required for ${config.framework} static checks. ` +
        `Install the matching adapter package or run npx a11y-shiftleft doctor --framework ${config.framework}.`
      );
    }

    throw error;
  }
}

function toIssues(results: ESLint.LintResult[], config: A11yConfig): Issue[] {
  return results.flatMap((result) => result.messages
    .filter((message) => isAccessibilityRule(message.ruleId))
    .map((message) => ({
      source: "eslint",
      framework: config.framework,
      ruleId: message.ruleId || "eslint/unknown",
      file: path.relative(config.cwd, result.filePath),
      line: message.line,
      column: message.column,
      message: message.message
    })));
}

function adapterError(config: A11yConfig, error: unknown): Issue {
  const message = error instanceof Error ? error.message : String(error);

  return {
    source: "eslint",
    framework: config.framework,
    ruleId: "adapter/eslint-error",
    message
  };
}

function isModuleResolutionError(error: unknown): error is NodeJS.ErrnoException {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND";
}

function isAccessibilityRule(ruleId: string | null): boolean {
  if (!ruleId) return false;

  return ruleId.startsWith("jsx-a11y/") ||
    ruleId.startsWith("vuejs-accessibility/") ||
    VUE_ACCESSIBILITY_RULES.has(ruleId) ||
    ANGULAR_TEMPLATE_ACCESSIBILITY_RULES.has(ruleId);
}
