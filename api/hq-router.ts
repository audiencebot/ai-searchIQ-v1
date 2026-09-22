import { randomBytes } from "crypto";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  clientContacts,
  emailLog,
  integrationCache,
  integrations,
  onboardingChecklists,
  reports,
  tenants,
} from "@db/schema";
import type { ReportPayload } from "@db/schema";
import { PLAN_TIERS } from "@contracts/constants";
import { createRouter, authedQuery, hqProcedure } from "./middleware";
import { isStaff } from "./staff";
import { getDb } from "./queries/connection";
import { emailFrom, isEmailConfigured, inviteEmail, reportReadyEmail, sendEmail } from "./services/email";
import { findLatestCompleteScan } from "./queries/tenancy";
import { GOOGLE_SERVICES } from "./services/google";

/**
 * HQ admin router (client-management-plan.md §6) — staff-only procedures for
 * client management, onboarding, report kickoff, and email delivery proof.
 * Every procedure except `access` runs behind hqProcedure (OWNER_UNION_ID).
 */

const hex32 = () => randomBytes(16).toString("hex");
const newIngestToken = () => `asiq_${hex32()}`;
const newInviteToken = () => `asiq_inv_${hex32()}`;

const contactInput = z.object({
  name: z.string().trim().min(1, "Contact name is required").max(255),
  email: z.string().trim().email("A valid email address is required").max(320),
});

const planSchema = z.enum(PLAN_TIERS);
const reportTypeSchema = z.enum(["initial_audit", "monthly"]);

/** Exported for the smoke script — single source of truth for validation. */
export const createClientInputSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(255),
  websiteUrl: z.string().trim().min(3, "Website is required").max(512),
  industry: z.string().trim().min(1, "Industry is required").max(255),
  plan: planSchema,
  primaryContact: contactInput,
  backupContact: contactInput,
});

const REPORT_TYPE_LABELS: Record<z.infer<typeof reportTypeSchema>, string> = {
  initial_audit: "Initial Audit",
  monthly: "Monthly Report",
};

function periodLabelFor(type: z.infer<typeof reportTypeSchema>, when = new Date()): string {
  const month = when.toLocaleString("en-US", { month: "long", year: "numeric" });
  return type === "initial_audit" ? `Initial audit · ${month}` : month;
}

function requestOrigin(req: Request): string {
  return new URL(req.url).origin;
}

/** Invite link path for a checklist token (public connect page). */
function invitePath(inviteToken: string): string {
  return `/connect/${inviteToken}`;
}

async function requireTenantRow(tenantId: number) {
  const tenant = await getDb().query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  if (!tenant) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
  }
  return tenant;
}

async function requireChecklist(tenantId: number) {
  const checklist = await getDb().query.onboardingChecklists.findFirst({
    where: eq(onboardingChecklists.tenantId, tenantId),
  });
  if (!checklist) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No onboarding checklist for this client.",
    });
  }
  return checklist;
}

