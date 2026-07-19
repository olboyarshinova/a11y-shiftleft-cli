import type { Framework, Issue } from "../types.js";

export interface HumanVerificationSignal {
  provider: "cloudflare" | "recaptcha" | "hcaptcha" | "turnstile" | "generic";
  matched: string;
  message: string;
}

interface DetectablePage {
  evaluate: <T>(pageFunction: () => T) => Promise<T>;
}

export interface HumanVerificationWaitOptions {
  timeoutMs?: number;
  pollMs?: number;
}

const VISIBLE_SIGNALS: Array<{ provider: HumanVerificationSignal["provider"]; pattern: RegExp; label: string }> = [
  { provider: "cloudflare", pattern: /verify you are human|checking your browser/i, label: "Cloudflare human verification" },
  { provider: "recaptcha", pattern: /i'?m not a robot|recaptcha/i, label: "reCAPTCHA human verification" },
  { provider: "hcaptcha", pattern: /hcaptcha|h-captcha/i, label: "hCaptcha human verification" },
  { provider: "generic", pattern: /verify that you are human|verify you are human|are you a human|human verification|complete the security check|captcha/i, label: "Human verification" }
];

const MARKUP_SIGNALS: Array<{ provider: HumanVerificationSignal["provider"]; pattern: RegExp; label: string }> = [
  { provider: "cloudflare", pattern: /cf-challenge|cf-turnstile|challenge-platform|\/cdn-cgi\/challenge-platform/i, label: "Cloudflare human verification" },
  { provider: "turnstile", pattern: /class=["'][^"']*cf-turnstile|data-sitekey=["'][^"']+["'][^>]*turnstile|challenges\.cloudflare\.com\/turnstile/i, label: "Turnstile human verification" },
  { provider: "recaptcha", pattern: /class=["'][^"']*g-recaptcha|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha/i, label: "reCAPTCHA human verification" },
  { provider: "hcaptcha", pattern: /class=["'][^"']*h-captcha|hcaptcha\.com\/1\/api/i, label: "hCaptcha human verification" }
];

export async function detectHumanVerification(page: DetectablePage): Promise<HumanVerificationSignal | undefined> {
  try {
    const snapshot = await page.evaluate(() => {
      const visibleText = document.body?.innerText || "";
      const html = document.documentElement?.innerHTML || "";
      return {
        visibleText: visibleText.slice(0, 80_000),
        html: html.slice(0, 200_000)
      };
    });
    return detectHumanVerificationSnapshot(snapshot);
  } catch {
    return undefined;
  }
}

export async function waitForHumanVerificationToClear(
  page: DetectablePage,
  options: HumanVerificationWaitOptions = {}
): Promise<HumanVerificationSignal | undefined> {
  const timeoutMs = Math.max(0, options.timeoutMs ?? 120_000);
  const pollMs = Math.max(250, options.pollMs ?? 1_000);
  const deadline = Date.now() + timeoutMs;
  let latest = await detectHumanVerification(page);

  while (latest && Date.now() < deadline) {
    await delay(Math.min(pollMs, Math.max(0, deadline - Date.now())));
    latest = await detectHumanVerification(page);
  }

  return latest;
}

export function detectHumanVerificationText(value: string): HumanVerificationSignal | undefined {
  return detectHumanVerificationSnapshot({
    visibleText: stripNonVisibleText(value),
    html: value
  });
}

function detectHumanVerificationSnapshot(snapshot: {
  visibleText: string;
  html: string;
}): HumanVerificationSignal | undefined {
  for (const signal of VISIBLE_SIGNALS) {
    const match = snapshot.visibleText.match(signal.pattern);
    if (!match) continue;
    return {
      provider: signal.provider,
      matched: match[0],
      message: signal.label
    };
  }

  for (const signal of MARKUP_SIGNALS) {
    const match = snapshot.html.match(signal.pattern);
    if (!match) continue;
    return {
      provider: signal.provider,
      matched: match[0],
      message: signal.label
    };
  }

  return undefined;
}

function stripNonVisibleText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
