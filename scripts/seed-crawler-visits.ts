/**
 * Seed ~90 days of realistic AI-channel traffic for the demo tenant
 * (PRD §4.7 acceptance fixture): heavy training crawls from GPTBot /
 * ClaudeBot / PerplexityBot, a growing citation-fetch trend (ChatGPT-User,
 * Claude-User, Perplexity-User), and AI-surface referral visits. ~80% of bot
 * rows are marked verified (rDNS-clean vendor IPs); the rest are spoofed-UA
 * rows kept out of headline metrics.
 *
 * Run:   npx tsx scripts/seed-crawler-visits.ts
 * Flags: --force   reseed even when rows already exist (default: skip when
 *                  the tenant already has >100 crawler_visits rows)
 *
 * Idempotent-ish: without --force the script exits early on an already-seeded
 * tenant, so re-running the seed pipeline never doubles the fixture.
 */
import { count, eq } from "drizzle-orm";
import { crawlerVisits, tenants } from "@db/schema";
import type { InsertCrawlerVisit } from "@db/schema";
import { getDb } from "../api/queries/connection";

const DAYS = 90;
const SKIP_THRESHOLD = 100;
const CHUNK = 250;

/** Deterministic PRNG so reseeds reproduce the same shape. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xa15eED);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

const PATHS = [
  "/", "/services", "/services/ai-readiness-audit", "/services/fractional-cmo",
  "/pricing", "/about", "/contact", "/insights",
  "/insights/ai-search-visibility", "/insights/generative-engine-optimization",
  "/insights/local-seo-benchmarks", "/case-studies/northstar-roofing",
  "/case-studies/harbor-dental", "/faq", "/team", "/resources/glossary",
] as const;

// Verified rows use plausible vendor IPs; spoofed rows use random IPs.
const BOT_IPS: Record<string, string[]> = {
  GPTBot: ["20.171.207.14", "40.84.180.22", "52.230.152.90"],
  "OAI-SearchBot": ["20.42.10.176", "40.84.221.10"],
  "ChatGPT-User": ["23.98.142.90", "20.15.240.64"],
  ClaudeBot: ["34.162.10.40", "35.247.88.12"],
  "Claude-User": ["34.162.200.7"],
  PerplexityBot: ["3.134.90.22", "18.117.64.11"],
  "Perplexity-User": ["3.21.44.120"],
  Bytespider: ["47.88.24.9"],
  CCBot: ["40.79.32.100"],
};
const REFERERS = [
  "https://chatgpt.com/c/", "https://chat.openai.com/c/", "https://www.perplexity.ai/search/",
  "https://claude.ai/chat/", "https://gemini.google.com/app/", "https://copilot.microsoft.com/chats/",
] as const;

interface BotSpec {
  botName: string;
  botClass: InsertCrawlerVisit["botClass"];
  /** Baseline hits/day at day 0 and the growth multiple by day 90. */
  perDay: [start: number, end: number];
}

const TRAINING_BOTS: BotSpec[] = [
  { botName: "GPTBot", botClass: "training_crawl", perDay: [6, 14] },
  { botName: "ClaudeBot", botClass: "training_crawl", perDay: [4, 9] },
  { botName: "PerplexityBot", botClass: "training_crawl", perDay: [3, 6] },
  { botName: "Bytespider", botClass: "training_crawl", perDay: [1, 2] },
  { botName: "CCBot", botClass: "training_crawl", perDay: [0.5, 1] },
];
const FETCH_BOTS: BotSpec[] = [
  { botName: "ChatGPT-User", botClass: "citation_fetch", perDay: [0.5, 6] },
  { botName: "OAI-SearchBot", botClass: "citation_fetch", perDay: [0.3, 3] },
  { botName: "Claude-User", botClass: "citation_fetch", perDay: [0.2, 2.5] },
  { botName: "Perplexity-User", botClass: "citation_fetch", perDay: [0.3, 2] },
];

function spoofedIp(): string {
  return `${100 + Math.floor(rand() * 100)}.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}`;
}

async function main() {
  const force = process.argv.includes("--force");
  const db = getDb();
  const tenant = await db.query.tenants.findFirst({ orderBy: tenants.id });
  if (!tenant) {
    console.error("No tenant found — run the base seed first.");
    process.exit(1);
  }

  const [existing] = await db
    .select({ value: count() })
    .from(crawlerVisits)
    .where(eq(crawlerVisits.tenantId, tenant.id));
  const existingCount = existing?.value ?? 0;
  if (!force && existingCount > SKIP_THRESHOLD) {
    console.log(
      `Tenant ${tenant.id} (${tenant.name}) already has ${existingCount} crawler_visits rows (> ${SKIP_THRESHOLD}) — skipping. Use --force to reseed.`,
    );
    process.exit(0);
  }

  const now = Date.now();
  const rows: InsertCrawlerVisit[] = [];

  for (let day = DAYS - 1; day >= 0; day--) {
    const t = 1 - day / (DAYS - 1); // 0 → oldest, 1 → today
    const dayStart = new Date(now - day * 24 * 60 * 60 * 1000);
    dayStart.setUTCHours(0, 0, 0, 0);

    const emitBot = (spec: BotSpec) => {
      const rate = spec.perDay[0] + (spec.perDay[1] - spec.perDay[0]) * t;
      const n = Math.floor(rate) + (rand() < rate % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const verified = rand() < 0.8;
        const ips = BOT_IPS[spec.botName] ?? [];
        rows.push({
          tenantId: tenant.id,
          botName: spec.botName,
          botClass: spec.botClass,
          path: pick(PATHS),
          httpStatus: rand() < 0.94 ? 200 : rand() < 0.5 ? 301 : 404,
          ip: verified && ips.length ? pick(ips) : spoofedIp(),
          verified,
          referer: null,
          visitedAt: new Date(dayStart.getTime() + rand() * 86_400_000),
        });
      }
    };
    TRAINING_BOTS.forEach(emitBot);
    FETCH_BOTS.forEach(emitBot);

    // Referral visits: humans clicking AI citations (grows with citations).
    const refRate = 0.5 + 3.5 * t;
    const refN = Math.floor(refRate) + (rand() < refRate % 1 ? 1 : 0);
    for (let i = 0; i < refN; i++) {
      rows.push({
        tenantId: tenant.id,
        botName: null,
        botClass: "referral_visit",
        path: pick(PATHS),
        httpStatus: 200,
        ip: spoofedIp(),
        verified: true, // human visits are referer-attributed, not IP-verified
        referer: pick(REFERERS) + Math.random().toString(36).slice(2, 10),
        visitedAt: new Date(dayStart.getTime() + rand() * 86_400_000),
      });
    }
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(crawlerVisits).values(rows.slice(i, i + CHUNK));
  }

  const [after] = await db
    .select({ value: count() })
    .from(crawlerVisits)
    .where(eq(crawlerVisits.tenantId, tenant.id));
  const byClass = await db
    .select({ botClass: crawlerVisits.botClass, value: count() })
    .from(crawlerVisits)
    .where(eq(crawlerVisits.tenantId, tenant.id))
    .groupBy(crawlerVisits.botClass);
  console.log(`Seeded ${rows.length} visits for tenant ${tenant.id} (${tenant.name}).`);
  console.log(`Total rows now: ${after?.value ?? 0}`);
  console.log("By class:", byClass.map((r) => `${r.botClass}=${r.value}`).join(", "));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
