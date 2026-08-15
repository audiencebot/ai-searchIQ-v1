import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actions } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { requireTenant } from "./tenant";

const PHASE_META = {
  d30: { label: "Days 1–30 · Stabilize", theme: "Quick Wins" },
  d60: { label: "Days 31–60 · Build", theme: "Content & Schema" },
  d90: { label: "Days 61–90 · Expand", theme: "Authority" },
} as const;

type Phase = keyof typeof PHASE_META;

/** Valid status sets per action kind. */
const KIND_STATUSES = {
  roadmap: ["suggested", "accepted", "in_progress", "done"],
  checklist: ["todo", "in_progress", "done"],
} as const;

export const actionPlanRouter = createRouter({
  /** Optimization roadmap — 8 cards ordered by priority (action-plan.md §S2). */
  roadmap: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    return getDb()
      .select()
      .from(actions)
      .where(and(eq(actions.tenantId, tenantId), eq(actions.kind, "roadmap")))
      .orderBy(asc(actions.priority));
  }),

  /** 30/60/90 checklist grouped by phase with progress (action-plan.md §S3). */
  checklist: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select()
      .from(actions)
      .where(and(eq(actions.tenantId, tenantId), eq(actions.kind, "checklist")))
      .orderBy(asc(actions.sortOrder));
    const phases = (Object.keys(PHASE_META) as Phase[]).map((phase) => {
      const items = rows.filter((r) => r.phase === phase);
      return {
        phase,
        label: PHASE_META[phase].label,
        theme: PHASE_META[phase].theme,
        total: items.length,
        done: items.filter((i) => i.status === "done").length,
        items,
      };
    });
    return {
      phases,
      total: rows.length,
      done: rows.filter((r) => r.status === "done").length,
    };
  }),

  /** Header progress chip: "Plan progress: 3 of 12 items done". */
  progress: authedQuery.query(async ({ ctx }) => {
    const { tenantId } = await requireTenant(ctx.user.id);
    const rows = await getDb()
      .select({ status: actions.status, kind: actions.kind })
      .from(actions)
      .where(and(eq(actions.tenantId, tenantId), eq(actions.kind, "checklist")));
    return {
      done: rows.filter((r) => r.status === "done").length,
      total: rows.length,
    };
  }),

  /** Status lifecycle mutation for roadmap cards and checklist items. */
  updateStatus: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["suggested", "accepted", "todo", "in_progress", "done"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await requireTenant(ctx.user.id);
      const db = getDb();
      const action = await db.query.actions.findFirst({
        where: and(eq(actions.id, input.id), eq(actions.tenantId, tenantId)),
      });
      if (!action) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Action not found" });
      }
      const valid = KIND_STATUSES[action.kind] as readonly string[];
      if (!valid.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Status ${input.status} is not valid for a ${action.kind} item`,
        });
      }
      await db
        .update(actions)
        .set({ status: input.status })
        .where(and(eq(actions.id, input.id), eq(actions.tenantId, tenantId)));
      return db.query.actions.findFirst({
        where: and(eq(actions.id, input.id), eq(actions.tenantId, tenantId)),
      });
    }),
});
