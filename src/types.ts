export type Framework = "react" | "vue" | "angular" | "auto" | "unknown";

export type Severity = "critical" | "warning" | "info";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ColorScheme = "light" | "dark";

export type FindingType = "wcag" | "best-practice" | "unmapped";

export type IssueCategory =
  | "aria"
  | "contrast"
  | "focus"
  | "forms"
  | "headings"
  | "images"
  | "keyboard"
  | "landmarks"
  | "structure"
  | "widgets"
  | "best-practice"
  | "adapter"
  | "other";

export type AxeImpact = "critical" | "serious" | "moderate" | "minor";

export type ReportFormat = "json" | "csv" | "markdown";

export type WcagVersion = "2.0" | "2.1" | "2.2";

export type WcagLevel = "A" | "AA" | "AAA";

export type PourPrinciple = "perceivable" | "operable" | "understandable" | "robust";

export type ComplianceStandard = "wcag22-aa" | "ada-title-ii" | "section508";

export interface ComplianceStandardMetadata {
  id: ComplianceStandard;
  label: string;
  wcagVersion: WcagVersion;
  wcagLevel: "AA";
  automatedCoverage: "partial";
  requiresManualReview: boolean;
  disclaimer: string;
}

export interface ComplianceEvidenceSummary {
  standardId?: ComplianceStandard;
  wcagVersion?: WcagVersion;
  wcagLevel?: "AA";
  automatedCoverage: "partial";
  requiresManualReview: boolean;
  totalFindings: number;
  wcagMappedFindings: number;
  bestPracticeFindings?: number;
  unmappedFindings: number;
  affectedPages: number;
  topAffectedPages: PageSummary[];
}

export interface WcagCriterion {
  id: string;
  title: string;
  level: WcagLevel;
  principle: PourPrinciple;
  introducedIn: WcagVersion;
  url: string;
}

export interface RemediationHint {
  summary: string;
  howToFix: string[];
  docs: string[];
  frameworkExamples?: Partial<Record<Exclude<Framework, "auto" | "unknown">, string>>;
}

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSpace: "viewport" | "document";
}

export interface KeyboardFocusStep {
  index: number;
  selector: string;
  tagName: string;
  role: string;
  accessibleName: string;
  tabIndex: number;
  visible: boolean;
  focusVisible: boolean;
  indicatorVisible: boolean;
  obscured: boolean;
  bounds?: ElementBounds;
}

export interface KeyboardAuditResult {
  url: string;
  generatedAt: string;
  durationMs: number;
  maxTabs: number;
  focusableCount: number;
  completedCycle: boolean;
  steps: KeyboardFocusStep[];
  issues: Issue[];
}

export interface ContrastSuggestion {
  target: "foreground" | "background";
  purpose: "minimum" | "recommended" | "enhanced";
  color: string;
  contrastRatio: number;
}

export interface ContrastEvidence {
  actualRatio: number;
  requiredRatio: number;
  foreground: string;
  background: string;
  fontSize?: string;
  fontWeight?: string;
  suggestions: ContrastSuggestion[];
}

export interface StaticConfig {
  enabled: boolean;
  include: string[];
}

export interface DynamicConfig {
  enabled: boolean;
  urls: string[];
  browser: "chromium";
  crawl: boolean;
  crawlDepth: number;
  crawlLimit: number;
  scroll: PageScrollConfig;
}

export interface MetricsConfig {
  enabled: boolean;
  csv: boolean;
  json: boolean;
}

export interface ExploreSafeModeConfig {
  enabled: boolean;
  blockedText: string[];
  blockedRoles: string[];
  blockedUrls: string[];
  blockedSelectors: string[];
  allowedSelectors: string[];
  dismissDialogs: boolean;
  isolateCookies: boolean;
}

export interface ExploreConfig {
  safeMode: ExploreSafeModeConfig;
  waitMs: number;
  waitForSelector?: string;
  scroll: PageScrollConfig;
}

export interface PageScrollConfig {
  enabled: boolean;
  stepPx: number;
  maxSteps: number;
  waitMs: number;
}

