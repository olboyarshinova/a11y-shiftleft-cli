import { ESLint } from "eslint";
import path from "node:path";
import jsxA11y from "eslint-plugin-jsx-a11y";
import vue from "eslint-plugin-vue";

export async function runEslintAdapter(config) {
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

async function recoverWithFallback(config, patterns, originalError) {
  if (["react", "vue", "auto"].includes(config.framework)) {
    try {
      return await runFallbackRules(config, patterns);
    } catch {
      return [adapterError(config, originalError)];
    }
  }

  return [adapterError(config, originalError)];
}

async function runFallbackRules(config, patterns) {
  if (config.framework === "vue") {
    return await runVueFallbackRules(config, patterns);
  }

  if (config.framework === "react" || config.framework === "auto") {
    return await runReactFallbackRules({ ...config, framework: "react" }, patterns);
  }

  return [];
}

async function runReactFallbackRules(config, patterns) {
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
        rules: jsxA11y.flatConfigs.recommended.rules
      }
    ]
  });

  const results = await eslint.lintFiles(patterns);
  return toIssues(results, config);
}

async function runVueFallbackRules(config, patterns) {
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

function toIssues(results, config) {
  return results.flatMap((result) => result.messages.map((message) => ({
    source: "eslint",
    framework: config.framework,
    ruleId: message.ruleId || "eslint/unknown",
    file: path.relative(config.cwd, result.filePath),
    line: message.line,
    column: message.column,
    message: message.message
  })));
}

function adapterError(config, error) {
  return {
    source: "eslint",
    framework: config.framework,
    ruleId: "adapter/eslint-error",
    message: error.message
  };
}
