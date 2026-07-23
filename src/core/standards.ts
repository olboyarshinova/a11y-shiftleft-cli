import type { ComplianceStandard, ComplianceStandardMetadata } from "../types.js";

const DISCLAIMER = "This report supports accessibility risk detection and remediation tracking. It does not certify legal compliance with ADA, Section 508, EN 301 549, EAA, or WCAG. Manual review, keyboard testing, screen reader testing, and organizational compliance review are required.";

const WEB_REVIEW_GAPS = [
  "Manual screen reader and keyboard task completion evidence",
  "Content clarity, plain language, and task usability review",
  "Media transcript, caption quality, audio description, and flashing review"
];

const EN_301_549_GAPS = [
  ...WEB_REVIEW_GAPS,
  "PDF, office document, and non-HTML document accessibility evidence",
  "Software outside the browser, native app, and platform accessibility evidence",
  "Hardware, kiosk, or physical ICT accessibility evidence",
  "Support service, help desk, procurement, and product documentation evidence"
];

const STANDARDS: Record<ComplianceStandard, ComplianceStandardMetadata> = {
  "wcag22-aa": {
    id: "wcag22-aa",
    label: "WCAG 2.2 Level AA support mode",
    wcagVersion: "2.2",
    wcagLevel: "AA",
    automatedCoverage: "partial",
    requiresManualReview: true,
    evidenceGaps: WEB_REVIEW_GAPS,
    disclaimer: DISCLAIMER
  },
  "ada-title-ii": {
    id: "ada-title-ii",
    label: "ADA Title II web accessibility support mode",
    wcagVersion: "2.1",
    wcagLevel: "AA",
    automatedCoverage: "partial",
    requiresManualReview: true,
    evidenceGaps: WEB_REVIEW_GAPS,
    disclaimer: DISCLAIMER
  },
  section508: {
    id: "section508",
    label: "Section 508 web accessibility support mode",
    wcagVersion: "2.0",
    wcagLevel: "AA",
    automatedCoverage: "partial",
    requiresManualReview: true,
    evidenceGaps: [
      ...WEB_REVIEW_GAPS,
      "Agency policy, exception, procurement, and VPAT/ACR evidence outside this scan"
    ],
    disclaimer: DISCLAIMER
  },
  en301549: {
    id: "en301549",
    label: "EN 301 549 web support mode",
    wcagVersion: "2.1",
    wcagLevel: "AA",
    automatedCoverage: "partial",
    requiresManualReview: true,
    evidenceGaps: EN_301_549_GAPS,
    disclaimer: DISCLAIMER
  }
};

export function resolveStandard(standard: ComplianceStandard = "wcag22-aa"): ComplianceStandardMetadata {
  return STANDARDS[standard] || STANDARDS["wcag22-aa"];
}
