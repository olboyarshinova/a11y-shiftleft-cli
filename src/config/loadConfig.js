import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "./defaultConfig.js";

const CONFIG_FILE = ".a11y-shiftleft.json";

export async function loadConfig(options = {}, overrides = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const configPath = path.resolve(cwd, options.config || CONFIG_FILE);
  let fileConfig = {};

  try {
    const raw = await fs.readFile(configPath, "utf8");
    fileConfig = JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const config = mergeConfig(defaultConfig, fileConfig, overrides);

  return {
    ...config,
    cwd,
    configPath,
    outputDir: path.resolve(cwd, config.outputDir)
  };
}

function mergeConfig(...configs) {
  return configs.reduce((acc, config) => deepMerge(acc, config), {});
}

function deepMerge(target, source) {
  const output = { ...target };

  for (const [key, value] of Object.entries(source || {})) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
