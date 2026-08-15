import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { reportMonths } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { requireTenant } from "./tenant";

/**
 * Monthly AI Visibility Report (report.md).
 *
 * Reports are served from `report_months.payload` — assembled snapshots frozen
 * at generation time — so archive months render exactly as delivered (report.md
 * §S3) instead of drifting with live scan data. This was chosen over deriving
 * reports live from scans.
 */
export const reportRouter = createRouter({
  /** Archive list for the month selector (report.md §S1). */
  list: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select()
      .from(reportMonths)
      .where(eq(reportMonths.tenantId, tenantId))
      .orderBy(desc(reportMonths.month));
    return rows.map((r) => ({
      month: r.month,
      reportId: r.reportId,
      generatedAt: r.generatedAt,
    }));
  }),

  /** Full section payload for one month (default: current/latest). */
  byMonth: authedQuery
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      const row = input?.month
        ? await db.query.reportMonths.findFirst({
            where: and(
              eq(reportMonths.tenantId, tenantId),
              eq(reportMonths.month, input.month),
            ),
          })
        : await db.query.reportMonths.findFirst({
            where: eq(reportMonths.tenantId, tenantId),
            orderBy: [desc(reportMonths.month)],
          });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: input?.month
            ? `No report for ${input.month}`
            : "No report generated yet",
        });
      }
      return {
        month: row.month,
        reportId: row.reportId,
        generatedAt: row.generatedAt,
        payload: row.payload,
      };
    }),
});
