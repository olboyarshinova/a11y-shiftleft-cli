import { ESLint } from "eslint";
import path from "node:path";
import jsxA11y from "eslint-plugin-jsx-a11y";

export async function runEslintAdapter(config) {
  const patterns = config.static.include;

  try {
    const eslint = new ESLint({
      cwd: config.cwd,
      errorOnUnmatchedPattern: false
    });

    const projectResults = await eslint.lintFiles(patterns);
    const projectIssues = toIssues(projectResults, config);

    if (projectIssues.length > 0 || config.framework !== "react") {
      return projectIssues;
    }

    return await runReactFallbackRules(config, patterns);
  } catch (error) {
    return await recoverWithFallback(config, patterns, error);
  }
}

async function recoverWithFallback(config, patterns, originalError) {
  if (config.framework === "react" || config.framework === "auto") {
    try {
      return await runReactFallbackRules({ ...config, framework: "react" }, patterns);
    } catch {
      return [adapterError(config, originalError)];
    }
  }

  return [adapterError(config, originalError)];
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
