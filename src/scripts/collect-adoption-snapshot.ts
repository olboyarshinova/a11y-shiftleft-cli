import {
  collectAdoptionMetrics,
  writeAdoptionMetrics,
  type AdoptionDeps,
  type AdoptionMetrics
} from "./collect-adoption-metrics.js";

const DEFAULT_REPO = "olboyarshinova/a11y-shiftleft-cli";
const DEFAULT_PERIOD = "last-month";
const DEFAULT_PACKAGES = [
  "a11y-shiftleft-cli",
  "@a11y-shiftleft/react",
  "@a11y-shiftleft/vue",
  "@a11y-shiftleft/angular"
];

export type AdoptionSnapshotOptions = {
  packages?: string[];
  repo?: string;
  period?: string;
  out?: string;
  githubToken?: string;
};

export type AdoptionSnapshot = {
  generatedAt: string;
  repository: string;
  period: string;
  packages: AdoptionMetrics[];
  summary: {
    packageCount: number;
    npmApiDownloadsTotal: number;
    byPackage: Record<string, {
      npmApiDownloads: number;
      latestVersion?: string;
      versions: number;
    }>;
  };
  interpretation: {
    source: string;
    evidenceUse: string;
  };
};

export function parseSnapshotArgs(argv: string[] = process.argv.slice(2)): AdoptionSnapshotOptions {
  const options: AdoptionSnapshotOptions = {
    packages: [...DEFAULT_PACKAGES],
    repo: DEFAULT_REPO,
    period: DEFAULT_PERIOD
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--package" && next) {
      options.packages = appendPackages(options.packages, next);
      index += 1;
      continue;
    }

    if (arg === "--repo" && next) {
      options.repo = next;
      index += 1;
      continue;
    }

    if (arg === "--period" && next) {
      options.period = next;
      index += 1;
      continue;
    }

    if (arg === "--out" && next) {
      options.out = next;
      index += 1;
      continue;
    }
  }

  return options;
}

export async function collectAdoptionSnapshot(
  options: AdoptionSnapshotOptions = {},
  deps: AdoptionDeps = {}
): Promise<AdoptionSnapshot> {
  const now = deps.now ?? (() => new Date());
  const generatedAt = now().toISOString();
  const packages = normalizePackages(options.packages);
  const repo = options.repo ?? DEFAULT_REPO;
  const period = options.period ?? DEFAULT_PERIOD;

  const packageMetrics = await Promise.all(packages.map((packageName) => collectAdoptionMetrics({
    packageName,
    repo,
    period,
    githubToken: options.githubToken
  }, {
    ...deps,
    now: () => new Date(generatedAt)
  })));

  return {
    generatedAt,
    repository: repo,
    period,
    packages: packageMetrics,
    summary: summarizePackages(packageMetrics),
    interpretation: {
      source:
        "Automated snapshot collected from the public npm downloads API and npm registry metadata.",
      evidenceUse:
        "Use as periodic adoption telemetry. npm API downloads can include humans, CI systems, package mirrors, security scanners, and bots."
    }
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseSnapshotArgs(argv);
  const snapshot = await collectAdoptionSnapshot(options);

  if (options.out) {
    await writeAdoptionMetrics(options.out, snapshot);
    console.log(`Wrote ${options.out}`);
    return;
  }

  console.log(JSON.stringify(snapshot, null, 2));
}

function appendPackages(current: string[] | undefined, value: string): string[] {
  const parsed = splitPackages(value);
  const base = current && current.length > 0 && !samePackages(current, DEFAULT_PACKAGES)
    ? current
    : [];

  return normalizePackages([...base, ...parsed]);
}

function normalizePackages(packages: string[] | undefined): string[] {
  const parsed = packages?.flatMap(splitPackages) ?? DEFAULT_PACKAGES;
  return [...new Set(parsed.map((packageName) => packageName.trim()).filter(Boolean))];
}

function splitPackages(value: string): string[] {
  return value.split(",").map((packageName) => packageName.trim()).filter(Boolean);
}

function samePackages(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function summarizePackages(packages: AdoptionMetrics[]): AdoptionSnapshot["summary"] {
  return {
    packageCount: packages.length,
    npmApiDownloadsTotal: packages.reduce((sum, metrics) => sum + metrics.npm.downloads.total, 0),
    byPackage: Object.fromEntries(packages.map((metrics) => [
      metrics.package,
      {
        npmApiDownloads: metrics.npm.downloads.total,
        latestVersion: metrics.registry.latestVersion,
        versions: metrics.registry.versions
      }
    ]))
  };
}
