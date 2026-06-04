import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "./defaultConfig.js";
import type { A11yConfig, ConfigOverrides } from "../types.js";

const CONFIG_FILE = ".a11y-shiftleft.json";

interface LoadConfigOptions {
  cwd?: string;
  config?: string;
}

type PlainObject = Record<string, unknown>;

export async function loadConfig(
  options: LoadConfigOptions = {},
  overrides: ConfigOverrides = {}
): Promise<A11yConfig> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const configPath = path.resolve(cwd, options.config || CONFIG_FILE);
  let fileConfig: ConfigOverrides = {};

  try {
    const raw = await fs.readFile(configPath, "utf8");
    fileConfig = JSON.parse(raw) as ConfigOverrides;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") throw error;
  }

  const config = mergeConfig(defaultConfig as ConfigOverrides, fileConfig, overrides) as unknown as A11yConfig;

  return {
    ...config,
    cwd,
    configPath,
    outputDir: path.resolve(cwd, config.outputDir)
  };
}

function mergeConfig(...configs: PlainObject[]): PlainObject {
  return configs.reduce<PlainObject>((acc, config) => deepMerge(acc, config), {});
}

function deepMerge<T extends PlainObject>(target: T, source: PlainObject): T {
  const output: PlainObject = { ...target };

  for (const [key, value] of Object.entries(source || {})) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key] as PlainObject, value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as T;
}

function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
