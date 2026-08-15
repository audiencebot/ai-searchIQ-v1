import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { citations, sources } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { findLatestCompleteScan } from "./queries/tenancy";
import { requireTenant } from "./tenant";
import { ENGINE_LABELS, citationStrengthLabel, type EngineId } from "./labels";

/**
 * Citation strength by source type (citations.md §S4 / sample report §05) —
 * methodology v1.2 fixture; recomputed from live citation data post-MVP.
 */
const STRENGTH_BY_TYPE = [
  { type: "directory", label: "Directories", score: 42 },
  { type: "article", label: "Articles", score: 55 },
  { type: "listing", label: "Listings", score: 70 },
  { type: "reviews", label: "Reviews", score: 68 },
  { type: "knowledge", label: "Knowledge", score: 80 },
] as const;

const TYPE_LABELS: Record<string, string> = {
  directory: "Directory",
  article: "Article",
  listing: "Listing",
  reviews: "Reviews",
  knowledge: "Knowledge",
};

export const citationsRouter = createRouter({
  /** Source gap table (citations.md §S3). */
  sources: authedQuery
    .input(
      z
        .object({ status: z.enum(["present", "missing"]).optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const rows = await getDb()
        .select()
        .from(sources)
        .where(
          and(
            eq(sources.tenantId, tenantId),
            input?.status ? eq(sources.status, input.status) : undefined,
          ),
        )
        .orderBy(sources.id);
      return rows.map((s) => ({ ...s, typeLabel: TYPE_LABELS[s.type] ?? s.type }));
    }),

  /** Summary strip: strength, presence counts, high-authority gaps (§S2). */
  summary: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const db = getDb();
    const rows = await db
      .select()
      .from(sources)
      .where(eq(sources.tenantId, tenantId));
    const scan = await findLatestCompleteScan(tenantId);
    const subScore = scan?.metrics?.citationStrength ?? 0;
    const present = rows.filter((r) => r.status === "present").length;
    const highAuthorityGaps = rows.filter(
      (r) => r.status === "missing" && r.authority === "high",
    ).length;
    return {
      citationStrength: { label: citationStrengthLabel(subScore), subScore },
      sourcesPresent: present,
      sourcesTotal: rows.length,
      presentDelta: 1, // vs. last scan (seeded fixture: "+1 vs. last scan")
      highAuthorityGaps,
    };
  }),

  /** Citation strength by source type bars (§S4). */
  strengthByType: authedQuery.query(async ({ ctx }) => {
    await requireTenant(ctx.user.id);
    return {
      rows: STRENGTH_BY_TYPE,
      footnote:
        "Directories drag the composite — 2 of 4 high-authority directories are missing.",
    };
  }),

  /** Citation pickup feed (citations.md §S5). */
  pickupFeed: authedQuery
    .input(z.object({ limit: z.number().int().min(1).max(20).default(6) }).optional())
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const rows = await getDb()
        .select({
          id: citations.id,
          createdAt: citations.createdAt,
          engine: citations.engine,
          citedUrl: citations.citedUrl,
          note: citations.note,
          sourceName: sources.name,
        })
        .from(citations)
        .innerJoin(sources, eq(citations.sourceId, sources.id))
        .where(eq(citations.tenantId, tenantId))
        .orderBy(desc(citations.createdAt))
        .limit(input?.limit ?? 6);
      return rows.map((r) => ({
        id: r.id,
        date: r.createdAt,
        engine: r.engine,
        engineLabel: ENGINE_LABELS[r.engine as EngineId] ?? r.engine,
        sourceName: r.sourceName,
        citedUrl: r.citedUrl,
        text:
          r.note ??
          `${ENGINE_LABELS[r.engine as EngineId] ?? r.engine} cited your ${r.sourceName}`,
        isWarning: r.note?.includes("incorrect") ?? false,
      }));
    }),

  /** Source detail drawer (citations.md §S3 row click). */
  sourceDetail: authedQuery
    .input(z.object({ sourceId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      const source = await db.query.sources.findFirst({
        where: and(eq(sources.id, input.sourceId), eq(sources.tenantId, tenantId)),
      });
      if (!source) return null;
      const instances = await db
        .select()
        .from(citations)
        .where(
          and(eq(citations.tenantId, tenantId), eq(citations.sourceId, source.id)),
        )
        .orderBy(desc(citations.createdAt));
      return { source, instances };
    }),
});
