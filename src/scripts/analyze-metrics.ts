import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const DEFAULT_METRICS = [
  "violations_unique",
  "time_to_fix_hours",
  "false_positive_rate",
  "duplicate_rate",
  "dx_score"
] as const;

type DefaultMetric = (typeof DEFAULT_METRICS)[number];

export type MetricRow = {
  framework?: string;
  phase?: string;
  violations_raw?: number | string;
  violations_unique?: number | string;
  critical?: number | string;
  warning?: number | string;
  info?: number | string;
  duplicates_removed?: number | string;
  duplicate_rate?: number | string;
  time_to_fix_hours?: number | string;
  false_positive_count?: number | string;
  confirmed_issue_count?: number | string;
  false_positive_rate?: number | string;
  dx_score?: number | string;
  [key: string]: unknown;
};

type NormalizedMetricRow = Omit<MetricRow, DefaultMetric> & {
  phase?: string;
  framework?: string;
  violations_raw: number;
  violations_unique: number;
  critical: number;
  warning: number;
  info: number;
  duplicates_removed: number;
  duplicate_rate: number;
  time_to_fix_hours: number;
  false_positive_count: number;
  confirmed_issue_count: number;
  false_positive_rate: number;
  dx_score: number;
};

export type AnalysisOptions = {
  metrics?: string[];
};

export type MetricSummary = {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
};

export type MetricComparison = {
  baseline: MetricSummary;
  intervention: MetricSummary;
  delta: number | null;
  percentChange: number | null;
  cohensD: number | null;
};

export type MetricsAnalysis = {
  generatedAt: string;
  rowCount: number;
  phases: {
    baseline: number;
    intervention: number;
  };
  frameworks: Record<string, number>;
  comparisons: Record<string, MetricComparison>;
};

type AnalyzeArgs = {
  filePath?: string;
  out?: string;
};

export async function analyzeMetricsFile(
  filePath: string,
  options: AnalysisOptions = {}
): Promise<MetricsAnalysis> {
  const csv = await fs.readFile(filePath, "utf8");
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as MetricRow[];

  return analyzeRows(rows, options);
}

export async function writeAnalysis(outputPath: string, analysis: unknown): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(analysis, null, 2)}\n`);
}

export function analyzeRows(
  rows: MetricRow[],
  options: AnalysisOptions = {}
): MetricsAnalysis {
  const normalizedRows = rows.map(normalizeRow);
  const metrics = options.metrics ?? [...DEFAULT_METRICS];
  const phases = {
    baseline: normalizedRows.filter((row) => row.phase === "baseline"),
    intervention: normalizedRows.filter((row) => row.phase === "intervention")
  };

  const comparisons = Object.fromEntries(metrics.map((metric) => {
    const baselineValues = valuesFor(phases.baseline, metric);
    const interventionValues = valuesFor(phases.intervention, metric);

    return [metric, {
      baseline: summarizeValues(baselineValues),
      intervention: summarizeValues(interventionValues),
      delta: round(mean(interventionValues) - mean(baselineValues)),
      percentChange: percentChange(mean(baselineValues), mean(interventionValues)),
      cohensD: cohensD(baselineValues, interventionValues)
    }];
  }));

  return {
    generatedAt: new Date().toISOString(),
    rowCount: normalizedRows.length,
    phases: {
      baseline: phases.baseline.length,
      intervention: phases.intervention.length
    },
    frameworks: countBy(normalizedRows, "framework"),
    comparisons
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const filePath = args.filePath ?? "data/pr-metrics-template.csv";
  const analysis = await analyzeMetricsFile(filePath);
  const output = JSON.stringify(analysis, null, 2);

  if (args.out) {
    await writeAnalysis(args.out, analysis);
    console.log(`Wrote ${args.out}`);
    return;
  }

  console.log(output);
}

export function parseArgs(args: string[]): AnalyzeArgs {
  const parsed: AnalyzeArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--out") {
      parsed.out = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--out=")) {
      parsed.out = arg.slice("--out=".length);
      continue;
    }

    if (!parsed.filePath) {
      parsed.filePath = arg;
    }
  }

  return parsed;
}

function normalizeRow(row: MetricRow): NormalizedMetricRow {
  const normalized = { ...row } as NormalizedMetricRow;
  const numericFields = [
    "violations_raw",
    "violations_unique",
    "critical",
    "warning",
    "info",
    "duplicates_removed",
    "duplicate_rate",
    "time_to_fix_hours",
    "false_positive_count",
    "confirmed_issue_count",
    "dx_score"
  ] satisfies Array<keyof NormalizedMetricRow>;

  for (const field of numericFields) {
    normalized[field] = toNumber(row[field]);
  }

  normalized.false_positive_rate = normalized.violations_unique > 0
    ? round(normalized.false_positive_count / normalized.violations_unique) ?? 0
    : 0;

  if (!Number.isFinite(normalized.duplicate_rate)) {
    normalized.duplicate_rate = normalized.violations_raw > 0
      ? round(normalized.duplicates_removed / normalized.violations_raw) ?? 0
      : 0;
  }

  return normalized;
}

function valuesFor(rows: NormalizedMetricRow[], metric: string): number[] {
  return rows
    .map((row) => row[metric])
    .filter((value): value is number => Number.isFinite(value));
}

function summarizeValues(values: number[]): MetricSummary {
  return {
    n: values.length,
    mean: round(mean(values)),
    median: round(median(values)),
    sd: round(standardDeviation(values)),
    min: round(values.length ? Math.min(...values) : Number.NaN),
    max: round(values.length ? Math.max(...values) : Number.NaN)
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values
    .reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function cohensD(baselineValues: number[], interventionValues: number[]): number | null {
  if (baselineValues.length < 2 || interventionValues.length < 2) return null;
  const baselineSd = standardDeviation(baselineValues);
  const interventionSd = standardDeviation(interventionValues);
  const pooledVariance = (
    ((baselineValues.length - 1) * (baselineSd ** 2)) +
    ((interventionValues.length - 1) * (interventionSd ** 2))
  ) / (baselineValues.length + interventionValues.length - 2);

  const pooledSd = Math.sqrt(pooledVariance);
  if (pooledSd === 0) return null;

  return round((mean(interventionValues) - mean(baselineValues)) / pooledSd);
}

function percentChange(baselineMean: number, interventionMean: number): number | null {
  if (!Number.isFinite(baselineMean) || baselineMean === 0) return null;
  return round((interventionMean - baselineMean) / baselineMean);
}

function countBy(rows: NormalizedMetricRow[], field: string): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row[field] || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toNumber(value: unknown): number {
  if (value === undefined || value === null || value === "") return Number.NaN;
  return Number(value);
}

function round(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}
