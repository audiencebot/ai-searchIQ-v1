import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actions, alerts, brands, scans, sources } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { findRecentCompleteScans } from "./queries/tenancy";
import { requireTenant } from "./tenant";
import {
  CATEGORY_LABELS,
  ENGINE_LABELS,
  citationStrengthLabel,
  type CategoryId,
  type EngineId,
} from "./labels";

/**
 * Score-component weights — Methodology v1.2, fixed across tenants
 * (dashboard.md §S3 / sample report §02).
 */
const COMPONENTS = [
  { key: "mentionRate", label: "Mention rate", weight: 30 },
  { key: "recommendationShare", label: "Recommendation share", weight: 25 },
  { key: "citationStrength", label: "Citation strength", weight: 20 },
  { key: "promptCoverage", label: "Prompt coverage", weight: 15 },
  { key: "sentimentAccuracy", label: "Sentiment accuracy", weight: 10 },
] as const;

type MetricKey = (typeof COMPONENTS)[number]["key"];

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

async function latestPair(tenantId: number) {
  const [latest, previous] = await findRecentCompleteScans(tenantId, 2);
  if (!latest?.metrics) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No completed scan yet — dashboard data unlocks after the first scan.",
    });
  }
  return { latest, previous };
}

export const dashboardRouter = createRouter({
  /** Six KPI tiles with deltas vs. the previous scan (dashboard.md §S2). */
  kpis: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const db = getDb();
    const { latest, previous } = await latestPair(tenantId);
    const m = latest.metrics!;
    const p = previous?.metrics;

    const highImpactGaps = await db
      .select({ id: sources.id })
      .from(sources)
      .where(
        and(
          eq(sources.tenantId, tenantId),
          eq(sources.status, "missing"),
          eq(sources.impact, "high"),
        ),
      );

    // Leader = competitor with the top seeded score.
    const competitors = await db
      .select()
      .from(brands)
      .where(and(eq(brands.tenantId, tenantId), eq(brands.isPrimary, false)));
    const top = competitors.reduce<(typeof competitors)[number] | null>(
      (best, b) =>
        b.stats && (!best?.stats || b.stats.score > best.stats.score) ? b : best,
      null,
    );

    const delta = (key: MetricKey | "leadGap") =>
      p ? (m[key] as number) - (p[key] as number) : null;

    return {
      scanId: latest.id,
      scanDate: latest.completedAt,
      hasBaseline: !!p,
      kpis: [
        {
          id: "visibility_score",
          label: "AI Visibility Score",
          value: m.score,
          unit: "",
          context: p ? `${signed(m.score - p.score)} vs. last scan` : "Baseline scan",
          deltaText: p ? `${signed(m.score - p.score)} vs. last scan` : "BASELINE",
        },
        {
          id: "mention_rate",
          label: "Brand Mention Rate",
          value: m.mentionRate,
          unit: "%",
          context: "of monitored prompts",
          deltaText: p ? `${signed(delta("mentionRate")!)} pts` : "BASELINE",
        },
        {
          id: "recommendation_share",
          label: "Recommendation Share",
          value: m.recommendationShare,
          unit: "%",
          context: "of 'best option' lists",
          deltaText: p ? `${signed(delta("recommendationShare")!)} pts` : "BASELINE",
        },
        {
          id: "citation_strength",
          label: "Citation Strength",
          value: citationStrengthLabel(m.citationStrength),
          unit: "",
          context: `${highImpactGaps.length} gaps found`,
          deltaText: p
            ? `sub-score ${m.citationStrength}, ${signed(delta("citationStrength")!)}`
            : `sub-score ${m.citationStrength}`,
        },
        {
          id: "prompt_coverage",
          label: "Prompt Coverage",
          value: m.promptCoverage,
          unit: "%",
          context: "of priority prompts",
          deltaText: p ? `${signed(delta("promptCoverage")!)} pts` : "BASELINE",
        },
        {
          id: "competitor_lead_gap",
          label: "Competitor Lead Gap",
          value: m.leadGap,
          unit: "%",
          context: top ? `behind ${top.name}` : "no competitor seeded",
          deltaText: p
            ? `${signed(delta("leadGap")!)} pts (${delta("leadGap")! < 0 ? "closing" : "widening"})`
            : "BASELINE",
        },
      ],
    };
  }),

  /** Six bar rows, canonical engine order (dashboard.md §S3 left). */
  scoreByEngine: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const { latest } = await latestPair(tenantId);
    const scores = latest.metrics!.engineScores;
    const rows = (Object.keys(ENGINE_LABELS) as EngineId[]).map((engine) => ({
      engine,
      label: ENGINE_LABELS[engine],
      score: scores[engine] ?? 0,
    }));
    const values = rows.map((r) => r.score);
    return {
      rows,
      spread: values.length ? Math.max(...values) - Math.min(...values) : 0,
    };
  }),

  /** Component / weight / score / contribution table (dashboard.md §S3 right). */
  components: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const { latest } = await latestPair(tenantId);
    const m = latest.metrics!;
    const rows = COMPONENTS.map((c) => {
      const score = m[c.key];
      return {
        key: c.key,
        component: c.label,
        weight: c.weight,
        score,
        contribution: Math.round(c.weight * score) / 100,
      };
    });
    const raw = Math.round(rows.reduce((sum, r) => sum + r.contribution, 0) * 10) / 10;
    return {
      rows,
      composite: { weight: 100, raw, indexed: m.score },
      methodology: "Methodology v1.2 — weights fixed across tenants",
    };
  }),

  /** Weekly time series for the Recharts trend chart (dashboard.md §S4). */
  trend: authedQuery
    .input(z.object({ days: z.number().int().min(7).max(365).default(90) }).optional())
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const days = input?.days ?? 90;
      const rows = await getDb()
        .select()
        .from(scans)
        .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "complete")))
        .orderBy(desc(scans.completedAt));
      // Anchor the window to the latest scan, not the wall clock, so the
      // seeded demo history (Jul 2026) always fills the selected window.
      const anchor = rows[0]?.completedAt ?? new Date();
      const since = new Date(anchor.getTime() - days * 24 * 60 * 60 * 1000);
      const points = rows
        .filter((s) => s.metrics && (!s.completedAt || s.completedAt >= since))
        .reverse()
        .map((s) => ({
          scanId: s.id,
          date: s.completedAt,
          composite: s.metrics!.score,
          mentionRate: s.metrics!.mentionRate,
          recommendationShare: s.metrics!.recommendationShare,
          citationStrength: s.metrics!.citationStrength,
          promptCoverage: s.metrics!.promptCoverage,
          sentimentAccuracy: s.metrics!.sentimentAccuracy,
        }));
      return { points, baselineScanId: points.at(0)?.scanId ?? null };
    }),

  /** Scan history table (dashboard.md §S5.3). */
  scanHistory: authedQuery
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const rows = await getDb()
        .select()
        .from(scans)
        .where(eq(scans.tenantId, tenantId))
        .orderBy(desc(scans.startedAt))
        .limit(input?.limit ?? 10);
      return rows.map((s) => ({
        id: s.id,
        date: s.completedAt ?? s.startedAt,
        status: s.status,
        score: s.metrics?.score ?? null,
      }));
    }),

  /** Bottom-row cards: open alerts + 30/60/90 progress (dashboard.md §S5.1/2). */
  sidebarSummary: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const db = getDb();
    const openAlerts = await db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.tenantId, tenantId),
          inArray(alerts.status, ["open", "in_progress"]),
        ),
      )
      .orderBy(alerts.severity, desc(alerts.createdAt))
      .limit(3);

    const checklist = await db
      .select()
      .from(actions)
      .where(and(eq(actions.tenantId, tenantId), eq(actions.kind, "checklist")));
    const phases = (["d30", "d60", "d90"] as const).map((phase) => {
      const items = checklist.filter((a) => a.phase === phase);
      return {
        phase,
        total: items.length,
        done: items.filter((a) => a.status === "done").length,
      };
    });

    return { openAlerts, planPhases: phases };
  }),

  /** Mention-rate-by-category bars (also used by the report snapshot). */
  categoryRates: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const { latest } = await latestPair(tenantId);
    const rates = latest.metrics!.categoryRates;
    return (Object.keys(CATEGORY_LABELS) as CategoryId[]).map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      rate: rates[category] ?? 0,
    }));
  }),
});
