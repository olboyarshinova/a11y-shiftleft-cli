export type Framework = "react" | "vue" | "angular" | "auto" | "unknown";

export type Severity = "critical" | "warning" | "info";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ColorScheme = "light" | "dark";

export type FindingType = "wcag" | "best-practice" | "unmapped";

export type UserImpactLevel = "blocker" | "significant" | "workaround" | "minor";

export type IssueCategory =
  | "aria"
  | "contrast"
  | "focus"
  | "forms"
  | "headings"
  | "images"
  | "keyboard"
  | "landmarks"
  | "layout"
  | "media"
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

export interface IssueOwnership {
  kind: "first-party" | "third-party-embed" | "unknown";
  label: string;
  source?: string;
  url?: string;
  note?: string;
}

export interface UserImpactEvidence {
  level: UserImpactLevel;
  affectedUsers: string[];
  reason: string;
}

export interface JourneyImpactSummary {
  name: string;
  urls: string[];
  findingCount: number;
  critical: number;
  warning: number;
  info: number;
}

export interface SampleComparisonSummary {
  enabled: boolean;
  representativeSampleSize: number;
  randomSampleSize: number;
  structuredFindingCount: number;
  randomFindingCount: number;
  uniqueRandomRules: string[];
  recommendation: string;
}

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSpace: "viewport" | "document";
}

export interface KeyboardPageStateSnapshot {
  id: string;
  url: string;
  title: string;
  heading: string;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  openDialogs: number;
  expandedControls: number;
}

export type KeyboardActivationKey = "Enter" | "Space" | "Escape" | "ArrowLeft" | "ArrowRight" | "ArrowDown";

export interface KeyboardActivationAttempt {
  selector: string;
  role: string;
  key: KeyboardActivationKey;
  outcome: "changed" | "no-observable-change" | "skipped" | "target-missing" | "error";
  beforeStateId?: string;
  afterStateId?: string;
  focusAfter?: string;
  reason?: string;
}

export interface KeyboardFocusStep {
  index: number;
  direction: "forward" | "backward";
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
  pageState: KeyboardPageStateSnapshot;
}

