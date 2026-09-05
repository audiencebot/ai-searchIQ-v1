/**
 * Offline smoke test for AI Channel classification (PRD §4.7) — pure-function
 * fixture assertions, no DB or network.
 * Run: npx tsx scripts/smoke-crawler-classification.ts
 */
import {
  classifyRequest,
  isAiReferer,
  verifyBotIp,
} from "../api/services/crawlerClassification";

let failures = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};

type Expect = { botName: string | null; botClass: string | null; known: boolean };
const CASES: { label: string; ua: string | null; referer: string | null; expect: Expect }[] = [
  {
    label: "GPTBot → training_crawl",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    referer: null,
    expect: { botName: "GPTBot", botClass: "training_crawl", known: true },
  },
  {
    label: "OAI-SearchBot → citation_fetch",
    ua: "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
    referer: null,
    expect: { botName: "OAI-SearchBot", botClass: "citation_fetch", known: true },
  },
  {
    label: "ChatGPT-User → citation_fetch",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
    referer: null,
    expect: { botName: "ChatGPT-User", botClass: "citation_fetch", known: true },
  },
  {
    label: "ClaudeBot → training_crawl",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    referer: null,
    expect: { botName: "ClaudeBot", botClass: "training_crawl", known: true },
  },
  {
    label: "Claude-User → citation_fetch",
    ua: "Mozilla/5.0 (compatible; Claude-User/1.0; +https://support.anthropic.com)",
    referer: null,
    expect: { botName: "Claude-User", botClass: "citation_fetch", known: true },
  },
  {
    label: "Perplexity-User → citation_fetch (not PerplexityBot)",
    ua: "Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
    referer: null,
    expect: { botName: "Perplexity-User", botClass: "citation_fetch", known: true },
  },
  {
    label: "AI referer with benign browser UA → referral_visit",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    referer: "https://chatgpt.com/c/abc123",
    expect: { botName: null, botClass: "referral_visit", known: true },
  },
  {
    label: "subdomain AI referer (www.perplexity.ai) → referral_visit",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    referer: "https://www.perplexity.ai/search/some-query",
    expect: { botName: null, botClass: "referral_visit", known: true },
  },
  {
    label: "bot UA wins over AI referer (machine, not human)",
    ua: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    referer: "https://claude.ai/chat/xyz",
    expect: { botName: "ClaudeBot", botClass: "training_crawl", known: true },
  },
  {
    label: "empty UA + no referer → unknown (discarded)",
    ua: "",
    referer: null,
    expect: { botName: null, botClass: null, known: false },
  },
  {
    label: "unknown bot (Googlebot) → unknown (not an AI-channel signal)",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    referer: null,
    expect: { botName: null, botClass: null, known: false },
  },
  {
    label: "benign UA + non-AI referer → unknown",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    referer: "https://www.google.com/search?q=plumber",
    expect: { botName: null, botClass: null, known: false },
  },
];

for (const c of CASES) {
  const got = classifyRequest(c.ua, c.referer);
  const pass =
    got.botName === c.expect.botName &&
    got.botClass === c.expect.botClass &&
    got.known === c.expect.known;
  ok(
    pass,
    `${c.label} — got ${JSON.stringify({ botName: got.botName, botClass: got.botClass, known: got.known })}`,
  );
}

// Referer edge cases
ok(!isAiReferer(null), "isAiReferer(null) === false");
ok(!isAiReferer(""), "isAiReferer('') === false");
ok(isAiReferer("https://gemini.google.com/app/123"), "gemini.google.com referer detected");
ok(isAiReferer("not a url but mentions chatgpt.com/path"), "bare-host referer fallback detected");

// Verification stub: conservative false, clean async interface.
const verified = await verifyBotIp("203.0.113.10", "GPTBot");
ok(verified === false, "verifyBotIp stub returns false (conservative)");

if (failures) {
  console.error(`\n${failures} classification check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll classification checks passed.");
process.exit(0);
