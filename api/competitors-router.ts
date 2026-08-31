import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { brands, mentions, prompts } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { findLatestCompleteScan } from "./queries/tenancy";
import { requireTenant } from "./tenant";
import { ENGINE_LABELS, type EngineId } from "./labels";
import {
  findDomainRank,
  getBacklinkSummary,
  getSearchVolume,
  getSerpOrganic,
  isDataForSeoConfigured,
  type SerpOrganicItem,
} from "./services/dataforseo";

/** Best-effort domain for a brand name ("Atlas Capital" → "atlascapital.com"). */
function brandToDomain(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`;
}

/** Hostname from a stored websiteUrl ("northwindadvisory.com" / full URL). */
function toDomain(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

type Difficulty = "Low" | "Medium" | "High";

/** Volume-based difficulty heuristic (no dedicated difficulty endpoint wired). */
function difficultyFor(volume: number): Difficulty {
  if (volume >= 5000) return "High";
  if (volume >= 1000) return "Medium";
  return "Low";
}

interface SeoResearchPayload {
  cachedNote: string;
  serpOverlap: { keyword: string; tenantPos: number; competitorPos: number; volume: number }[];
  keywordGaps: { keyword: string; competitorPos: number; volume: number; difficulty: Difficulty }[];
  backlinks: {
    tenantReferringDomains: number;
    competitorReferringDomains: number;
    rows: { domain: string; authority: "High" | "Medium" | "Low"; linksTo: string[] }[];
  };
}

export type SeoResearchResult =
  | ({ brandId: number; name: string; available: false } & {
      dataSource: "sample";
      fetchedAt: null;
    })
  | ({
      brandId: number;
      name: string;
      available: true;
      dataSource: "live" | "cache" | "sample";
      fetchedAt: string | null;
    } & SeoResearchPayload);

/**
 * Live DataForSEO research for one competitor: real search volumes, SERP
 * positions for the tenant's service keywords, and backlink summaries for
 * the tenant + competitor domains. Served from the cost cache when fresh.
 */
async function buildLiveResearch(
  tenantId: number,
  tenantDomain: string,
  services: string[],
  competitorName: string,
): Promise<{
  payload: SeoResearchPayload;
  dataSource: "live" | "cache";
  fetchedAt: Date;
}> {
  const competitorDomain = brandToDomain(competitorName);
  const keywords = services.map((s) => s.toLowerCase()).slice(0, 4);

  const volumeCall = getSearchVolume(keywords, tenantId);
  const serpCalls = keywords.map((kw) => getSerpOrganic(kw, 2840, "en", 30, tenantId));
  const tenantBacklinks = getBacklinkSummary(tenantDomain, tenantId);
  const competitorBacklinks = getBacklinkSummary(competitorDomain, tenantId);

  const [volumes, serps, tenantBl, competitorBl] = await Promise.all([
    volumeCall,
    Promise.all(serpCalls),
    tenantBacklinks,
    competitorBacklinks,
  ]);

  const calls = [volumes, ...serps, tenantBl, competitorBl];
  const dataSource = calls.every((c) => c.dataSource === "cache") ? "cache" : "live";
  const fetchedAt = new Date(Math.max(...calls.map((c) => c.fetchedAt.getTime())));
  const totalCost = calls.reduce((sum, c) => sum + c.cost, 0);

  const volumeByKeyword = new Map(volumes.data.map((v) => [v.keyword, v.volume]));
  const serpByKeyword = new Map<string, SerpOrganicItem[]>(
    keywords.map((kw, i) => [kw, serps[i]?.data ?? []]),
  );

  const serpOverlap = keywords.map((keyword) => {
    const items = serpByKeyword.get(keyword) ?? [];
    return {
      keyword,
      tenantPos: findDomainRank(items, tenantDomain),
      competitorPos: findDomainRank(items, competitorDomain),
      volume: volumeByKeyword.get(keyword) ?? 0,
    };
  });

  const keywordGaps = serpOverlap
    .filter((r) => r.competitorPos > 0 && (r.tenantPos === 0 || r.competitorPos < r.tenantPos))
    .map((r) => ({
      keyword: r.keyword,
      competitorPos: r.competitorPos,
      volume: r.volume,
      difficulty: difficultyFor(r.volume),
    }));

  const fetchedLabel = fetchedAt.toISOString().slice(11, 16);
  return {
    dataSource,
    fetchedAt,
    payload: {
      cachedNote: `DataForSEO · ${dataSource === "cache" ? "served from cache" : "live"} · fetched ${fetchedLabel} UTC · 24h cache · billed $${totalCost.toFixed(4)}`,
      serpOverlap,
      keywordGaps,
      backlinks: {
        tenantReferringDomains: tenantBl.data.referringDomains,
        competitorReferringDomains: competitorBl.data.referringDomains,
        rows: [],
      },
    },
  };
}

/**
 * DataForSEO research stubs (competitors.md §S4) — static seeded sample data
 * for the MVP; real DataForSEO keys plug in later without changing the shape.
 * Keyed by competitor brand name.
 */
const SEO_RESEARCH_FIXTURES: Record<
  string,
  {
    cachedNote: string;
    serpOverlap: { keyword: string; tenantPos: number; competitorPos: number; volume: number }[];
    keywordGaps: { keyword: string; competitorPos: number; volume: number; difficulty: "Low" | "Medium" | "High" }[];
    backlinks: {
      tenantReferringDomains: number;
      competitorReferringDomains: number;
      rows: { domain: string; authority: "High" | "Medium" | "Low"; linksTo: string[] }[];
    };
  }
> = {
  "Atlas Capital": {
    cachedNote: "DataForSEO · cached Jul 12 · refreshes weekly",
    serpOverlap: [
      { keyword: "wealth management firms", tenantPos: 14, competitorPos: 3, volume: 1900 },
      { keyword: "financial advisor near me", tenantPos: 8, competitorPos: 5, volume: 4400 },
      { keyword: "retirement planning services", tenantPos: 22, competitorPos: 7, volume: 2900 },
      { keyword: "tax planning for small business", tenantPos: 11, competitorPos: 9, volume: 1300 },
    ],
    keywordGaps: [
      { keyword: "fee-only financial planner", competitorPos: 4, volume: 2400, difficulty: "Medium" },
      { keyword: "fiduciary advisor checklist", competitorPos: 6, volume: 880, difficulty: "Low" },
      { keyword: "wealth management fees comparison", competitorPos: 2, volume: 1100, difficulty: "Low" },
    ],
    backlinks: {
      tenantReferringDomains: 168,
      competitorReferringDomains: 412,
      rows: [
        { domain: "Regional Business Journal", authority: "High", linksTo: ["Atlas Capital", "Beacon Partners"] },
        { domain: "Industry Directory A", authority: "High", linksTo: ["Atlas Capital"] },
        { domain: "Professional Listings Hub", authority: "Medium", linksTo: ["Beacon Partners"] },
      ],
    },
  },
  "Beacon Partners": {
    cachedNote: "DataForSEO · cached Jul 12 · refreshes weekly",
    serpOverlap: [
      { keyword: "wealth management firms", tenantPos: 14, competitorPos: 9, volume: 1900 },
      { keyword: "financial advisor near me", tenantPos: 8, competitorPos: 11, volume: 4400 },
      { keyword: "retirement planning services", tenantPos: 22, competitorPos: 12, volume: 2900 },
    ],
    keywordGaps: [
      { keyword: "retirement income planning", competitorPos: 5, volume: 1600, difficulty: "Medium" },
      { keyword: "tax efficient investing", competitorPos: 8, volume: 720, difficulty: "Low" },
    ],
    backlinks: {
      tenantReferringDomains: 168,
      competitorReferringDomains: 246,
      rows: [
        { domain: "Regional Business Journal", authority: "High", linksTo: ["Atlas Capital", "Beacon Partners"] },
        { domain: "Professional Listings Hub", authority: "Medium", linksTo: ["Beacon Partners"] },
      ],
    },
  },
  "Cedarwood Group": {
    cachedNote: "DataForSEO · cached Jul 12 · refreshes weekly",
    serpOverlap: [
      { keyword: "financial advisor near me", tenantPos: 8, competitorPos: 18, volume: 4400 },
      { keyword: "estate planning services", tenantPos: 16, competitorPos: 14, volume: 980 },
    ],
    keywordGaps: [
      { keyword: "estate planning checklist", competitorPos: 9, volume: 540, difficulty: "Low" },
    ],
    backlinks: {
      tenantReferringDomains: 168,
      competitorReferringDomains: 121,
      rows: [
        { domain: "Local Chamber of Commerce", authority: "Medium", linksTo: ["Cedarwood Group"] },
      ],
    },
  },
};

export const competitorsRouter = createRouter({
  /** Leaderboard on identical methodology (competitors.md §S2). */
  leaderboard: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select()
      .from(brands)
      .where(eq(brands.tenantId, tenantId));
    return rows
      .map((b) => ({
        brandId: b.id,
        name: b.name,
        isPrimary: b.isPrimary,
        score: b.stats?.score ?? 0,
        mentionRate: b.stats?.mentionRate ?? 0,
        recommendationShare: b.stats?.recommendationShare ?? 0,
        trend: b.stats?.trend ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((b, i) => ({ rank: i + 1, ...b }));
  }),

  /**
   * Per-competitor gap diagnostics (competitors.md §S3): headline stats from
   * the seeded brand fixtures + the prompt table derived live from mentions —
   * prompts where the competitor appears and the primary brand doesn't.
   */
  gapDiagnostics: authedQuery
    .input(z.object({ brandId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();

      const competitor = await db.query.brands.findFirst({
        where: and(eq(brands.id, input.brandId), eq(brands.tenantId, tenantId)),
      });
      if (!competitor || competitor.isPrimary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Competitor not found" });
      }
      const primary = await db.query.brands.findFirst({
        where: and(eq(brands.tenantId, tenantId), eq(brands.isPrimary, true)),
      });
      if (!primary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Primary brand not seeded" });
      }
      const scan = await findLatestCompleteScan(tenantId);
      if (!scan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No completed scan yet" });
      }

      const rows = await db
        .select({
          promptId: mentions.promptId,
          promptText: prompts.text,
          category: prompts.category,
          engine: mentions.engine,
          brandId: mentions.brandId,
          mentioned: mentions.mentioned,
          position: mentions.position,
        })
        .from(mentions)
        .innerJoin(prompts, eq(mentions.promptId, prompts.id))
        .where(
          and(
            eq(mentions.tenantId, tenantId),
            eq(mentions.scanId, scan.id),
            inArray(mentions.brandId, [competitor.id, primary.id]),
          ),
        );

      // competitor mentioned + primary absent for the same prompt × engine
      const primaryCells = new Set(
        rows.filter((r) => r.brandId === primary.id && r.mentioned).map((r) => `${r.promptId}:${r.engine}`),
      );
      const gaps = rows
        .filter(
          (r) =>
            r.brandId === competitor.id &&
            r.mentioned &&
            !primaryCells.has(`${r.promptId}:${r.engine}`),
        )
        .map((r) => ({
          promptId: r.promptId,
          prompt: r.promptText,
          category: r.category,
          engine: r.engine,
          engineLabel: ENGINE_LABELS[r.engine as EngineId] ?? r.engine,
          theirPosition: r.position,
        }))
        .sort((a, b) => (a.theirPosition ?? 99) - (b.theirPosition ?? 99));

      const s = competitor.stats;
      return {
        brandId: competitor.id,
        name: competitor.name,
        gapShare: s?.gapShare ?? null,
        gapCategory: s?.gapCategory ?? null,
        strongestCategory: s?.strongestCategory ?? null,
        strongestCategoryStat: s?.strongestCategoryStat ?? null,
        insight: s?.insight ?? null,
        promptsWhereAbsent: gaps,
      };
    }),

  /**
   * DataForSEO research: SERP overlap / keyword gaps / backlinks. Live (or
   * cost-cached) when DATAFORSEO_* credentials are configured; falls back to
   * the seeded sample fixtures when unconfigured or when the API errors, so
   * the page never crashes. Every response carries dataSource + fetchedAt.
   */
  seoResearch: authedQuery
    .input(z.object({ brandId: z.number().int().positive() }))
    .query(async ({ ctx, input }): Promise<SeoResearchResult> => {
      const { tenantId, tenant } = await requireTenant(ctx.user.id);
      const competitor = await getDb().query.brands.findFirst({
        where: and(eq(brands.id, input.brandId), eq(brands.tenantId, tenantId)),
      });
      if (!competitor || competitor.isPrimary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Competitor not found" });
      }

      const fixture = SEO_RESEARCH_FIXTURES[competitor.name];
      const sampleFallback = (): SeoResearchResult =>
        fixture
          ? {
              brandId: competitor.id,
              name: competitor.name,
              available: true as const,
              dataSource: "sample" as const,
              fetchedAt: null,
              ...fixture,
            }
          : {
              brandId: competitor.id,
              name: competitor.name,
              available: false as const,
              dataSource: "sample" as const,
              fetchedAt: null,
            };

      if (!isDataForSeoConfigured()) {
        return sampleFallback();
      }

      try {
        const services = tenant.profile?.services ?? [];
        if (services.length === 0) return sampleFallback();
        const live = await buildLiveResearch(
          tenantId,
          toDomain(tenant.websiteUrl),
          services,
          competitor.name,
        );
        return {
          brandId: competitor.id,
          name: competitor.name,
          available: true as const,
          dataSource: live.dataSource,
          fetchedAt: live.fetchedAt.toISOString(),
          ...live.payload,
        };
      } catch (err) {
        console.warn(
          `[dataforseo] live research failed for "${competitor.name}" — serving sample data:`,
          err instanceof Error ? err.message : err,
        );
        return sampleFallback();
      }
    }),
});
