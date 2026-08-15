import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { brands, citations, mentions, prompts, scans, sources } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { findLatestCompleteScan } from "./queries/tenancy";
import { requireTenant } from "./tenant";
import {
  CATEGORY_LABELS,
  ENGINE_LABELS,
  type CategoryId,
  type EngineId,
} from "./labels";

const engineEnum = z.enum([
  "chatgpt",
  "gemini",
  "claude",
  "perplexity",
  "ai_overviews",
  "ai_search",
]);

async function resolveScan(tenantId: number, scanId?: number) {
  const db = getDb();
  if (scanId) {
    const scan = await db.query.scans.findFirst({
      // Tenant filter on scan lookup — a scan id from another tenant must not leak.
      where: and(eq(scans.id, scanId), eq(scans.tenantId, tenantId)),
    });
    if (!scan) throw new TRPCError({ code: "NOT_FOUND", message: "Scan not found" });
    return scan;
  }
  const latest = await findLatestCompleteScan(tenantId);
  if (!latest) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No completed scan yet" });
  }
  return latest;
}

export const monitoringRouter = createRouter({
  /** Priority prompt set with categories (monitoring.md §S4). */
  prompts: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select()
      .from(prompts)
      .where(eq(prompts.tenantId, tenantId))
      .orderBy(prompts.id);
    return rows.map((p) => ({
      ...p,
      categoryLabel: CATEGORY_LABELS[p.category as CategoryId] ?? p.category,
    }));
  }),

  /** Available scan snapshots for the date picker (monitoring.md §S1). */
  scanOptions: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select()
      .from(scans)
      .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "complete")))
      .orderBy(desc(scans.completedAt))
      .limit(12);
    return rows.map((s) => ({
      id: s.id,
      date: s.completedAt,
      score: s.metrics?.score ?? null,
    }));
  }),

  /** Prompt × engine heatmap matrix for one scan (monitoring.md §S2). */
  heatmap: authedQuery
    .input(
      z
        .object({
          scanId: z.number().int().positive().optional(),
          engine: engineEnum.optional(),
          category: z
            .enum(["best_option", "comparison", "local", "service_category", "decision_stage"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      const scan = await resolveScan(tenantId, input?.scanId);

      const primaryBrand = await db.query.brands.findFirst({
        where: and(eq(brands.tenantId, tenantId), eq(brands.isPrimary, true)),
      });
      if (!primaryBrand) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Primary brand not seeded" });
      }

      const promptRows = await db
        .select()
        .from(prompts)
        .where(
          and(
            eq(prompts.tenantId, tenantId),
            eq(prompts.active, true),
            input?.category ? eq(prompts.category, input.category) : undefined,
          ),
        )
        .orderBy(prompts.id);

      const mentionRows = await db
        .select()
        .from(mentions)
        .where(
          and(
            eq(mentions.tenantId, tenantId),
            eq(mentions.scanId, scan.id),
            eq(mentions.brandId, primaryBrand.id),
          ),
        );

      const byPromptEngine = new Map<string, (typeof mentionRows)[number]>();
      for (const m of mentionRows) {
        byPromptEngine.set(`${m.promptId}:${m.engine}`, m);
      }

      const engines = (Object.keys(ENGINE_LABELS) as EngineId[]).filter(
        (e) => !input?.engine || e === input.engine,
      );

      const rows = promptRows.map((p) => ({
        promptId: p.id,
        text: p.text,
        category: p.category,
        categoryLabel: CATEGORY_LABELS[p.category as CategoryId] ?? p.category,
        cells: engines.map((engine) => {
          const m = byPromptEngine.get(`${p.id}:${engine}`);
          return {
            engine,
            engineLabel: ENGINE_LABELS[engine],
            intensity: m?.intensity ?? 0,
            mentioned: m?.mentioned ?? false,
            recommended: m?.recommended ?? false,
            position: m?.position ?? null,
          };
        }),
      }));

      return {
        scanId: scan.id,
        scanDate: scan.completedAt,
        engines: engines.map((e) => ({ id: e, label: ENGINE_LABELS[e] })),
        rows,
      };
    }),

  /** Per-category mention-rate bars (monitoring.md §S3). */
  categoryRates: authedQuery
    .input(z.object({ scanId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      const scan = await resolveScan(tenantId, input?.scanId);
      const rates = scan.metrics?.categoryRates ?? {};
      const promptRows = await db
        .select()
        .from(prompts)
        .where(and(eq(prompts.tenantId, tenantId), eq(prompts.active, true)));
      return (Object.keys(CATEGORY_LABELS) as CategoryId[]).map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        rate: rates[category] ?? 0,
        promptCount: promptRows.filter((p) => p.category === category).length,
        prompts: promptRows
          .filter((p) => p.category === category)
          .map((p) => p.text),
      }));
    }),

  /**
   * Single heatmap cell → response-drawer payload (monitoring.md §S2):
   * the captured AI answer excerpt plus the URLs that scan/engine cited.
   */
  response: authedQuery
    .input(
      z.object({
        promptId: z.number().int().positive(),
        engine: engineEnum,
        scanId: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      const scan = await resolveScan(tenantId, input.scanId);

      const prompt = await db.query.prompts.findFirst({
        where: and(eq(prompts.id, input.promptId), eq(prompts.tenantId, tenantId)),
      });
      if (!prompt) throw new TRPCError({ code: "NOT_FOUND", message: "Prompt not found" });

      const primaryBrand = await db.query.brands.findFirst({
        where: and(eq(brands.tenantId, tenantId), eq(brands.isPrimary, true)),
      });

      const mention = await db.query.mentions.findFirst({
        where: and(
          eq(mentions.tenantId, tenantId),
          eq(mentions.scanId, scan.id),
          eq(mentions.promptId, input.promptId),
          eq(mentions.engine, input.engine),
          eq(mentions.brandId, primaryBrand?.id ?? -1),
        ),
      });

      const citationRows = await db
        .select({
          id: citations.id,
          citedUrl: citations.citedUrl,
          sourceName: sources.name,
        })
        .from(citations)
        .innerJoin(sources, eq(citations.sourceId, sources.id))
        .where(
          and(
            eq(citations.tenantId, tenantId),
            eq(citations.scanId, scan.id),
            eq(citations.engine, input.engine),
          ),
        );

      return {
        prompt: { id: prompt.id, text: prompt.text, category: prompt.category },
        engine: input.engine,
        engineLabel: ENGINE_LABELS[input.engine],
        scanId: scan.id,
        scanDate: scan.completedAt,
        mentioned: mention?.mentioned ?? false,
        recommended: mention?.recommended ?? false,
        position: mention?.position ?? null,
        sentiment: mention?.sentiment ?? null,
        intensity: mention?.intensity ?? 0,
        responseText: mention?.responseText ?? null,
        citations: citationRows,
      };
    }),
});
