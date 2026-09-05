import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { crawlerVisits } from "@db/schema";
import type { BotClass } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { requireTenant } from "./tenant";

/**
 * AI Channel Analytics read API (PRD §4.7) — tenant-scoped views over
 * crawler_visits. Every procedure resolves the caller's tenant via
 * requireTenant; every number is drillable to raw rows via aiChannelVisits.
 */

const DAYS = 24 * 60 * 60 * 1000;

const BOT_CLASSES = ["training_crawl", "citation_fetch", "referral_visit"] as const;
const botClassEnum = z.enum(BOT_CLASSES);
const daysInput = z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30);

interface ClassTotals {
  training_crawl: number;
  citation_fetch: number;
  referral_visit: number;
}

function emptyTotals(): ClassTotals {
  return { training_crawl: 0, citation_fetch: 0, referral_visit: 0 };
}

async function totalsByClass(
  tenantId: number,
  from: Date,
  to: Date,
): Promise<ClassTotals> {
  const rows = await getDb()
    .select({ botClass: crawlerVisits.botClass, value: count() })
    .from(crawlerVisits)
    .where(
      and(
        eq(crawlerVisits.tenantId, tenantId),
        gte(crawlerVisits.visitedAt, from),
        lt(crawlerVisits.visitedAt, to),
      ),
    )
    .groupBy(crawlerVisits.botClass);
  const totals = emptyTotals();
  for (const r of rows) totals[r.botClass as BotClass] = r.value;
  return totals;
}

