import path from "node:path";

export const DEFAULT_AUTH_STATE_FILE = ".a11y-auth/state.json";
export const AUTH_GITIGNORE_ENTRIES = [
  ".a11y-auth/",
  "*.storageState.json"
];

export function resolveAuthStatePath(value: string | undefined, cwd = process.cwd()): string | undefined {
  const normalized = normalizeCliString(value);
  if (!normalized) return undefined;

  return path.resolve(cwd, normalized);
}

export function normalizeAuthUrl(value: string): string {
  const normalized = normalizeCliString(value);
  if (!normalized) throw new Error("A login URL is required.");

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return parsed.toString();
  } catch {
    throw new Error(`Invalid login URL: ${value}`);
  }
}

export function parseAuthTimeoutMs(value: string | undefined, fallback = 120_000): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 900_000) {
    throw new Error("Auth timeout must be an integer from 1000 to 900000 milliseconds.");
  }
  return parsed;
}

export function normalizeCliString(value: string | undefined): string | undefined {
  return value
    ?.trim()
    .replace(/^[`'"\u201c\u201d\u00ab\u00bb]+/, "")
    .replace(/[`'"\u201c\u201d\u00ab\u00bb]+$/, "")
    .trim();
}
