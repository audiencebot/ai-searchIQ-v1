/**
 * HQ Phase 1.5 smoke script — run with: npx tsx scripts/smoke-hq15.ts
 *
 * Exercises, against the configured DATABASE_URL:
 *   1. createClient Zod — missing/invalid businessCategory rejected.
 *   2. Charge-before-report gate — triggerReport(initial_audit) blocked while
 *      auditPaid=false; monthly blocked on the report plan.
 *   3. Notifications query — awaiting_payment + in_review items appear.
 *   4. Review gate — triggerReport lands in_review (no client email);
 *      approveReport flips to sent, stamps checklist, emails contacts.
 *   5. Costs query math — Northwind demo tenant (read-only) + a paid
 *      report-plan fixture.
 *
 * Every row created here is deleted at the end (Northwind is read-only).
 * Exits non-zero on any failed expectation.
 */
import { eq } from "drizzle-orm";
import {
  clientContacts,
  emailLog,
  onboardingChecklists,
  reports,
  tenants,
} from "@db/schema";
import { appRouter } from "../api/router";
import { createClientInputSchema } from "../api/hq-router";
import { getDb } from "../api/queries/connection";
import { env } from "../api/lib/env";
import type { User } from "@db/schema";

let failures = 0;
function expect(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const VALID = {
  name: "HQ15 Smoke Test",
  websiteUrl: "https://smoke15.example.com",
  industry: "Testing",
  businessCategory: "consulting" as const,
  businessDescription: "Smoke fixture — safe to delete.",
  plan: "report" as const,
  primaryContact: { name: "Pat Primary", email: "pat15@example.com" },
  backupContact: { name: "Bob Backup", email: "bob15@example.com" },
};

function staffCaller() {
  const user = {
    id: 0,
    unionId: env.ownerUnionId || "smoke-owner",
    name: "HQ15 Smoke",
    role: "admin",
  } as User;
  if (!env.ownerUnionId) process.env.OWNER_UNION_ID = user.unionId;
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user,
  });
}

