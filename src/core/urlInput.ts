export function normalizeHttpUrlInput(value: string, optionName = "--url"): string {
  const normalized = normalizeCliValue(value);
  if (!normalized) throw new Error(`${optionName} must be a non-empty URL.`);

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Invalid ${optionName} value: ${value}. Use a full URL such as https://example.com or http://localhost:5173.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid ${optionName} protocol: ${parsed.protocol}. Use http:// or https://.`);
  }

  return parsed.toString();
}

export function normalizeCliValue(value: string | undefined): string {
  if (value === undefined) return "";
  return value
    .trim()
    .replace(/^[“”"«»']+/, "")
    .replace(/[“”"«»']+$/, "")
    .trim();
}
