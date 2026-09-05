/**
 * AI Channel Analytics — three-signal request classification (PRD §4.7).
 *
 * Every captured server request is classified into exactly one signal:
 *   - training_crawl:  the engine is learning the site's content (GPTBot,
 *                       ClaudeBot, PerplexityBot, Bytespider, …)
 *   - citation_fetch:  a live user conversation caused the engine to fetch
 *                       the page (ChatGPT-User, Claude-User, Perplexity-User, …)
 *   - referral_visit:  a human clicked an AI citation and landed on the site
 *                       (AI-surface referrers: chatgpt.com, perplexity.ai, …)
 *
 * `classifyRequest` is a pure function over (userAgent, referer) — no I/O —
 * so it is unit-testable offline. IP verification (`verifyBotIp`) is a stub
 * for now; the interface is fixed so real rDNS/IP-list verification drops in
 * without touching callers.
 */

export type BotClass = "training_crawl" | "citation_fetch" | "referral_visit";

export interface BotSignature {
  /** Canonical bot name as stored in crawler_visits.botName. */
  botName: string;
  /** Case-insensitive UA match (substring-anchored regex). */
  uaPattern: RegExp;
  botClass: BotClass;
  /** Owning AI platform, for per-engine rollups. */
  engine: string;
}

/**
 * Known AI bot signatures. Order matters: more specific user-agent tokens
 * (e.g. "ChatGPT-User") precede any broader vendor tokens. "Claude-SearchBot"
 * and "Claude-User" are live-fetch agents; plain "ClaudeBot" is the trainer.
 */
export const BOT_SIGNATURES: BotSignature[] = [
  { botName: "GPTBot", uaPattern: /GPTBot/i, botClass: "training_crawl", engine: "openai" },
  { botName: "OAI-SearchBot", uaPattern: /OAI-SearchBot/i, botClass: "citation_fetch", engine: "openai" },
  { botName: "ChatGPT-User", uaPattern: /ChatGPT-User/i, botClass: "citation_fetch", engine: "openai" },
  { botName: "ClaudeBot", uaPattern: /ClaudeBot/i, botClass: "training_crawl", engine: "anthropic" },
  { botName: "Claude-User", uaPattern: /Claude-User/i, botClass: "citation_fetch", engine: "anthropic" },
  { botName: "Claude-SearchBot", uaPattern: /Claude-SearchBot/i, botClass: "citation_fetch", engine: "anthropic" },
  { botName: "PerplexityBot", uaPattern: /PerplexityBot/i, botClass: "training_crawl", engine: "perplexity" },
  { botName: "Perplexity-User", uaPattern: /Perplexity-User/i, botClass: "citation_fetch", engine: "perplexity" },
  { botName: "Google-Extended", uaPattern: /Google-Extended/i, botClass: "training_crawl", engine: "google" },
  { botName: "Applebot-Extended", uaPattern: /Applebot-Extended/i, botClass: "training_crawl", engine: "apple" },
  { botName: "Bytespider", uaPattern: /Bytespider/i, botClass: "training_crawl", engine: "bytedance" },
  { botName: "CCBot", uaPattern: /CCBot/i, botClass: "training_crawl", engine: "commoncrawl" },
  { botName: "meta-externalagent", uaPattern: /meta-externalagent/i, botClass: "training_crawl", engine: "meta" },
];

/**
 * AI-surface referrer hosts. A request carrying one of these as its referer
 * is a human referral visit regardless of the user agent (PRD §4.7 signal 3).
 * Matched on hostname suffix so subdomains (e.g. "www.perplexity.ai") count.
 */
export const AI_REFERRER_HOSTS = [
  "chat.openai.com",
  "chatgpt.com",
  "perplexity.ai",
  "claude.ai",
  "copilot.microsoft.com",
  "gemini.google.com",
  "you.com",
] as const;

export interface Classification {
  /** Canonical bot name for bot hits; null for referral visits / unknowns. */
  botName: string | null;
  /** Signal class; null when the request is not part of the AI channel. */
  botClass: BotClass | null;
  /** True when the request belongs to the AI channel (known bot or AI referer). */
  known: boolean;
  /** Owning AI platform for bot hits; null otherwise. */
  engine: string | null;
}

const UNKNOWN: Classification = { botName: null, botClass: null, known: false, engine: null };

/** True when `referer` points at a known AI surface (suffix host match). */
export function isAiReferer(referer: string | null | undefined): boolean {
  if (!referer) return false;
  let host: string;
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch {
    // Some log drains pass bare hosts/paths — fall back to substring match.
    const raw = referer.toLowerCase();
    return AI_REFERRER_HOSTS.some((h) => raw.includes(h));
  }
  return AI_REFERRER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Classify one captured request. Bot UA match wins over referrer: a
 * ChatGPT-User fetch carrying a chatgpt.com referer is still a citation
 * fetch (machine), not a human referral.
 */
export function classifyRequest(
  userAgent: string | null | undefined,
  referer: string | null | undefined,
): Classification {
  const ua = userAgent ?? "";
  if (ua) {
    for (const sig of BOT_SIGNATURES) {
      if (sig.uaPattern.test(ua)) {
        return { botName: sig.botName, botClass: sig.botClass, known: true, engine: sig.engine };
      }
    }
  }
  if (isAiReferer(referer)) {
    return { botName: null, botClass: "referral_visit", known: true, engine: null };
  }
  return UNKNOWN;
}

/**
 * Verify a bot-identified request against the vendor's published IP ranges
 * (e.g. OpenAI's gptbot.json) per PRD §4.7 — unverifiable (spoofed-UA)
 * requests are stored with verified=false and excluded from headline metrics.
 *
 * TODO(verification): implement rDNS + published-IP-list checks per vendor
 * (OpenAI https://openai.com/gptbot.json, Anthropic published ranges,
 * Perplexity published ranges). Returns false until then — conservative by
 * default: every ingested row stays out of verified headline metrics until
 * the check lands.
 */
export async function verifyBotIp(_ip: string, _botName: string): Promise<boolean> {
  return false;
}
