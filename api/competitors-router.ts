import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { brands, mentions, prompts } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { findLatestCompleteScan } from "./queries/tenancy";
import { requireTenant } from "./tenant";
import { ENGINE_LABELS, type EngineId } from "./labels";

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

  /** DataForSEO research stubs: SERP overlap / keyword gaps / backlinks. */
  seoResearch: authedQuery
    .input(z.object({ brandId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const competitor = await getDb().query.brands.findFirst({
        where: and(eq(brands.id, input.brandId), eq(brands.tenantId, tenantId)),
      });
      if (!competitor || competitor.isPrimary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Competitor not found" });
      }
      const fixture = SEO_RESEARCH_FIXTURES[competitor.name];
      if (!fixture) {
        return { brandId: competitor.id, name: competitor.name, available: false as const };
      }
      return {
        brandId: competitor.id,
        name: competitor.name,
        available: true as const,
        ...fixture,
      };
    }),
});
