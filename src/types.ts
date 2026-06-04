export type Framework = "react" | "vue" | "angular" | "auto" | "unknown";

export type Severity = "critical" | "warning" | "info";

export type AxeImpact = "critical" | "serious" | "moderate" | "minor";

export type ReportFormat = "json" | "csv" | "markdown";

export type WcagVersion = "2.0" | "2.1" | "2.2";

export type WcagLevel = "A" | "AA" | "AAA";

export type PourPrinciple = "perceivable" | "operable" | "understandable" | "robust";

export interface WcagCriterion {
  id: string;
  title: string;
  level: WcagLevel;
  principle: PourPrinciple;
  url: string;
}

export interface StaticConfig {
  enabled: boolean;
  include: string[];
}

export interface DynamicConfig {
  enabled: boolean;
  urls: string[];
  browser: "chromium";
}

export interface MetricsConfig {
  enabled: boolean;
  csv: boolean;
  json: boolean;
}

export interface A11yConfig {
  cwd: string;
  configPath?: string;
  framework: Framework;
  wcagVersion: WcagVersion;
  wcagLevel: "AA";
  failOn: Severity | "none";
  outputDir: string;
  static: StaticConfig;
  dynamic: DynamicConfig;
  metrics: MetricsConfig;
}

export type ConfigOverrides = Partial<Omit<A11yConfig, "static" | "dynamic" | "metrics">> & {
  static?: Partial<StaticConfig>;
  dynamic?: Partial<DynamicConfig>;
  metrics?: Partial<MetricsConfig>;
};

export interface Issue {
  source?: string;
  framework?: Framework | string;
  ruleId?: string;
  wcag?: string[];
  wcagCriteria?: WcagCriterion[];
  severity?: Severity;
  impact?: AxeImpact | string;
  selector?: string;
  file?: string;
  line?: number;
  column?: number;
  url?: string;
  message?: string;
}

export interface NormalizedIssue extends Required<Pick<Issue, "source" | "framework" | "ruleId" | "message">> {
  wcag: string[];
  wcagCriteria: WcagCriterion[];
  severity?: Severity;
  impact?: string;
  selector?: string;
  file?: string;
  line?: number;
  column?: number;
  url?: string;
}

export interface TriagedIssue extends NormalizedIssue {
  severity: Severity;
}

export interface DedupedIssue extends TriagedIssue {
  fingerprint: string;
  duplicateCount: number;
  sources?: string[];
}

export interface ReportMetrics {
  framework?: Framework | string;
  cwd?: string;
  urls?: string[];
  scanDurationMs?: number;
  rawCount?: number;
  uniqueCount?: number;
  duplicateCount?: number;
}

export interface ReportSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  rawCount: number;
  uniqueCount: number;
  duplicateCount: number;
  duplicateRate: number;
  scanDurationMs: number;
  framework: Framework | string;
  urls: string[];
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
  byPour: Record<string, number>;
  byWcagLevel: Record<string, number>;
}

export interface A11yReport {
  generatedAt: string;
  summary: ReportSummary;
  issues: DedupedIssue[];
}
