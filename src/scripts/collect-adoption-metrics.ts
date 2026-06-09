import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PACKAGE = "a11y-shiftleft-cli";
const DEFAULT_REPO = "olboyarshinova/a11y-shiftleft-cli";
const DEFAULT_PERIOD = "last-month";

type FetchResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<FetchResponseLike>;

export type AdoptionOptions = {
  packageName?: string;
  repo?: string;
  period?: string;
  out?: string;
  githubToken?: string;
  npmWebsiteDownloads?: number;
  npmWebsiteCapturedAt?: string;
};

export type AdoptionDeps = {
  fetchImpl?: FetchLike;
  now?: () => Date;
};

type NpmDownloadDay = {
  day: string;
  downloads: number;
};

type NpmDownloadsResponse = {
  downloads?: NpmDownloadDay[];
};

type RegistryMetadataResponse = {
  "dist-tags"?: {
    latest?: string;
  };
  time?: {
    created?: string;
    modified?: string;
  };
  versions?: Record<string, { license?: string }>;
};

type GitHubUnavailable = {
  available: false;
  reason: string;
};

type GitHubAvailable = {
  available: true;
  views: unknown;
  clones: unknown;
  referrers: unknown;
};

export type AdoptionMetrics = {
  generatedAt: string;
  package: string;
  repository: string;
  period: string;
  npm: {
    downloads: {
      total: number;
      days: NpmDownloadDay[];
    };
    websiteDownloads?: {
      total: number;
      capturedAt?: string;
      source: string;
      note: string;
    };
  };
  github: GitHubUnavailable | GitHubAvailable;
  registry: {
    latestVersion?: string;
    modifiedAt?: string;
    createdAt?: string;
    versions: number;
    license?: string;
  };
  interpretation: {
    botSeparation: string;
    geography: string;
    evidenceUse: string;
  };
};

export function parseArgs(argv: string[] = process.argv.slice(2)): AdoptionOptions {
  const options: AdoptionOptions = {
    packageName: DEFAULT_PACKAGE,
    repo: DEFAULT_REPO,
    period: DEFAULT_PERIOD
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--package" && next) {
      options.packageName = next;
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

    if (arg === "--npm-website-downloads" && next) {
      options.npmWebsiteDownloads = Number(next);
      index += 1;
      continue;
    }

    if (arg === "--npm-website-captured-at" && next) {
      options.npmWebsiteCapturedAt = next;
      index += 1;
      continue;
    }
  }

  return options;
}

export async function collectAdoptionMetrics(
  options: AdoptionOptions = {},
  deps: AdoptionDeps = {}
): Promise<AdoptionMetrics> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const packageName = options.packageName ?? DEFAULT_PACKAGE;
  const repo = options.repo ?? DEFAULT_REPO;
  const period = options.period ?? DEFAULT_PERIOD;
  const githubToken = options.githubToken ?? process.env.GITHUB_TOKEN;

  const [downloads, registry, github] = await Promise.all([
    fetchNpmDownloads(fetchImpl, packageName, period),
    fetchNpmRegistryMetadata(fetchImpl, packageName),
    fetchGitHubTraffic(fetchImpl, repo, githubToken)
  ]);

  return {
    generatedAt: now().toISOString(),
    package: packageName,
    repository: repo,
    period,
    npm: {
      downloads,
      ...websiteDownloadsSnapshot(options)
    },
    github,
    registry,
    interpretation: {
      botSeparation:
        "npm download counts include humans, CI systems, package mirrors, security scanners, and bots. Treat GitHub unique views/clones and referrers as stronger human-adoption signals.",
      geography:
        "The public npm downloads API does not expose country-level download data. Use privacy-preserving website analytics for docs/landing-page geography if geographic evidence is needed.",
      evidenceUse:
        "Use this report as adoption telemetry, not as proof of WCAG conformance or individual human usage."
    }
  };
}

function websiteDownloadsSnapshot(options: AdoptionOptions): Pick<AdoptionMetrics["npm"], "websiteDownloads"> {
  if (!Number.isFinite(options.npmWebsiteDownloads)) return {};

  return {
    websiteDownloads: {
      total: Number(options.npmWebsiteDownloads),
      capturedAt: options.npmWebsiteCapturedAt,
      source: "npm package page",
      note:
        "Manual website snapshot for all visible versions. npm website counts can differ from the public downloads API because sources use different windows, caching, and aggregation."
    }
  };
}

export async function writeAdoptionMetrics(
  outputPath: string,
  metrics: unknown
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(metrics, null, 2)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const metrics = await collectAdoptionMetrics(options);

  if (options.out) {
    await writeAdoptionMetrics(options.out, metrics);
    console.log(`Wrote ${options.out}`);
    return;
  }

  console.log(JSON.stringify(metrics, null, 2));
}

async function fetchNpmDownloads(
  fetchImpl: FetchLike,
  packageName: string,
  period: string
): Promise<AdoptionMetrics["npm"]["downloads"]> {
  const url = `https://api.npmjs.org/downloads/range/${period}/${encodeURIComponent(packageName)}`;
  const data = await fetchJson<NpmDownloadsResponse>(fetchImpl, url);
  const days = data.downloads ?? [];

  return {
    total: days.reduce((sum, day) => sum + Number(day.downloads || 0), 0),
    days
  };
}

async function fetchNpmRegistryMetadata(
  fetchImpl: FetchLike,
  packageName: string
): Promise<AdoptionMetrics["registry"]> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const data = await fetchJson<RegistryMetadataResponse>(fetchImpl, url);
  const latest = data["dist-tags"]?.latest;

  return {
    latestVersion: latest,
    modifiedAt: data.time?.modified,
    createdAt: data.time?.created,
    versions: data.versions ? Object.keys(data.versions).length : 0,
    license: latest ? data.versions?.[latest]?.license : undefined
  };
}

async function fetchGitHubTraffic(
  fetchImpl: FetchLike,
  repo: string,
  githubToken?: string
): Promise<AdoptionMetrics["github"]> {
  if (!githubToken) {
    return {
      available: false,
      reason: "Set GITHUB_TOKEN to collect GitHub traffic metrics for views, clones, and referrers."
    };
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubToken}`
  };

  const [views, clones, referrers] = await Promise.all([
    fetchJson(fetchImpl, `https://api.github.com/repos/${repo}/traffic/views`, headers),
    fetchJson(fetchImpl, `https://api.github.com/repos/${repo}/traffic/clones`, headers),
    fetchJson(fetchImpl, `https://api.github.com/repos/${repo}/traffic/popular/referrers`, headers)
  ]);

  return {
    available: true,
    views,
    clones,
    referrers
  };
}

async function fetchJson<T>(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string> = {}
): Promise<T> {
  const response = await fetchImpl(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return await response.json() as T;
}