export interface RetentionConfig {
  enabled: boolean;
  maxRuns: number;
  maxAgeDays: number;
  dryRun: boolean;
}

export interface A11yConfig {
  cwd: string;
  configPath?: string;
  framework: Framework;
  standard: ComplianceStandard;
  wcagVersion: WcagVersion;
  wcagLevel: "AA";
  failOn: Severity | "none";
  outputDir: string;
  static: StaticConfig;
  dynamic: DynamicConfig;
  metrics: MetricsConfig;
  explore: ExploreConfig;
  retention: RetentionConfig;
}

export type ConfigOverrides = Partial<Omit<A11yConfig, "static" | "dynamic" | "metrics" | "explore" | "retention">> & {
  static?: Partial<StaticConfig>;
  dynamic?: Partial<Omit<DynamicConfig, "scroll">> & {
    scroll?: Partial<PageScrollConfig>;
  };
  metrics?: Partial<MetricsConfig>;
  explore?: Partial<Omit<ExploreConfig, "safeMode" | "scroll">> & {
    safeMode?: Partial<ExploreSafeModeConfig>;
    scroll?: Partial<PageScrollConfig>;
  };
  retention?: Partial<RetentionConfig>;
};

export interface Issue {
  source?: string;
  framework?: Framework | string;
  ruleId?: string;
  wcag?: string[];
  wcagCriteria?: WcagCriterion[];
  tags?: string[];
  severity?: Severity;
  confidence?: ConfidenceLevel;
  confidenceScore?: number;
  confidenceReason?: string;
  findingType?: FindingType;
  category?: IssueCategory;
  impact?: AxeImpact | string;
  selector?: string;
  file?: string;
  line?: number;
  column?: number;
  url?: string;
  stateId?: string;
  stateLabel?: string;
  screenshot?: string;
  elementBounds?: ElementBounds;
  contrast?: ContrastEvidence;
  helpUrl?: string;
  colorScheme?: ColorScheme;
  message?: string;
  remediation?: RemediationHint;
}

export interface NormalizedIssue extends Required<Pick<Issue, "source" | "framework" | "ruleId" | "message">> {
  wcag: string[];
  wcagCriteria: WcagCriterion[];
  tags: string[];
  confidence?: ConfidenceLevel;
  confidenceScore?: number;
  confidenceReason?: string;
  findingType?: FindingType;
  category?: IssueCategory;
  remediation?: RemediationHint;
  severity?: Severity;
  impact?: string;
  selector?: string;
  file?: string;
  line?: number;
  column?: number;
  url?: string;
  stateId?: string;
  stateLabel?: string;
  screenshot?: string;
  elementBounds?: ElementBounds;
  contrast?: ContrastEvidence;
  helpUrl?: string;
  colorScheme?: ColorScheme;
}

export interface TriagedIssue extends NormalizedIssue {
  severity: Severity;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  confidenceReason: string;
  findingType: FindingType;
  category: IssueCategory;
}

export interface DedupedIssue extends TriagedIssue {
  fingerprint: string;
  duplicateCount: number;
  sources?: string[];
  baselineStatus?: "new" | "existing";
}

export interface IgnoreEntry {
  id?: string;
  fingerprint?: string | string[];
  ruleId?: string | string[];
  source?: string | string[];
  severity?: Severity | Severity[];
  selector?: string | string[];
  file?: string | string[];
  url?: string | string[];
  target?: string | string[];
  wcag?: string | string[];
  reason: string;
  owner: string;
  expires: string;
}

export interface IgnoreFile {
  version: 1;
  ignores: IgnoreEntry[];
}

export interface IgnoreSummary {
  enabled: boolean;
  file: string;
  totalRules: number;
  activeRules: number;
  expiredRules: number;
  invalidRules: number;
  ignoredIssues: number;
}

export interface BaselineEntry {
  fingerprint: string;
  ruleId: string;
  severity: Severity;
  source: string;
  target: string;
  wcag: string[];
}

export interface BaselineFile {
  version: 1;
  generatedAt: string;
  issues: BaselineEntry[];
}

