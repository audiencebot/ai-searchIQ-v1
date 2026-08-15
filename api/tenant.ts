import { TRPCError } from "@trpc/server";
import { findMembershipWithTenant } from "./queries/tenancy";

/**
 * Resolve the authenticated caller's tenant via tenant_members.
 * EVERY portal router must go through this — it is the tenant-isolation
 * boundary. Callers with no membership get PRECONDITION_FAILED and the
 * client should call `bootstrap.ensure` (MVP demo provisioning).
 */
export async function requireTenant(userId: number) {
  const membership = await findMembershipWithTenant(userId);
  if (!membership) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No tenant membership — call bootstrap.ensure first.",
    });
  }
  return membership; // { id, userId, tenantId, role, tenant }
}
