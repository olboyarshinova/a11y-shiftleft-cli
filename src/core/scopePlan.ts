import fs from "node:fs/promises";
import path from "node:path";
import type {
  ComplianceStandard,
  PlannedEvaluationScope,
  PlannedScopeExclusion,
  PlannedScopeJourney,
  PlannedScopeThirdPartyContent
} from "../types.js";

export const DEFAULT_SCOPE_FILE = "a11y-scope.json";

export interface CreateScopePlanInput {
  productName?: string;
  productType?: string;
  standard?: ComplianceStandard;
  urls?: string[];
  languages?: string[];
  supportedPlatforms?: string[];
  assistiveTechnologies?: string[];
  criticalJourneys?: PlannedScopeJourney[];
  thirdPartyContent?: PlannedScopeThirdPartyContent[];
  exclusions?: PlannedScopeExclusion[];
  notes?: string[];
  generatedAt?: string;
}

export function createScopePlan(input: CreateScopePlanInput = {}): PlannedEvaluationScope {
  return {
    version: 1,
    generatedAt: input.generatedAt || new Date().toISOString(),
    product: {
      ...(input.productName ? { name: input.productName } : {}),
      type: input.productType || "web application",
      languages: normalizeList(input.languages, ["en"])
    },
    target: {
      standard: input.standard || "wcag22-aa",
      urls: normalizeList(input.urls)
    },
    supportedPlatforms: normalizeList(input.supportedPlatforms, [
      "Desktop browser",
      "Mobile browser"
    ]),
    assistiveTechnologies: normalizeList(input.assistiveTechnologies, [
      "Keyboard only",
      "Screen reader manual review"
    ]),
    criticalJourneys: input.criticalJourneys || [],
    thirdPartyContent: input.thirdPartyContent || [],
    exclusions: input.exclusions || [],
    notes: normalizeList(input.notes)
  };
}

export async function writeScopePlan(filePath: string, scope: PlannedEvaluationScope): Promise<string> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(scope, null, 2)}\n`);
  return filePath;
}

export async function readScopePlanIfExists(cwd: string, fileName = DEFAULT_SCOPE_FILE): Promise<PlannedEvaluationScope | undefined> {
  const filePath = path.resolve(cwd, fileName);
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    return normalizeScopePlan(parsed, filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

export function parseJourney(value: string): PlannedScopeJourney {
  const [name, urlList = ""] = splitOnce(value, ":");
  return {
    name: requiredText(name, "Journey name"),
    urls: splitCsv(urlList)
  };
}

export function parseThirdPartyContent(value: string): PlannedScopeThirdPartyContent {
  const [name, url] = splitOnce(value, ":");
  return {
    name: requiredText(name, "Third-party content name"),
    ...(url ? { url: url.trim() } : {}),
    reviewStrategy: "Manual verification recommended"
  };
}

export function parseExclusion(value: string): PlannedScopeExclusion {
  const [area, reason = "Not included in this audit scope"] = splitOnce(value, ":");
  return {
    area: requiredText(area, "Excluded area"),
    reason: reason.trim() || "Not included in this audit scope"
  };
}

export function toComplianceStandard(value: string | undefined): ComplianceStandard {
  if (value === "wcag22-aa" || value === "ada-title-ii" || value === "section508") {
    return value;
  }
  return "wcag22-aa";
}

function normalizeScopePlan(value: unknown, filePath: string): PlannedEvaluationScope {
  if (!isPlainObject(value) || value.version !== 1) {
    throw new Error(`Invalid scope plan: ${filePath}`);
  }

  const product = isPlainObject(value.product) ? value.product : {};
  const target = isPlainObject(value.target) ? value.target : {};

  return createScopePlan({
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : undefined,
    productName: typeof product.name === "string" ? product.name : undefined,
    productType: typeof product.type === "string" ? product.type : undefined,
    languages: stringArray(product.languages),
    standard: toComplianceStandard(typeof target.standard === "string" ? target.standard : undefined),
    urls: stringArray(target.urls),
    supportedPlatforms: stringArray(value.supportedPlatforms),
    assistiveTechnologies: stringArray(value.assistiveTechnologies),
    criticalJourneys: Array.isArray(value.criticalJourneys)
      ? value.criticalJourneys.filter(isPlainObject).map((journey) => ({
        name: typeof journey.name === "string" ? journey.name : "Unnamed journey",
        urls: stringArray(journey.urls),
        ...(typeof journey.description === "string" ? { description: journey.description } : {}),
        ...(typeof journey.notes === "string" ? { notes: journey.notes } : {})
      }))
      : [],
    thirdPartyContent: Array.isArray(value.thirdPartyContent)
      ? value.thirdPartyContent.filter(isPlainObject).map((item) => ({
        name: typeof item.name === "string" ? item.name : "Third-party content",
        ...(typeof item.url === "string" ? { url: item.url } : {}),
        ...(typeof item.owner === "string" ? { owner: item.owner } : {}),
        reviewStrategy: typeof item.reviewStrategy === "string" ? item.reviewStrategy : "Manual verification recommended"
      }))
      : [],
    exclusions: Array.isArray(value.exclusions)
      ? value.exclusions.filter(isPlainObject).map((item) => ({
        area: typeof item.area === "string" ? item.area : "Excluded area",
        reason: typeof item.reason === "string" ? item.reason : "Not included in this audit scope",
        ...(typeof item.owner === "string" ? { owner: item.owner } : {}),
        ...(typeof item.reviewBy === "string" ? { reviewBy: item.reviewBy } : {})
      }))
      : [],
    notes: stringArray(value.notes)
  });
}

function normalizeList(values: string[] | undefined, fallback: string[] = []): string[] {
  const normalized = [...new Set((values || []).map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function splitOnce(value: string, separator: string): [string, string?] {
  const index = value.indexOf(separator);
  if (index === -1) return [value];
  return [value.slice(0, index), value.slice(index + separator.length)];
}

function requiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  return trimmed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