export const hqRouter = createRouter({
  /** Non-throwing staff check for the client shell (show/hide HQ nav). */
  access: authedQuery.query(({ ctx }) => ({ staff: isStaff(ctx.user) })),

  /** HQ Dashboard KPIs (plan §6 screen 1). */
  overview: hqProcedure.query(async () => {
    const db = getDb();

    const statusRows = await db
      .select({ status: tenants.status, value: count() })
      .from(tenants)
      .groupBy(tenants.status);
    const byStatus: Record<string, number> = {
      onboarding: 0,
      active: 0,
      paused: 0,
      churned: 0,
    };
    for (const r of statusRows) byStatus[r.status] = r.value;

    // Audits pending kickoff: onboarding tenants with no completed initial audit.
    const [auditsPending] = await db
      .select({ value: count() })
      .from(tenants)
      .where(
        and(
          eq(tenants.status, "onboarding"),
          isNull(
            sql`(
              SELECT r.id FROM reports r
              WHERE r.tenantId = ${tenants.id}
                AND r.type = 'initial_audit' AND r.status = 'complete'
              LIMIT 1
            )`,
          ),
        ),
      );

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [reportsThisMonth] = await db
      .select({ value: count() })
      .from(reports)
      .where(gte(reports.createdAt, monthStart));

    const [failedEmails] = await db
      .select({ value: count() })
      .from(emailLog)
      .where(eq(emailLog.status, "failed"));

    // MRR: Growth tenants × $1,000 (churned tenants excluded).
    const [growthTenants] = await db
      .select({ value: count() })
      .from(tenants)
      .where(and(eq(tenants.plan, "growth"), sql`${tenants.status} != 'churned'`));
    const mrr = (growthTenants?.value ?? 0) * 1000;

    // DataForSEO spend: actual per-task cost is stored in the cached payload
    // meta (services/dataforseo.ts). Null when nothing has been billed yet.
    const [spend] = await db
      .select({
        value: sql<number | null>`SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.meta.cost')) AS DECIMAL(12,4)))`,
      })
      .from(integrationCache)
      .where(eq(integrationCache.provider, "dataforseo"));

    return {
      byStatus,
      auditsPendingKickoff: auditsPending?.value ?? 0,
      reportsThisMonth: reportsThisMonth?.value ?? 0,
      failedEmails: failedEmails?.value ?? 0,
      mrr,
      dataForSeoSpend: spend?.value ?? null,
    };
  }),

  /** Clients list (plan §6 screen 2). */
  clients: hqProcedure.query(async () => {
    const db = getDb();
    const allTenants = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));
    if (allTenants.length === 0) return [];

    const ids = allTenants.map((t) => t.id);
    const [contactRows, integrationRows, checklistRows, reportRows] =
      await Promise.all([
        db
          .select({ tenantId: clientContacts.tenantId, value: count() })
          .from(clientContacts)
          .where(inArray(clientContacts.tenantId, ids))
          .groupBy(clientContacts.tenantId),
        db
          .select({ tenantId: integrations.tenantId, value: count() })
          .from(integrations)
          .where(
            and(
              inArray(integrations.tenantId, ids),
              inArray(integrations.provider, [...GOOGLE_SERVICES]),
              eq(integrations.status, "connected"),
            ),
          )
          .groupBy(integrations.tenantId),
        db
          .select()
          .from(onboardingChecklists)
          .where(inArray(onboardingChecklists.tenantId, ids)),
        db
          .select()
          .from(reports)
          .where(inArray(reports.tenantId, ids))
          .orderBy(desc(reports.createdAt)),
      ]);

    const contactsBy = new Map(contactRows.map((r) => [r.tenantId, r.value]));
    const googleBy = new Map(integrationRows.map((r) => [r.tenantId, r.value]));
    const checklistBy = new Map(checklistRows.map((r) => [r.tenantId, r]));
    const lastReportBy = new Map<number, (typeof reportRows)[number]>();
    for (const r of reportRows) {
      if (!lastReportBy.has(r.tenantId)) lastReportBy.set(r.tenantId, r);
    }

    return allTenants.map((t) => {
      const checklist = checklistBy.get(t.id);
      const lastReport = lastReportBy.get(t.id) ?? null;
      return {
        tenant: t,
        contactsCount: contactsBy.get(t.id) ?? 0,
        googleConnected: googleBy.get(t.id) ?? 0,
        checklistStatus: checklist?.status ?? null,
        lastReport: lastReport
          ? {
              id: lastReport.id,
              type: lastReport.type,
              status: lastReport.status,
              periodLabel: lastReport.periodLabel,
              createdAt: lastReport.createdAt,
            }
          : null,
      };
    });
  }),

  /** Client detail (plan §6 screen 3). */
  clientDetail: hqProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const tenant = await requireTenantRow(input.tenantId);
      const [contacts, checklist, integrationRows, reportRows, emailRows] =
        await Promise.all([
          db
            .select()
            .from(clientContacts)
            .where(eq(clientContacts.tenantId, input.tenantId))
            .orderBy(clientContacts.createdAt),
          db.query.onboardingChecklists.findFirst({
            where: eq(onboardingChecklists.tenantId, input.tenantId),
          }),
          db
            .select()
            .from(integrations)
            .where(eq(integrations.tenantId, input.tenantId)),
          db
            .select()
            .from(reports)
            .where(eq(reports.tenantId, input.tenantId))
            .orderBy(desc(reports.createdAt))
            .limit(50),
          db
            .select()
            .from(emailLog)
            .where(eq(emailLog.tenantId, input.tenantId))
            .orderBy(desc(emailLog.createdAt))
            .limit(50),
        ]);
      return {
        tenant,
        contacts,
        checklist: checklist ?? null,
        invitePath: checklist?.inviteToken ? invitePath(checklist.inviteToken) : null,
        integrations: integrationRows.map((row) => ({
          provider: row.provider,
          status: row.status,
          connectedAt: row.connectedAt,
          accountLabel:
            (row.credentials as { accountLabel?: string } | null)?.accountLabel ??
            null,
          externalAccountId: row.externalAccountId,
        })),
        reports: reportRows,
        emailLog: emailRows,
      };
    }),

  /** New Client form (plan §4 steps 1–3): tenant + 2 contacts + checklist. */
  createClient: hqProcedure
    .input(createClientInputSchema)
    .mutation(async ({ input }) => {
      const db = getDb();
      const ingestToken = newIngestToken();
      const inviteToken = newInviteToken();

      const [inserted] = await db
        .insert(tenants)
        .values({
          name: input.name,
          websiteUrl: input.websiteUrl,
          industry: input.industry,
          plan: input.plan,
          status: "onboarding",
          ingestToken,
        })
        .$returningId();
      const tenantId = inserted.id;

      await db.insert(clientContacts).values([
        {
          tenantId,
          name: input.primaryContact.name,
          email: input.primaryContact.email,
          role: "primary" as const,
          notifyReports: true,
        },
        {
          tenantId,
          name: input.backupContact.name,
          email: input.backupContact.email,
          role: "backup" as const,
          notifyReports: true,
        },
      ]);
      await db.insert(onboardingChecklists).values({ tenantId, inviteToken });

      return { tenantId, inviteToken, invitePath: invitePath(inviteToken) };
    }),

  updateClient: hqProcedure
    .input(
      z.object({
        tenantId: z.number().int().positive(),
        name: z.string().trim().min(1).max(255).optional(),
        websiteUrl: z.string().trim().min(3).max(512).optional(),
        industry: z.string().trim().min(1).max(255).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { tenantId, ...patch } = input;
      await requireTenantRow(tenantId);
      const set = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(set).length > 0) {
        await getDb().update(tenants).set(set).where(eq(tenants.id, tenantId));
      }
      return { ok: true as const };
    }),

  addContact: hqProcedure
    .input(
      z.object({
        tenantId: z.number().int().positive(),
        name: contactInput.shape.name,
        email: contactInput.shape.email,
        role: z.enum(["primary", "backup"]).default("backup"),
        notifyReports: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await requireTenantRow(input.tenantId);
      if (input.role === "primary") {
        const [existing] = await db
          .select({ value: count() })
          .from(clientContacts)
          .where(
            and(
              eq(clientContacts.tenantId, input.tenantId),
              eq(clientContacts.role, "primary"),
            ),
          );
        if ((existing?.value ?? 0) > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This client already has a primary contact.",
          });
        }
      }
      const [inserted] = await db
        .insert(clientContacts)
        .values({
          tenantId: input.tenantId,
          name: input.name,
          email: input.email,
          role: input.role,
          notifyReports: input.notifyReports,
        })
        .$returningId();
      return { ok: true as const, contactId: inserted.id };
    }),

  /** Guard (plan §3): a client must always keep at least one primary contact. */
  removeContact: hqProcedure
    .input(z.object({ contactId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const contact = await db.query.clientContacts.findFirst({
        where: eq(clientContacts.id, input.contactId),
      });
      if (!contact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found." });
      }
      if (contact.role === "primary") {
        const [primaries] = await db
          .select({ value: count() })
          .from(clientContacts)
          .where(
            and(
              eq(clientContacts.tenantId, contact.tenantId),
              eq(clientContacts.role, "primary"),
            ),
          );
        if ((primaries?.value ?? 0) <= 1) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "A client must always have at least one primary contact.",
          });
        }
      }
      await db.delete(clientContacts).where(eq(clientContacts.id, input.contactId));
      return { ok: true as const };
    }),

  setPlan: hqProcedure
    .input(z.object({ tenantId: z.number().int().positive(), plan: planSchema }))
    .mutation(async ({ input }) => {
      await requireTenantRow(input.tenantId);
      await getDb()
        .update(tenants)
        .set({ plan: input.plan })
        .where(eq(tenants.id, input.tenantId));
      return { ok: true as const };
    }),

  setAuditPaid: hqProcedure
    .input(
      z.object({ tenantId: z.number().int().positive(), paid: z.boolean() }),
    )
    .mutation(async ({ input }) => {
      await requireTenantRow(input.tenantId);
      await getDb()
        .update(tenants)
        .set({ auditPaid: input.paid })
        .where(eq(tenants.id, input.tenantId));
      return { ok: true as const };
    }),

  /** Onboarding step 4: email the secure connect link to both contacts. */
  sendInvite: hqProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const tenant = await requireTenantRow(input.tenantId);
      const checklist = await requireChecklist(input.tenantId);
      if (!checklist.inviteToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This client has no invite token.",
        });
      }
      const contacts = await db
        .select()
        .from(clientContacts)
        .where(eq(clientContacts.tenantId, input.tenantId));
      if (contacts.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Add at least one contact before sending the invite.",
        });
      }
      const inviteUrl = `${requestOrigin(ctx.req)}${invitePath(checklist.inviteToken)}`;
      const template = inviteEmail({ clientName: tenant.name, inviteUrl });
      const results = [];
      for (const contact of contacts) {
        results.push(
          await sendEmail({
            to: contact.email,
            subject: template.subject,
            html: template.html,
            tenantId: input.tenantId,
          }),
        );
      }
      await db
        .update(onboardingChecklists)
        .set({ status: "invited", inviteSentAt: new Date() })
        .where(eq(onboardingChecklists.tenantId, input.tenantId));
      return {
        ok: results.every((r) => r.ok),
        sent: results.filter((r) => r.ok).length,
        total: results.length,
      };
    }),

  /**
   * Kick off (plan §4 step 5): run a report, then email every notifyReports
   * contact. Phase 1 builds a minimal payload summarizing available data.
   * TODO(phase-2): wire the real report module once report-router exposes a
   * reusable generation entry point (it currently only reads report_months).
   */
  triggerReport: hqProcedure
    .input(
      z.object({ tenantId: z.number().int().positive(), type: reportTypeSchema }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const tenant = await requireTenantRow(input.tenantId);

      const [inserted] = await db
        .insert(reports)
        .values({
          tenantId: input.tenantId,
          type: input.type,
          periodLabel: periodLabelFor(input.type),
          status: "running",
        })
        .$returningId();
      const reportId = inserted.id;

      // Minimal payload: latest completed scan score + integration coverage.
      const [latestScan, googleRows] = await Promise.all([
        findLatestCompleteScan(input.tenantId),
        db
          .select({ value: count() })
          .from(integrations)
          .where(
            and(
              eq(integrations.tenantId, input.tenantId),
              inArray(integrations.provider, [...GOOGLE_SERVICES]),
              eq(integrations.status, "connected"),
            ),
          ),
      ]);
      const payload: ReportPayload = {
        headlineScore: latestScan?.metrics?.score,
        integrationsConnected: googleRows[0]?.value ?? 0,
        summary: latestScan
          ? `Based on the latest completed scan (${latestScan.completedAt?.toISOString() ?? "unknown date"}).`
          : "No completed scan data yet — this is a baseline kickoff report.",
        generatedAt: new Date().toISOString(),
      };
      await db
        .update(reports)
        .set({ status: "complete", payload, completedAt: new Date() })
        .where(eq(reports.id, reportId));

      // Checklist + tenant lifecycle: kickoff completed → active.
      const checklist = await db.query.onboardingChecklists.findFirst({
        where: eq(onboardingChecklists.tenantId, input.tenantId),
      });
      const now = new Date();
      if (checklist) {
        await db
          .update(onboardingChecklists)
          .set({
            status: "active",
            firstScanAt: checklist.firstScanAt ?? now,
            reportSentAt: now,
          })
          .where(eq(onboardingChecklists.tenantId, input.tenantId));
      }
      await db
        .update(tenants)
        .set({ status: "active" })
        .where(eq(tenants.id, input.tenantId));

      // Notify every contact with notifyReports=true (plan §5).
      const contacts = await db
        .select()
        .from(clientContacts)
        .where(
          and(
            eq(clientContacts.tenantId, input.tenantId),
            eq(clientContacts.notifyReports, true),
          ),
        );
      const origin = requestOrigin(ctx.req);
      const template = reportReadyEmail({
        clientName: tenant.name,
        reportType: REPORT_TYPE_LABELS[input.type],
        periodLabel: periodLabelFor(input.type),
        portalUrl: `${origin}/app/report`,
        headlineScore: payload.headlineScore,
      });
      const results = [];
      for (const contact of contacts) {
        results.push(
          await sendEmail({
            to: contact.email,
            subject: template.subject,
            html: template.html,
            tenantId: input.tenantId,
            reportId,
          }),
        );
      }
      return {
        reportId,
        status: "complete" as const,
        emailed: results.filter((r) => r.ok).length,
        emailAttempts: results.length,
      };
    }),

  /**
   * Resend a logged email (new email_log row preserves the audit trail).
   * The original HTML body is not stored, so the resend re-sends the
   * notification with the same subject and a branded pointer to the portal.
   */
  resendEmail: hqProcedure
    .input(z.object({ emailLogId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const entry = await db.query.emailLog.findFirst({
        where: eq(emailLog.id, input.emailLogId),
      });
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found." });
      }
      const tenant = await requireTenantRow(entry.tenantId);
      const origin = requestOrigin(ctx.req);
      const html = `
        <div style="font-family:Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;background-color:#F8FBFC;padding:32px 16px;">
          <div style="max-width:560px;margin:0 auto;">
            <div style="background-color:#07161D;border-radius:2px;padding:20px 28px;">
              <span style="color:#FFFFFF;font-size:15px;">AI Search <span style="color:#83D6FA;">IQ</span></span>
            </div>
            <div style="background-color:#FFFFFF;border:1px solid #BDEAFF;border-top:none;border-radius:2px;padding:32px 28px;">
              <h1 style="color:#07161D;font-size:18px;margin:0 0 14px;">${entry.subject}</h1>
              <p style="color:#10242D;font-size:14px;line-height:1.7;margin:0 0 18px;">
                This is a re-send of an earlier notification for <strong>${tenant.name}</strong>.
                Your latest report and data are available in the portal.
              </p>
              <a href="${origin}/app/report" style="display:inline-block;background-color:#3289AE;color:#FFFFFF;text-decoration:none;font-size:13px;padding:11px 22px;border-radius:2px;">Open the portal</a>
            </div>
          </div>
        </div>`;
      const result = await sendEmail({
        to: entry.toEmail,
        subject: entry.subject,
        html,
        tenantId: entry.tenantId,
        reportId: entry.reportId,
      });
      return { ok: result.ok, entry: result.entry };
    }),

  /** Global email delivery log (plan §6 screen 4), newest first. */
  emailLog: hqProcedure
    .input(
      z
        .object({
          tenantId: z.number().int().positive().optional(),
          status: z.enum(["pending", "sent", "failed"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.tenantId) conditions.push(eq(emailLog.tenantId, input.tenantId));
      if (input?.status) conditions.push(eq(emailLog.status, input.status));
      const rows = await db
        .select({
          entry: emailLog,
          tenantName: tenants.name,
          reportType: reports.type,
          reportPeriod: reports.periodLabel,
        })
        .from(emailLog)
        .innerJoin(tenants, eq(emailLog.tenantId, tenants.id))
        .leftJoin(reports, eq(emailLog.reportId, reports.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(emailLog.createdAt))
        .limit(200);
      return rows;
    }),

  /** Global reports queue/history across all clients (plan §6 screen 4). */
  reportsList: hqProcedure.query(async () => {
    const db = getDb();
    return db
      .select({
        report: reports,
        tenantName: tenants.name,
      })
      .from(reports)
      .innerJoin(tenants, eq(reports.tenantId, tenants.id))
      .orderBy(desc(reports.createdAt))
      .limit(200);
  }),

  /** HQ Settings: email provider status (env-only, no secrets). */
  emailStatus: hqProcedure.query(() => ({
    configured: isEmailConfigured(),
    from: emailFrom(),
  })),
});
