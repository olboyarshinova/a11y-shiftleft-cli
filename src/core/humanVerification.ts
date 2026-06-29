import type { Framework, Issue } from "../types.js";

export interface HumanVerificationSignal {
  provider: "cloudflare" | "recaptcha" | "hcaptcha" | "turnstile" | "generic";
  matched: string;
  message: string;
}

interface DetectablePage {
  evaluate: <T>(pageFunction: () => T) => Promise<T>;
}

const SIGNALS: Array<{ provider: HumanVerificationSignal["provider"]; pattern: RegExp; label: string }> = [
  { provider: "cloudflare", pattern: /verify you are human|checking your browser|cf-challenge|cf-turnstile/i, label: "Cloudflare human verification" },
  { provider: "turnstile", pattern: /turnstile|cf-turnstile/i, label: "Turnstile human verification" },
  { provider: "recaptcha", pattern: /g-recaptcha|recaptcha|i'?m not a robot/i, label: "reCAPTCHA human verification" },
  { provider: "hcaptcha", pattern: /hcaptcha|h-captcha/i, label: "hCaptcha human verification" },
  { provider: "generic", pattern: /verify that you are human|verify you are human|are you a human|human verification|complete the security check|captcha/i, label: "Human verification" }
];

export async function detectHumanVerification(page: DetectablePage): Promise<HumanVerificationSignal | undefined> {
  try {
    const snapshot = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      const html = document.documentElement?.innerHTML || "";
      return `${text}\n${html}`.slice(0, 200_000);
    });
    return detectHumanVerificationText(snapshot);
  } catch {
    return undefined;
  }
}

export function detectHumanVerificationText(value: string): HumanVerificationSignal | undefined {
  for (const signal of SIGNALS) {
    const match = value.match(signal.pattern);
    if (!match) continue;
    return {
      provider: signal.provider,
      matched: match[0],
      message: signal.label
    };
  }

  return undefined;
}

export function createHumanVerificationIssue(options: {
  source: string;
  framework: Framework | string;
  url: string;
  signal: HumanVerificationSignal;
  stateId?: string;
  stateLabel?: string;
}): Issue {
  return {
    source: options.source,
    framework: options.framework,
    ruleId: "adapter/human-verification",
    severity: "warning",
    findingType: "unmapped",
    category: "adapter",
    confidence: "high",
    confidenceScore: 95,
    confidenceReason: "The rendered page contains common bot-protection or CAPTCHA text/markup that blocks automated accessibility scanning.",
    url: options.url,
    stateId: options.stateId,
    stateLabel: options.stateLabel,
    message: `${options.signal.message} blocked automated scanning for ${options.url}. Use a staging or preview URL that allows trusted automation, allowlist the CI/browser environment, or complete this page through a manual accessibility review.`
  };
}
