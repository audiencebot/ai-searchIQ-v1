import type { User } from "@db/schema";
import { env } from "./lib/env";

/**
 * Staff gating for the HQ admin area (client-management-plan.md §1).
 * Starts as the single OWNER_UNION_ID; upgradable to a `staff` table later.
 */
export function isStaff(user: Pick<User, "unionId"> | null | undefined): boolean {
  return Boolean(
    user?.unionId && env.ownerUnionId && user.unionId === env.ownerUnionId,
  );
}
