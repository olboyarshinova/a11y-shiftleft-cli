import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { pathToFileURL } from "node:url";

const DEFAULT_METRICS = [
  "violations_unique",
  "time_to_fix_hours",
  "false_positive_rate",
  "duplicate_rate",
  "dx_score"
];

export async function analyzeMetricsFile(filePath, options = {}) {
  const csv = await fs.readFile(filePath, "utf8");
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }).map(normalizeRow);

  return analyzeRows(rows, options);
}

export async function writeAnalysis(outputPath, analysis) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(analysis, null, 2)}\n`);
}

export function analyzeRows(rows, options = {}) {
  const normalizedRows = rows.map(normalizeRow);
  const metrics = options.metrics || DEFAULT_METRICS;
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

function normalizeRow(row) {
  const normalized = { ...row };
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
  ];

  for (const field of numericFields) {
    normalized[field] = toNumber(row[field]);
  }

  normalized.false_positive_rate = normalized.violations_unique > 0
    ? round(normalized.false_positive_count / normalized.violations_unique)
    : 0;

  if (!Number.isFinite(normalized.duplicate_rate)) {
    normalized.duplicate_rate = normalized.violations_raw > 0
      ? round(normalized.duplicates_removed / normalized.violations_raw)
      : 0;
  }

  return normalized;
}

function valuesFor(rows, metric) {
  return rows
    .map((row) => row[metric])
    .filter((value) => Number.isFinite(value));
}

function summarizeValues(values) {
  return {
    n: values.length,
    mean: round(mean(values)),
    median: round(median(values)),
    sd: round(standardDeviation(values)),
    min: round(values.length ? Math.min(...values) : Number.NaN),
    max: round(values.length ? Math.max(...values) : Number.NaN)
  };
}

function mean(values) {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values
    .reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function cohensD(baselineValues, interventionValues) {
  if (baselineValues.length < 2 || interventionValues.length < 2) return Number.NaN;
  const baselineSd = standardDeviation(baselineValues);
  const interventionSd = standardDeviation(interventionValues);
  const pooledVariance = (
    ((baselineValues.length - 1) * (baselineSd ** 2)) +
    ((interventionValues.length - 1) * (interventionSd ** 2))
  ) / (baselineValues.length + interventionValues.length - 2);

  const pooledSd = Math.sqrt(pooledVariance);
  if (pooledSd === 0) return Number.NaN;

  return round((mean(interventionValues) - mean(baselineValues)) / pooledSd);
}

function percentChange(baselineMean, interventionMean) {
  if (!Number.isFinite(baselineMean) || baselineMean === 0) return Number.NaN;
  return round((interventionMean - baselineMean) / baselineMean);
}

function countBy(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return Number.NaN;
  return Number(value);
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = args.filePath || "data/pr-metrics-template.csv";
  const analysis = await analyzeMetricsFile(filePath);
  const output = JSON.stringify(analysis, null, 2);

  if (args.out) {
    await writeAnalysis(args.out, analysis);
    console.log(`Wrote ${args.out}`);
    return;
  }

  console.log(output);
}

function parseArgs(args) {
  const parsed = {
    filePath: undefined,
    out: undefined
  };

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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
