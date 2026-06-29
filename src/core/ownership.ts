import type { IssueOwnership } from "../types.js";

export interface FrameSnapshot {
  url: string;
}

const KNOWN_EMBED_PROVIDERS = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "spotify.com",
  "google.com",
  "google.co.uk",
  "maps.google.com",
  "codepen.io"
];

export function inferIssueOwnership(
  selector: string | undefined,
  pageUrl: string | undefined,
  frames: FrameSnapshot[]
): IssueOwnership | undefined {
  if (!isIframeDescendantSelector(selector)) return undefined;

  const thirdPartyFrames = collectThirdPartyFrames(pageUrl, frames);
  const frame = chooseLikelyFrame(selector || "", thirdPartyFrames);
  if (!frame) {
    return {
      kind: "unknown",
      label: "Embedded content",
      note: "The finding appears inside an iframe, but the embedded content source could not be identified."
    };
  }

  return {
    kind: "third-party-embed",
    label: "Third-party embedded content",
    source: frame.source,
    url: frame.url,
    note: isKnownEmbedProvider(frame.source)
      ? "Third-party embedded content. Manual verification recommended."
      : "The accessibility issue originates from embedded third-party content and may not be fixable by the website owner."
  };
}

export function collectThirdPartyFrames(
  pageUrl: string | undefined,
  frames: FrameSnapshot[]
): Array<{ source: string; url: string }> {
  const pageOrigin = safeOrigin(pageUrl);
  const seen = new Set<string>();
  const result: Array<{ source: string; url: string }> = [];

  for (const frame of frames) {
    const parsed = safeUrl(frame.url);
    if (!parsed || parsed.protocol === "about:" || parsed.protocol === "data:") continue;
    if (pageOrigin && parsed.origin === pageOrigin) continue;

    const source = normalizeHostname(parsed.hostname);
    const key = `${source}|${parsed.origin}`;
    if (!source || seen.has(key)) continue;
    seen.add(key);
    result.push({
      source,
      url: parsed.origin
    });
  }

  return result;
}

function isIframeDescendantSelector(selector: string | undefined): boolean {
  return Boolean(selector && /^iframe(?:[\s>#.:[]|$)/i.test(selector.trim()));
}

function chooseLikelyFrame(
  selector: string,
  frames: Array<{ source: string; url: string }>
): { source: string; url: string } | undefined {
  if (frames.length === 0) return undefined;

  const normalizedSelector = selector.toLowerCase();
  const providerHints = [
    { selector: "movie_player", source: "youtube.com" },
    { selector: "youtube", source: "youtube.com" },
    { selector: "vimeo", source: "vimeo.com" }
  ];
  const provider = providerHints.find((hint) => normalizedSelector.includes(hint.selector));
  if (provider) {
    const match = frames.find((frame) => frame.source === provider.source || frame.source.endsWith(`.${provider.source}`));
    if (match) return match;
  }

  return frames[0];
}

function safeOrigin(value: string | undefined): string | undefined {
  const parsed = safeUrl(value);
  return parsed?.origin;
}

function safeUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
}

function isKnownEmbedProvider(source: string): boolean {
  return KNOWN_EMBED_PROVIDERS.some((provider) => source === provider || source.endsWith(`.${provider}`));
}
