import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "./defaultConfig.js";
import type { A11yConfig, ConfigOverrides } from "../types.js";

export const DEFAULT_CONFIG_FILE = ".a11y-shiftleft.json";
export const CONFIG_FILE_CANDIDATES = [
  DEFAULT_CONFIG_FILE,
  ".a11yrc.json"
];

interface LoadConfigOptions {
  cwd?: string;
  config?: string;
}

export interface DiscoveredConfig {
  configPath: string;
  config: ConfigOverrides;
  found: boolean;
  source: string;
}

type PlainObject = Record<string, unknown>;

export async function loadConfig(
  options: LoadConfigOptions = {},
  overrides: ConfigOverrides = {}
): Promise<A11yConfig> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const discovered = await discoverConfig(cwd, options.config);
  const config = mergeConfig(defaultConfig as ConfigOverrides, discovered.config, overrides) as unknown as A11yConfig;

  return {
    ...config,
    cwd,
    configPath: discovered.configPath,
    outputDir: path.resolve(cwd, config.outputDir)
  };
}

export async function discoverConfig(cwd: string, explicitConfig?: string): Promise<DiscoveredConfig> {
  if (explicitConfig) {
    const configPath = path.resolve(cwd, explicitConfig);
    const config = await readJsonConfigIfExists(configPath);

    return {
      configPath,
      config: config || {},
      found: Boolean(config),
      source: explicitConfig
    };
  }

  for (const candidate of CONFIG_FILE_CANDIDATES) {
    const configPath = path.resolve(cwd, candidate);
    const config = await readJsonConfigIfExists(configPath);

    if (config) {
      return {
        configPath,
        config,
        found: true,
        source: candidate
      };
    }
  }

  const packageJsonPath = path.resolve(cwd, "package.json");
  const packageJson = await readJsonIfExists(packageJsonPath);

  if (packageJson && "a11y" in packageJson) {
    if (!isPlainObject(packageJson.a11y)) {
      throw new Error("package.json#a11y must be a JSON object.");
    }

    return {
      configPath: packageJsonPath,
      config: packageJson.a11y as ConfigOverrides,
      found: true,
      source: "package.json#a11y"
    };
  }

  return {
    configPath: path.resolve(cwd, DEFAULT_CONFIG_FILE),
    config: {},
    found: false,
    source: DEFAULT_CONFIG_FILE
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

async function readJsonConfigIfExists(filePath: string): Promise<ConfigOverrides | null> {
  const json = await readJsonIfExists(filePath);
  if (!json) return null;
  return json as ConfigOverrides;
}

async function readJsonIfExists(filePath: string): Promise<PlainObject | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    if (!isPlainObject(parsed)) {
      throw new Error(`JSON config must be an object: ${filePath}`);
    }
    return parsed;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
