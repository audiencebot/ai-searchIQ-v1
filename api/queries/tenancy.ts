import { and, desc, eq } from "drizzle-orm";
import { scans, tenantMembers } from "@db/schema";
import { getDb } from "./connection";

/** Latest membership (with tenant) for a user, or undefined. */
export async function findMembershipWithTenant(userId: number) {
  return getDb().query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, userId),
    with: { tenant: true },
  });
}

/** Latest completed scan for a tenant (the scan all dashboard data reads from). */
export async function findLatestCompleteScan(tenantId: number) {
  return getDb().query.scans.findFirst({
    where: and(eq(scans.tenantId, tenantId), eq(scans.status, "complete")),
    orderBy: [desc(scans.completedAt)],
  });
}

/** The two most recent completed scans, newest first (latest + delta baseline). */
export async function findRecentCompleteScans(tenantId: number, limit = 2) {
  return getDb()
    .select()
    .from(scans)
    .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "complete")))
    .orderBy(desc(scans.completedAt))
    .limit(limit);
}