/** % change vs prior period; null when the prior period had no data. */
function trendPct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export const analyticsRouter = createRouter({
  /**
   * Headline KPIs: totals by bot class for the window + trend vs the prior
   * equal-length window, top bots, and verified share. Unverified
   * (spoofed-UA) visits are reported separately, per PRD requirement 1.
   */
  aiChannelSummary: authedQuery
    .input(z.object({ days: daysInput }).optional())
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const days = input?.days ?? 30;
      const now = new Date();
      const from = new Date(now.getTime() - days * DAYS);
      const priorFrom = new Date(now.getTime() - 2 * days * DAYS);

      const [current, prior, verifiedRows, topBotRows] = await Promise.all([
        totalsByClass(tenantId, from, now),
        totalsByClass(tenantId, priorFrom, from),
        getDb()
          .select({ botClass: crawlerVisits.botClass, value: count() })
          .from(crawlerVisits)
          .where(
            and(
              eq(crawlerVisits.tenantId, tenantId),
              gte(crawlerVisits.visitedAt, from),
              eq(crawlerVisits.verified, true),
            ),
          )
          .groupBy(crawlerVisits.botClass),
        getDb()
          .select({ botName: crawlerVisits.botName, botClass: crawlerVisits.botClass, value: count() })
          .from(crawlerVisits)
          .where(
            and(eq(crawlerVisits.tenantId, tenantId), gte(crawlerVisits.visitedAt, from)),
          )
          .groupBy(crawlerVisits.botName, crawlerVisits.botClass)
          .orderBy(desc(count()))
          .limit(8),
      ]);

      const verified = emptyTotals();
      for (const r of verifiedRows) verified[r.botClass as BotClass] = r.value;

      const sum = (t: ClassTotals) =>
        t.training_crawl + t.citation_fetch + t.referral_visit;
      const totalAll = sum(current);
      const totalVerified = sum(verified);

      return {
        days,
        totals: current,
        trend: {
          training_crawl: trendPct(current.training_crawl, prior.training_crawl),
          citation_fetch: trendPct(current.citation_fetch, prior.citation_fetch),
          referral_visit: trendPct(current.referral_visit, prior.referral_visit),
        },
        verified: {
          totals: verified,
          pct: totalAll > 0 ? Math.round((totalVerified / totalAll) * 1000) / 10 : null,
        },
        topBots: topBotRows.map((r) => ({
          botName: r.botName ?? "(AI referral)",
          botClass: r.botClass,
          count: r.value,
        })),
        total: totalAll,
      };
    }),

  /** Daily counts by class for the stacked-area timeseries chart. */
  aiChannelTimeseries: authedQuery
    .input(z.object({ days: daysInput }).optional())
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const days = input?.days ?? 30;
      const from = new Date(Date.now() - days * DAYS);

      // Alias inline + GROUP BY the alias — TiDB/MySQL run
      // only_full_group_by, and a textually different DATE_FORMAT(...)
      // expression in GROUP BY trips it.
      const rows = await getDb()
        .select({
          day: sql<string>`DATE_FORMAT(${crawlerVisits.visitedAt}, '%Y-%m-%d') AS day`,
          botClass: crawlerVisits.botClass,
          value: count(),
        })
        .from(crawlerVisits)
        .where(
          and(eq(crawlerVisits.tenantId, tenantId), gte(crawlerVisits.visitedAt, from)),
        )
        .groupBy(sql`day`, crawlerVisits.botClass)
        .orderBy(sql`day`);

      const byDay = new Map<string, ClassTotals & { date: string }>();
      for (const r of rows) {
        const entry = byDay.get(r.day) ?? { date: r.day, ...emptyTotals() };
        entry[r.botClass as BotClass] = r.value;
        byDay.set(r.day, entry);
      }
      return { days, points: [...byDay.values()] };
    }),

  /** Most-crawled / most-fetched paths (citation-fetch map + top pages). */
  aiChannelTopPages: authedQuery
    .input(
      z
        .object({
          days: daysInput,
          botClass: botClassEnum.optional(),
          limit: z.number().int().min(1).max(50).default(10),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const days = input?.days ?? 30;
      const from = new Date(Date.now() - days * DAYS);
      const rows = await getDb()
        .select({
          path: crawlerVisits.path,
          value: count(),
          lastVisitedAt: sql<Date>`MAX(${crawlerVisits.visitedAt})`,
        })
        .from(crawlerVisits)
        .where(
          and(
            eq(crawlerVisits.tenantId, tenantId),
            gte(crawlerVisits.visitedAt, from),
            input?.botClass ? eq(crawlerVisits.botClass, input.botClass) : undefined,
          ),
        )
        .groupBy(crawlerVisits.path)
        .orderBy(desc(count()))
        .limit(input?.limit ?? 10);
      return rows.map((r) => ({
        path: r.path,
        count: r.value,
        lastVisitedAt: r.lastVisitedAt,
      }));
    }),

  /**
   * Drillable paginated raw rows (every-number-is-drillable rule): KPI cards
   * and chart segments link here with a bot-class filter.
   */
  aiChannelVisits: authedQuery
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
        botClass: botClassEnum.optional(),
        days: daysInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const from = new Date(Date.now() - input.days * DAYS);
      const where = and(
        eq(crawlerVisits.tenantId, tenantId),
        gte(crawlerVisits.visitedAt, from),
        input.botClass ? eq(crawlerVisits.botClass, input.botClass) : undefined,
      );
      const db = getDb();
      const [totalRow] = await db.select({ value: count() }).from(crawlerVisits).where(where);
      const rows = await db
        .select()
        .from(crawlerVisits)
        .where(where)
        .orderBy(desc(crawlerVisits.visitedAt), desc(crawlerVisits.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      const total = totalRow?.value ?? 0;
      return {
        rows,
        total,
        page: input.page,
        pageSize: input.pageSize,
        pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  /**
   * Log-drain connection details for the empty state / setup panel: ingest
   * endpoint URL + the tenant's ingest token masked to its last 4 chars.
   */
  ingestConnection: authedQuery.query(async ({ ctx }) => {
    const { tenant } = await requireTenant(ctx.user.id);
    const token = tenant.ingestToken ?? null;
    const origin = new URL(ctx.req.url).origin;
    return {
      ingestUrl: `${origin}/api/ingest/crawler-visit`,
      tokenConfigured: token !== null,
      maskedToken: token ? `••••${token.slice(-4)}` : null,
    };
  }),
});
