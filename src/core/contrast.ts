import type { ContrastEvidence, ContrastSuggestion } from "../types.js";

interface AxeCheckLike {
  id?: string;
  data?: unknown;
}

interface AxeNodeLike {
  any?: AxeCheckLike[];
  all?: AxeCheckLike[];
  none?: AxeCheckLike[];
}

interface ContrastCheckData {
  fgColor?: unknown;
  bgColor?: unknown;
  contrastRatio?: unknown;
  expectedContrastRatio?: unknown;
  fontSize?: unknown;
  fontWeight?: unknown;
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export function extractContrastEvidence(
  ruleId: string,
  node: AxeNodeLike
): ContrastEvidence | undefined {
  if (ruleId !== "color-contrast" && ruleId !== "color-contrast-enhanced") {
    return undefined;
  }

  const check = [...(node.any || []), ...(node.all || []), ...(node.none || [])]
    .find((candidate) => candidate.id === ruleId || candidate.id === "color-contrast");
  const data = toContrastCheckData(check?.data);
  if (!data) return undefined;

  const actualRatio = toRatio(data.contrastRatio);
  const requiredRatio = toRatio(data.expectedContrastRatio);
  const foreground = toNonEmptyString(data.fgColor);
  const background = toNonEmptyString(data.bgColor);

  if (actualRatio === undefined || requiredRatio === undefined || !foreground || !background) {
    return undefined;
  }

  return {
    actualRatio,
    requiredRatio,
    foreground,
    background,
    fontSize: toNonEmptyString(data.fontSize),
    fontWeight: toNonEmptyString(data.fontWeight),
    suggestions: suggestContrastColors(foreground, background, requiredRatio)
  };
}

export function suggestContrastColors(
  foreground: string,
  background: string,
  requiredRatio: number
): ContrastSuggestion[] {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  if (!foregroundRgb || !backgroundRgb || requiredRatio <= 1) return [];
  if (getContrastRatio(foregroundRgb, backgroundRgb) >= requiredRatio) return [];

  const targets = contrastSuggestionTargets(requiredRatio);
  const suggestions: ContrastSuggestion[] = [];
  const seenColors = new Set<string>();

  for (const target of targets) {
    const color = findNearestPassingColor(
      foregroundRgb,
      (candidate) => getContrastRatio(candidate, backgroundRgb),
      target.ratio
    );
    if (!color) continue;

    const suggestion = toSuggestion(target.purpose, color, backgroundRgb);
    if (seenColors.has(suggestion.color)) continue;

    seenColors.add(suggestion.color);
    suggestions.push(suggestion);
  }

  return suggestions;
}

export function calculateContrastRatio(foreground: string, background: string): number | undefined {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  if (!foregroundRgb || !backgroundRgb) return undefined;

  return roundRatio(getContrastRatio(foregroundRgb, backgroundRgb));
}

function toSuggestion(
  purpose: ContrastSuggestion["purpose"],
  foreground: RgbColor,
  background: RgbColor
): ContrastSuggestion {
  return {
    target: "foreground",
    purpose,
    color: toHexColor(foreground),
    contrastRatio: roundRatio(getContrastRatio(foreground, background))
  };
}

function contrastSuggestionTargets(requiredRatio: number): Array<{
  purpose: ContrastSuggestion["purpose"];
  ratio: number;
}> {
  const targets = [
    { purpose: "minimum" as const, ratio: requiredRatio },
    { purpose: "recommended" as const, ratio: requiredRatio < 4.5 ? 4.5 : Math.max(5, requiredRatio) },
    { purpose: "enhanced" as const, ratio: Math.max(7, requiredRatio) }
  ];

  return targets.filter((target, index) => (
    targets.findIndex((candidate) => candidate.ratio === target.ratio) === index
  ));
}

function findNearestPassingColor(
  original: RgbColor,
  getRatio: (candidate: RgbColor) => number,
  requiredRatio: number
): RgbColor | undefined {
  const endpoints: RgbColor[] = [
    { red: 0, green: 0, blue: 0 },
    { red: 255, green: 255, blue: 255 }
  ];
  let best: { color: RgbColor; distance: number } | undefined;

  for (const endpoint of endpoints) {
    for (let step = 1; step <= 1000; step += 1) {
      const amount = step / 1000;
      const candidate = blendColors(original, endpoint, amount);
      if (getRatio(candidate) + Number.EPSILON < requiredRatio) continue;

      const distance = colorDistance(original, candidate);
      if (!best || distance < best.distance) {
        best = { color: candidate, distance };
      }
      break;
    }
  }

  return best?.color;
}

function blendColors(start: RgbColor, end: RgbColor, amount: number): RgbColor {
  return {
    red: Math.round(start.red + ((end.red - start.red) * amount)),
    green: Math.round(start.green + ((end.green - start.green) * amount)),
    blue: Math.round(start.blue + ((end.blue - start.blue) * amount))
  };
}

function colorDistance(first: RgbColor, second: RgbColor): number {
  return Math.hypot(
    first.red - second.red,
    first.green - second.green,
    first.blue - second.blue
  );
}

function getContrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(color: RgbColor): number {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function parseHexColor(value: string): RgbColor | undefined {
  const normalized = value.trim().toLowerCase();
  const shortMatch = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(normalized);
  if (shortMatch) {
    return {
      red: Number.parseInt(shortMatch[1] + shortMatch[1], 16),
      green: Number.parseInt(shortMatch[2] + shortMatch[2], 16),
      blue: Number.parseInt(shortMatch[3] + shortMatch[3], 16)
    };
  }

  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(normalized);
  if (!match) return undefined;

  return {
    red: Number.parseInt(match[1], 16),
    green: Number.parseInt(match[2], 16),
    blue: Number.parseInt(match[3], 16)
  };
}

function toHexColor(color: RgbColor): string {
  const channel = (value: number) => value.toString(16).padStart(2, "0");
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`.toUpperCase();
}

function toContrastCheckData(value: unknown): ContrastCheckData | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as ContrastCheckData;
}

function toRatio(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}