async function cleanup(tenantId: number) {
  const db = getDb();
  await db.delete(emailLog).where(eq(emailLog.tenantId, tenantId));
  await db.delete(reports).where(eq(reports.tenantId, tenantId));
  await db
    .delete(onboardingChecklists)
    .where(eq(onboardingChecklists.tenantId, tenantId));
  await db.delete(clientContacts).where(eq(clientContacts.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

async function main() {
  const caller = staffCaller();
  const db = getDb();

  console.log("== 1. createClient category validation ==");
  const missingCategory: Record<string, unknown> = { ...VALID };
  delete missingCategory.businessCategory;
  expect(
    "missing businessCategory rejected",
    !createClientInputSchema.safeParse(missingCategory).success,
  );
  expect(
    "invalid businessCategory rejected",
    !createClientInputSchema.safeParse({ ...VALID, businessCategory: "plumber" }).success,
  );
  expect(
    "over-long description rejected",
    !createClientInputSchema.safeParse({
      ...VALID,
      businessDescription: "x".repeat(2001),
    }).success,
  );
  expect("valid payload accepted", createClientInputSchema.safeParse(VALID).success);

  console.log("== 2. fixture client + payment gate ==");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const created = await caller.hq.createClient({ ...VALID, name: `HQ15 Smoke ${stamp}` });
  const tid = created.tenantId;
  expect("tenant created with category", tid > 0);

  let blocked = false;
  try {
    await caller.hq.triggerReport({ tenantId: tid, type: "initial_audit" });
  } catch (err) {
    blocked = err instanceof Error && err.message.includes("not been marked paid");
  }
  expect("initial_audit blocked when auditPaid=false", blocked);

  let monthlyBlocked = false;
  try {
    await caller.hq.triggerReport({ tenantId: tid, type: "monthly" });
  } catch (err) {
    monthlyBlocked = err instanceof Error && err.message.includes("Growth or Enterprise");
  }
  expect("monthly blocked on report plan", monthlyBlocked);

  console.log("== 3. notifications: awaiting_payment + in_review ==");
  // Simulate the google-callback flip (OAuth not exercised here).
  await db
    .update(onboardingChecklists)
    .set({ status: "awaiting_payment", googleConnectedAt: new Date() })
    .where(eq(onboardingChecklists.tenantId, tid));
  let notifs = await caller.hq.notifications();
  expect(
    "awaiting_payment item listed",
    notifs.some((n) => n.kind === "awaiting_payment" && n.tenantId === tid),
    JSON.stringify(notifs.slice(0, 3)),
  );

  // Pay, then kick the audit: should land in_review with NO client email.
  await caller.hq.setAuditPaid({ tenantId: tid, paid: true });
  const triggered = await caller.hq.triggerReport({ tenantId: tid, type: "initial_audit" });
  expect("triggerReport returns in_review", triggered.status === "in_review");
  notifs = await caller.hq.notifications();
  expect(
    "in_review item listed",
    notifs.some(
      (n) => n.kind === "in_review" && n.tenantId === tid && n.reportId === triggered.reportId,
    ),
  );
  const preApproveEmails = await db
    .select()
    .from(emailLog)
    .where(eq(emailLog.tenantId, tid));
  expect(
    "no client report email before approval",
    !preApproveEmails.some((e) => e.reportId === triggered.reportId && e.toEmail.includes("pat15")),
  );
  const detailInReview = await caller.hq.clientDetail({ tenantId: tid });
  expect(
    "checklist firstScanAt set, reportSentAt empty",
    detailInReview.checklist?.firstScanAt !== null &&
      detailInReview.checklist?.reportSentAt === null,
  );

  console.log("== 4. reviewReport + approveReport ==");
  const review = await caller.hq.reviewReport({ reportId: triggered.reportId });
  expect(
    "reviewReport returns payload + tenant",
    review.tenantName.includes("HQ15 Smoke") && review.report.payload !== null,
  );
  const approved = await caller.hq.approveReport({ reportId: triggered.reportId });
  expect("approveReport returns sent", approved.status === "sent");
  expect("two contacts emailed (logged)", approved.emailAttempts === 2);
  const detailAfter = await caller.hq.clientDetail({ tenantId: tid });
  const sentReport = detailAfter.reports.find((r) => r.id === triggered.reportId);
  expect(
    "report row is sent with completedAt",
    sentReport?.status === "sent" && sentReport.completedAt !== null,
  );
  expect(
    "checklist active + reportSentAt set",
    detailAfter.checklist?.status === "active" &&
      detailAfter.checklist.reportSentAt !== null,
  );
  expect("tenant flipped to active", detailAfter.tenant.status === "active");
  const logsAfter = await db
    .select()
    .from(emailLog)
    .where(eq(emailLog.reportId, triggered.reportId));
  expect(
    "report emails logged for both contacts",
    logsAfter.filter((l) => l.toEmail.includes("example.com")).length === 2,
    `got ${logsAfter.length}`,
  );
  notifs = await caller.hq.notifications();
  expect(
    "in_review bell item cleared after approval",
    !notifs.some((n) => n.kind === "in_review" && n.tenantId === tid),
  );

  console.log("== 5. costs query math ==");
  const all = await caller.hq.costs();
  const fixture = all.find((r) => r.tenantId === tid);
  expect(
    "fixture: paid report plan created in range → $399 revenue",
    fixture?.monthlyRevenue === 399,
    fixture ? JSON.stringify(fixture) : "row missing",
  );
  expect(
    "fixture: profit = revenue − cost",
    fixture !== undefined &&
      Math.abs(fixture.profit - (fixture.monthlyRevenue - fixture.costTotal)) < 1e-9,
  );
  // Northwind demo tenant (read-only): growth plan → $1,000 flat revenue.
  const northwind = all.find((r) => r.name === "Northwind Advisory");
  expect("Northwind present in costs", northwind !== undefined);
  if (northwind) {
    expect(
      "Northwind: growth → $1,000 revenue",
      northwind.monthlyRevenue === 1000,
      `got ${northwind.monthlyRevenue}`,
    );
    expect(
      "Northwind: costTotal equals DataForSEO spend",
      northwind.costTotal === northwind.dataForSeoSpend,
    );
    expect(
      "Northwind: profit = revenue − cost",
      Math.abs(northwind.profit - (northwind.monthlyRevenue - northwind.costTotal)) < 1e-9,
    );
    const ranged = await caller.hq.costs({
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date(),
    });
    const nwRanged = ranged.find((r) => r.name === "Northwind Advisory");
    expect(
      "Northwind: range filter keeps revenue, spend ≤ all-time spend",
      nwRanged !== undefined &&
        nwRanged.monthlyRevenue === 1000 &&
        nwRanged.dataForSeoSpend <= northwind.dataForSeoSpend + 1e-9,
    );
  }

  console.log("== cleanup ==");
  await cleanup(tid);
  const gone = await db.query.tenants.findFirst({ where: eq(tenants.id, tid) });
  expect("fixture tenant deleted", gone === undefined);

  console.log(
    failures === 0
      ? "\nALL HQ15 SMOKE CHECKS PASSED"
      : `\n${failures} HQ15 SMOKE CHECK(S) FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke-hq15 crashed:", err);
  process.exit(1);
});