export interface KeyboardAuditResult {
  url: string;
  generatedAt: string;
  durationMs: number;
  browser?: BrowserEvidence;
  maxTabs: number;
  focusableCount: number;
  completedCycle: boolean;
  steps: KeyboardFocusStep[];
  backwardSteps: KeyboardFocusStep[];
  reverseOrderMatches: boolean | null;
  activationEnabled?: boolean;
  maxActivations?: number;
  activationAttempts?: KeyboardActivationAttempt[];
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
  ownership?: IssueOwnership;
  userImpact?: UserImpactEvidence;
  journeys?: string[];
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
  ownership?: IssueOwnership;
  userImpact?: UserImpactEvidence;
  journeys?: string[];
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
  retestStatus?: "new" | "remaining";
  remediationTracking?: RemediationTrackingEntry;
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

export interface RetestComparisonSummary {
  enabled: boolean;
  file: string;
  previousIssues: number;
  currentIssues: number;
  remainingIssues: number;
  newIssues: number;
  fixedIssues: number;
  newCritical: number;
  newWarning: number;
  newInfo: number;
}

export type RemediationStatus = "open" | "in-progress" | "fixed" | "accepted-temporarily" | "manual-review";

export interface RemediationTrackingEntry {
  fingerprint: string;
  status: RemediationStatus;
  owner: string;
  reason: string;
  updatedAt: string;
  reviewBy?: string;
}

export interface RemediationTrackingFile {
  version: 1;
  items: RemediationTrackingEntry[];
}

export interface RemediationTrackingSummary {
  enabled: boolean;
  file: string;
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  matchedIssues: number;
  staleEntries: number;
  byStatus: Record<string, number>;
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

export interface PlannedScopeJourney {
  name: string;
  urls: string[];
  description?: string;
  notes?: string;
}

export interface PlannedScopeSamplePage {
  type: string;
  url: string;
  reason?: string;
}

export interface PlannedScopeThirdPartyContent {
  name: string;
  url?: string;
  owner?: string;
  reviewStrategy: string;
}

export interface PlannedScopeExclusion {
  area: string;
  reason: string;
  owner?: string;
  reviewBy?: string;
}

export interface PlannedEvaluationScope {
  version: 1;
  generatedAt: string;
  product: {
    name?: string;
    type: string;
    languages: string[];
  };
  target: {
    standard: ComplianceStandard;
    urls: string[];
  };
  supportedPlatforms: string[];
  assistiveTechnologies: string[];
  representativeSample: PlannedScopeSamplePage[];
  randomSample: PlannedScopeSamplePage[];
  criticalJourneys: PlannedScopeJourney[];
  thirdPartyContent: PlannedScopeThirdPartyContent[];
  exclusions: PlannedScopeExclusion[];
  notes: string[];
}

export interface ReportMetrics {
  framework?: Framework | string;
  cwd?: string;
  urls?: string[];
  commandName?: string;
  commandProfile?: string;
  browserEvidence?: BrowserEvidence[];
  standard?: ComplianceStandardMetadata;
  plannedScope?: PlannedEvaluationScope;
  lighthouse?: LighthouseAuditResult[];
  baseline?: BaselineComparisonSummary;
  retest?: RetestComparisonSummary;
  remediationTracking?: RemediationTrackingSummary;
  ignore?: IgnoreSummary;
  retention?: ReportRetentionEvidence;
  scanDurationMs?: number;
  rawCount?: number;
  uniqueCount?: number;
  duplicateCount?: number;
}

export interface ReportAuditTrail {
  version: 1;
  tool: {
    name: "a11y-shiftleft-cli";
    version: string;
    nodeVersion: string;
  };
  command: {
    name: string;
    profile: string;
  };
  requestedUrls: string[];
  includedUrls: string[];
  outputFormats: ReportFormat[];
  generatedFiles: string[];
  browsers?: BrowserEvidence[];
  automation: {
    staticAnalysis: boolean;
    browserAutomation: boolean;
    keyboardTraversal: boolean;
    lighthouseComparison: boolean;
    manualChecklist: boolean;
  };
  limits?: {
    maxDepth?: number;
    maxStates?: number;
    maxTabs?: number;
  };
  ci?: {
    provider: "github-actions" | "unknown-ci";
    runId?: string;
    runAttempt?: string;
    workflow?: string;
    job?: string;
    commitSha?: string;
    branch?: string;
  };
  boundaries: string[];
}

export interface BrowserEvidence {
  engine: "chromium" | "firefox" | "webkit" | string;
  name: string;
  version?: string;
  source: "exploration" | "dynamic" | "keyboard" | "lighthouse" | "pdf" | "unknown";
}

export interface LighthouseAuditItem {
  id: string;
  title: string;
  score: number | null;
  scoreDisplayMode?: string;
  description?: string;
  documentationUrl?: string;
}

export interface LighthouseAuditResult {
  url: string;
  requestedUrl?: string;
  finalUrl?: string;
  fetchTime?: string;
  userAgent?: string;
  accessibilityScore: number | null;
  failedAudits: LighthouseAuditItem[];
  manualAudits: LighthouseAuditItem[];
  notApplicableAudits: number;
  durationMs: number;
}

export interface LighthouseReportSummary {
  enabled: boolean;
  pageCount: number;
  averageAccessibilityScore: number | null;
  minAccessibilityScore: number | null;
  failedAuditCount: number;
  manualAuditCount: number;
  comparison?: LighthouseComparisonSummary;
  pages: Array<{
    url: string;
    score: number | null;
    failedAudits: number;
    manualAudits: number;
  }>;
}

export interface LighthouseComparisonRule {
  ruleId: string;
  count: number;
  sources: string[];
  highestSeverity: Severity;
  findingType: FindingType;
  category: IssueCategory;
}

export interface LighthouseComparisonSummary {
  matchingRuleIds: string[];
  lighthouseOnlyAudits: LighthouseAuditItem[];
  pipelineOnlyRules: LighthouseComparisonRule[];
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

export type ManualReviewStatus = "not-reviewed" | "pass" | "fail" | "not-applicable";

export interface ManualReviewEnvironment {
  operatingSystem: string;
  browser: string;
  assistiveTechnology: string;
  inputMethod: string;
  viewportOrZoom: string;
  colorMode: string;
}

export interface ManualReviewRecord {
  status: ManualReviewStatus;
  tester: string;
  testedAt: string;
  environment: string;
  environmentDetails?: ManualReviewEnvironment;
  notes: string;
  evidenceLinks: string[];
  remediationOwner: string;
}

export interface ManualReviewTarget {
  id: string;
  kind: "dialog" | "form" | "image" | "live-region" | "media" | "landmark" | "reflow";
  label: string;
  url: string;
  stateId: string;
  selector?: string;
  evidence: string;
}

export interface ManualChecklistEntry extends ManualCheckItem {
  targets?: ManualReviewTarget[];
  review: ManualReviewRecord;
}

export interface ManualChecklist {
  generatedAt: string;
  framework: Framework | string;
  urls: string[];
  items: ManualChecklistEntry[];
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
  auditTrail: ReportAuditTrail;
  standard?: ComplianceStandardMetadata;
  plannedScope?: PlannedEvaluationScope;
  journeyImpact?: JourneyImpactSummary[];
  sampleComparison?: SampleComparisonSummary;
  baseline?: BaselineComparisonSummary;
  retest?: RetestComparisonSummary;
  remediationTracking?: RemediationTrackingSummary;
  ignore?: IgnoreSummary;
  retention?: ReportRetentionEvidence;
  lighthouse?: LighthouseReportSummary;
  complianceEvidence: ComplianceEvidenceSummary;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
  byConfidence: Record<string, number>;
  byColorScheme?: Record<string, number>;
  byFindingType?: Record<string, number>;
  byCategory: Record<string, number>;
  byOwnership?: Record<string, number>;
  byUserImpact?: Record<string, number>;
  blockedByHumanVerification?: number;
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
  exploration?: ExplorationGraph;
  keyboard?: KeyboardAuditResult;
  manualChecklist?: ManualChecklist;
  lighthouse?: LighthouseAuditResult[];
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
  accessibilityTree?: AccessibilityTreeEvidence;
  reflow?: ReflowEvidence;
  forcedColors?: ForcedColorsEvidence;
  modalFocus?: ModalFocusEvidence;
  dynamicAnnouncements?: DynamicAnnouncementEvidence;
  formErrors?: FormErrorEvidence;
  imageAlternatives?: ImageAlternativeEvidence;
  media?: MediaEvidence;
  embeddedContent?: EmbeddedContentEvidence;
}

export interface AccessibilityTreeNodeEvidence {
  role: string;
  name?: string;
  level?: number;
}

export interface AccessibilityTreeEvidence {
  totalNodes: number;
  namedNodes: number;
  interactiveNodes: number;
  unnamedInteractiveNodes: number;
  landmarks: AccessibilityTreeNodeEvidence[];
  headings: AccessibilityTreeNodeEvidence[];
  interactiveSample: AccessibilityTreeNodeEvidence[];
}

export interface ReflowClippedElement {
  selector: string;
  text: string;
  horizontalOverflowPx: number;
  verticalOverflowPx: number;
}

export interface ReflowEvidence {
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  horizontalOverflowPx: number;
  clippedTextCount: number;
  clippedTextSample: ReflowClippedElement[];
}

export type ForcedColorsConcern =
  | "focus-indicator"
  | "background-image"
  | "hard-coded-svg-color"
  | "forced-color-adjust-none";

export interface ForcedColorsSample {
  selector: string;
  concern: ForcedColorsConcern;
  label?: string;
  detail: string;
}

export interface ForcedColorsEvidence {
  supported: boolean;
  controlsChecked: number;
  focusRiskCount: number;
  backgroundImageRiskCount: number;
  svgColorRiskCount: number;
  forcedColorAdjustNoneCount: number;
  samples: ForcedColorsSample[];
  error?: string;
}

export interface ModalFocusEvidence {
  dialogCount: number;
  dialogSelector: string;
  isModal?: boolean;
  accessibleName?: string;
  hasAccessibleName: boolean;
  initialFocusSelector?: string;
  initialFocusInside: boolean;
  triggerSelector?: string;
  escapeTested: boolean;
  escapeClosed?: boolean;
  focusReturnedToTrigger?: boolean;
  containmentTested?: boolean;
  containmentSteps?: number;
  forwardFocusContained?: boolean;
  backwardFocusContained?: boolean;
  escapedFocusSelector?: string;
}

export interface DynamicAnnouncementUpdate {
  selector: string;
  role?: string;
  politeness: "assertive" | "polite" | "off" | "implicit";
  text: string;
}

export interface DynamicAnnouncementEvidence {
  actionLabel: string;
  regionsBefore: number;
  regionsAfter: number;
  updatesObserved: number;
  meaningfulUpdates: number;
  updates: DynamicAnnouncementUpdate[];
}

export interface FormErrorFieldEvidence {
  selector: string;
  accessibleName?: string;
  errorReferenceIds: string[];
  associatedErrorText?: string;
  focused: boolean;
}

export interface FormErrorEvidence {
  formCount: number;
  fieldCount: number;
  invalidFieldCount: number;
  associatedErrorCount: number;
  unassociatedInvalidCount: number;
  errorSummaryCount: number;
  invalidFields: FormErrorFieldEvidence[];
}

export type ImageAlternativeConcern =
  | "filename"
  | "generic"
  | "nearby-text-duplicate"
  | "repeated"
  | "excessive-length";

export interface ImageAlternativeSample {
  selector: string;
  alt: string;
  concerns: ImageAlternativeConcern[];
  repeatedCount?: number;
}

export interface ImageAlternativeEvidence {
  imageCount: number;
  decorativeCount: number;
  informativeCount: number;
  suspiciousCount: number;
  repeatedAlternativeGroups: number;
  samples: ImageAlternativeSample[];
}

export interface MediaElementEvidence {
  selector: string;
  kind: "audio" | "video";
  autoplay: boolean;
  muted: boolean;
  controls: boolean;
  captionTrackCount: number;
  transcriptCandidate: boolean;
}

export interface MediaEvidence {
  audioCount: number;
  videoCount: number;
  videosWithCaptions: number;
  audioWithTranscriptCandidate: number;
  autoplayRiskCount: number;
  activeAnimationCount: number;
  reducedMotionQueryDetected: boolean;
  unreadableStylesheetCount: number;
  elements: MediaElementEvidence[];
}

export interface IframeEvidence {
  selector: string;
  url: string;
  sameOrigin: boolean;
  title?: string;
  browserAccessible: boolean;
}

export interface CanvasEvidence {
  selector: string;
  width: number;
  height: number;
  decorative: boolean;
  hasAccessibleAlternative: boolean;
}

export interface EmbeddedContentEvidence {
  iframeCount: number;
  sameOriginIframeCount: number;
  crossOriginIframeCount: number;
  inaccessibleIframeCount: number;
  canvasCount: number;
  canvasWithAlternativeCount: number;
  canvasWithoutAlternativeCount: number;
  iframes: IframeEvidence[];
  canvases: CanvasEvidence[];
}

export interface ExplorationScreenshotEvidence {
  path: string;
  kind: "full-page" | "viewport" | "evidence-crop";
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
    pagesVisited?: number;
    uiStatesVisited?: number;
    actionsTried: number;
    skippedActions: number;
    screenshots: number;
    duplicateScreenshots?: number;
    maxDepth: number;
    maxStates: number;
    browser?: BrowserEvidence;
  };
}