export interface BaselineComparisonSummary {
  enabled: boolean;
  file: string;
  updated: boolean;
  baselineIssues: number;
  currentIssues: number;
  existingIssues: number;
  newIssues: number;
  resolvedIssues: number;
  newCritical: number;
  newWarning: number;
  newInfo: number;
}

export interface ReportRetentionEvidence {
  enabled: boolean;
  dryRun: boolean;
  maxRuns: number;
  maxAgeDays: number;
  candidateRuns: number;
  plannedDeletedRuns: number;
  deletedRuns: number;
  keptRuns: number;
}

export interface ReportMetrics {
  framework?: Framework | string;
  cwd?: string;
  urls?: string[];
  standard?: ComplianceStandardMetadata;
  baseline?: BaselineComparisonSummary;
  ignore?: IgnoreSummary;
  retention?: ReportRetentionEvidence;
  scanDurationMs?: number;
  rawCount?: number;
  uniqueCount?: number;
  duplicateCount?: number;
}

export interface ManualCheckItem {
  id: string;
  title: string;
  principle: PourPrinciple;
  wcag: string[];
  whyManual: string;
  steps: string[];
  evidence: string[];
}

export interface ManualChecklist {
  generatedAt: string;
  framework: Framework | string;
  urls: string[];
  items: ManualCheckItem[];
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
  standard?: ComplianceStandardMetadata;
  baseline?: BaselineComparisonSummary;
  ignore?: IgnoreSummary;
  retention?: ReportRetentionEvidence;
  complianceEvidence: ComplianceEvidenceSummary;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
  byConfidence: Record<string, number>;
  byColorScheme?: Record<string, number>;
  byFindingType?: Record<string, number>;
  byCategory: Record<string, number>;
  byPour: Record<string, number>;
  byWcagLevel: Record<string, number>;
  byWcagVersion: Record<string, number>;
  byUnmappedRule: Record<string, number>;
  byPage: PageSummary[];
  rootCauseCount?: number;
  rootCauseGroups?: RootCauseGroup[];
}

export interface A11yReport {
  generatedAt: string;
  summary: ReportSummary;
  issues: DedupedIssue[];
}

export interface PageSummary {
  url: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  severityScore: number;
}

export interface RootCauseGroup {
  id: string;
  ruleId: string;
  findingType: FindingType;
  severity: Severity;
  targetPattern: string;
  occurrenceCount: number;
  affectedPages: string[];
  affectedStates: string[];
  affectedColorSchemes?: ColorScheme[];
  representativeSelector?: string;
  representativeFile?: string;
}

export type ExploreActionType = "click" | "navigate";

export interface ExploreAction {
  id: string;
  type: ExploreActionType;
  selector?: string;
  url?: string;
  label: string;
  text?: string;
  role?: string;
}

export interface ExploreSkippedAction {
  stateId: string;
  type: ExploreActionType | "unknown";
  selector?: string;
  url?: string;
  label: string;
  text?: string;
  role?: string;
  reason: string;
}

export interface ExplorationState {
  id: string;
  url: string;
  title?: string;
  depth: number;
  fingerprint: string;
  actionLabel: string;
  colorScheme?: ColorScheme;
  screenshot?: string;
  screenshotEvidence?: ExplorationScreenshotEvidence[];
  screenshotFullPage?: boolean;
  visualDuplicateOf?: string;
  issueCount: number;
  actionCount: number;
}

export interface ExplorationScreenshotEvidence {
  path: string;
  kind: "full-page" | "viewport" | "error-crop";
  issueCount: number;
  width?: number;
  height?: number;
}

export interface ExplorationEdge {
  from: string;
  to: string;
  action: ExploreAction;
}

export interface ExplorationGraph {
  generatedAt: string;
  startUrl: string;
  states: ExplorationState[];
  edges: ExplorationEdge[];
  skippedActions: ExploreSkippedAction[];
  summary: {
    statesVisited: number;
    uiStatesVisited?: number;
    actionsTried: number;
    skippedActions: number;
    screenshots: number;
    duplicateScreenshots?: number;
    maxDepth: number;
    maxStates: number;
  };
}
