import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { tenantMembers, tenants } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { findMembershipWithTenant } from "./queries/tenancy";

/**
 * DEMO TENANT — "Northwind Advisory", seeded by db/seed.ts.
 *
 * MVP DEMO BEHAVIOR: there is no self-service tenant onboarding yet, so the
 * first login of any user with no membership attaches them (as admin) to this
 * seeded demo tenant. Replace with real onboarding/invites post-MVP.
 */
export const DEMO_TENANT_NAME = "Northwind Advisory";

export const bootstrapRouter = createRouter({
  /** Current membership + tenant, or null when the user has none yet. */
  status: authedQuery.query(async ({ ctx }) => {
    const membership = await findMembershipWithTenant(ctx.user.id);
    if (!membership) return null;
    return {
      tenantId: membership.tenantId,
      role: membership.role,
      tenant: membership.tenant,
    };
  }),

  /**
   * Idempotent provisioning: returns the existing membership, or creates one
   * on the seeded demo tenant (see comment above). Safe to call on every
   * portal mount.
   *
   * Plan tiers: this mutation never inserts tenants — the tenants.plan schema
   * default is 'report' ($399 baseline), so any newly provisioned tenant row
   * starts on the Initial Report tier until upgraded to growth/enterprise.
   */
  ensure: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const existing = await findMembershipWithTenant(ctx.user.id);
    if (existing) {
      return {
        provisioned: false,
        tenantId: existing.tenantId,
        role: existing.role,
        tenant: existing.tenant,
      };
    }
    const demoTenant = await db.query.tenants.findFirst({
      where: eq(tenants.name, DEMO_TENANT_NAME),
    });
    if (!demoTenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message:
          "Demo tenant is not seeded yet — run `npx tsx db/seed.ts` first.",
      });
    }
    await db
      .insert(tenantMembers)
      .values({ userId: ctx.user.id, tenantId: demoTenant.id, role: "admin" })
      .onDuplicateKeyUpdate({ set: { role: "admin" } });
    return {
      provisioned: true,
      tenantId: demoTenant.id,
      role: "admin" as const,
      tenant: demoTenant,
    };
  }),
});
