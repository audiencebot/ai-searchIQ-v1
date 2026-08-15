import { and, count, desc, eq, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { integrations, prompts, scans, tenantMembers, tenants, users } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { requireTenant } from "./tenant";

/**
 * Integration card presentation metadata (settings.md §S2). Status + meta are
 * tenant-scoped DB rows; name/role/icon are platform constants.
 */
const INTEGRATION_META = {
  gbp: {
    name: "Google Business Profile",
    icon: "solar:map-point-linear",
    role: "Listing, categories, service areas, reviews — ground truth for alerts.",
  },
  gsc: {
    name: "Google Search Console",
    icon: "solar:graph-up-linear",
    role: "Query demand grounds your prompt set.",
  },
  ga4: {
    name: "Google Analytics 4",
    icon: "solar:chart-2-linear",
    role: "AI-referral attribution: visibility → visits.",
    oauthNote: "OAuth 2.0 · read-only scope",
  },
  dataforseo: {
    name: "DataForSEO",
    icon: "solar:global-linear",
    role: "SERP overlap, keyword gaps, backlinks.",
  },
  lighthouse: {
    name: "Lighthouse",
    icon: "solar:shield-check-linear",
    role: "Technical audits that keep recommendations publishable.",
  },
} as const;

type Provider = keyof typeof INTEGRATION_META;

export const settingsRouter = createRouter({
  /** Integration connection cards (settings.md §S2). */
  integrations: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select()
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId));
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    return (Object.keys(INTEGRATION_META) as Provider[]).map((provider) => {
      const row = byProvider.get(provider);
      return {
        provider,
        ...INTEGRATION_META[provider],
        status: row?.status ?? "not_connected",
        meta: row?.meta ?? null,
      };
    });
  }),

  /** Connect/disconnect stub (settings.md §S2 — demo flips to Connected). */
  setIntegrationStatus: authedQuery
    .input(
      z.object({
        provider: z.enum(["gbp", "gsc", "ga4", "dataforseo", "lighthouse"]),
        status: z.enum(["connected", "not_connected", "platform_managed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      const existing = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, input.provider),
        ),
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Integration ${input.provider} not seeded for this tenant`,
        });
      }
      await db
        .update(integrations)
        .set({ status: input.status })
        .where(
          and(
            eq(integrations.tenantId, tenantId),
            eq(integrations.provider, input.provider),
          ),
        );
      return db.query.integrations.findFirst({
        where: and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, input.provider),
        ),
      });
    }),

  /** Business profile — the ground-truth record alerts validate against. */
  profile: authedQuery.query(async ({ ctx }) => {
    const { tenant } = await requireTenant(ctx.user.id);
    return {
      name: tenant.name,
      industry: tenant.industry,
      websiteUrl: tenant.websiteUrl,
      profile: tenant.profile,
    };
  }),

  /** Update ground-truth profile fields (settings.md §S3). */
  updateProfile: authedQuery
    .input(
      z.object({
        websiteUrl: z.string().max(512).optional(),
        profile: z.object({
          legalName: z.string().min(1),
          founded: z.number().int().min(1800).max(2100),
          serviceRegions: z.array(z.string().min(1)),
          services: z.array(z.string().min(1)),
          pricingVisibility: z.string(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      await db
        .update(tenants)
        .set({
          profile: input.profile,
          ...(input.websiteUrl ? { websiteUrl: input.websiteUrl } : {}),
        })
        .where(eq(tenants.id, tenantId));
      return db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    }),

  /** Member list (settings.md §S4). */
  members: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select({
        memberId: tenantMembers.id,
        role: tenantMembers.role,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        lastActive: users.lastSignInAt,
      })
      .from(tenantMembers)
      .innerJoin(users, eq(tenantMembers.userId, users.id))
      .where(eq(tenantMembers.tenantId, tenantId));
    return rows.map((r) => ({
      ...r,
      isYou: r.userId === ctx.user.id,
    }));
  }),

  /** Plan & usage (settings.md §S5). */
  plan: authedQuery.query(async ({ ctx }) => {
    const { tenantId, tenant } = await requireTenant(ctx.user.id);
    const db = getDb();
    const [promptCount] = await db
      .select({ value: count() })
      .from(prompts)
      .where(and(eq(prompts.tenantId, tenantId), eq(prompts.active, true)));
    // Scan usage counts the month of the latest scan (seeded demo data is
    // anchored to Jul 2026, not the wall clock).
    const latestScan = await db.query.scans.findFirst({
      where: eq(scans.tenantId, tenantId),
      orderBy: [desc(scans.startedAt)],
    });
    let scansThisMonth = 0;
    if (latestScan) {
      const monthStart = new Date(latestScan.startedAt);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [scanCount] = await db
        .select({ value: count() })
        .from(scans)
        .where(and(eq(scans.tenantId, tenantId), gte(scans.startedAt, monthStart)));
      scansThisMonth = scanCount?.value ?? 0;
    }
    return {
      plan: tenant.plan,
      priceMonthly: 1000,
      priceNote: "per tenant · unlimited seats",
      initialReport: {
        label: "Initial AI Visibility Report — purchased Jun 2026 ($399)",
        purchased: true,
      },
      usage: {
        promptsUsed: promptCount?.value ?? 0,
        promptsTotal: 12,
        enginesUsed: 6,
        enginesTotal: 6,
        scansThisMonth,
        reportStatus: "July delivered",
      },
    };
  }),
});
