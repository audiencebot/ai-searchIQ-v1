import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { alerts } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { requireTenant } from "./tenant";

const statusEnum = z.enum(["open", "in_progress", "resolved", "verified"]);

/**
 * Lifecycle order — alerts move forward through
 * open → in_progress → resolved → verified (alerts.md §S3 stepper).
 */
const STATUS_ORDER = ["open", "in_progress", "resolved", "verified"] as const;

export const alertsRouter = createRouter({
  /** Alert feed, severity-first (alerts.md §S3). */
  list: authedQuery
    .input(
      z
        .object({
          status: statusEnum.optional(),
          severity: z.enum(["high", "medium", "low"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      return getDb()
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.tenantId, tenantId),
            input?.status ? eq(alerts.status, input.status) : undefined,
            input?.severity ? eq(alerts.severity, input.severity) : undefined,
          ),
        )
        // enum columns sort by enum index: high → medium → low
        .orderBy(alerts.severity, desc(alerts.createdAt));
    }),

  /** Status filter-chip counts (alerts.md §S1). */
  counts: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select({ status: alerts.status })
      .from(alerts)
      .where(eq(alerts.tenantId, tenantId));
    return {
      open: rows.filter((r) => r.status === "open").length,
      inProgress: rows.filter((r) => r.status === "in_progress").length,
      // "Resolved" chip groups both resolved and verified
      resolved: rows.filter(
        (r) => r.status === "resolved" || r.status === "verified",
      ).length,
      verified: rows.filter((r) => r.status === "verified").length,
      total: rows.length,
    };
  }),

  /**
   * Lifecycle mutation — advance an alert along
   * open → in_progress → resolved → verified. Backward moves are rejected;
   * `resolvedAt` is stamped when the alert first reaches resolved.
   */
  updateStatus: authedQuery
    .input(z.object({ id: z.number().int().positive(), status: statusEnum }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      const alert = await db.query.alerts.findFirst({
        where: and(eq(alerts.id, input.id), eq(alerts.tenantId, tenantId)),
      });
      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }
      const from = STATUS_ORDER.indexOf(alert.status);
      const to = STATUS_ORDER.indexOf(input.status);
      if (to < from) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot move alert backwards from ${alert.status} to ${input.status}`,
        });
      }
      if (to === from) return alert;
      await db
        .update(alerts)
        .set({
          status: input.status,
          resolvedAt:
            (input.status === "resolved" || input.status === "verified") &&
            !alert.resolvedAt
              ? new Date()
              : alert.resolvedAt,
        })
        .where(and(eq(alerts.id, input.id), eq(alerts.tenantId, tenantId)));
      return db.query.alerts.findFirst({
        where: and(eq(alerts.id, input.id), eq(alerts.tenantId, tenantId)),
      });
    }),
});
