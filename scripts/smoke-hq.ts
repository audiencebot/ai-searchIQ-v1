/**
 * HQ Phase 1 smoke script — run with: npx tsx scripts/smoke-hq.ts
 *
 * Exercises, against the configured DATABASE_URL:
 *   1. createClient Zod validation — bad email and missing backup are rejected
 *      before any DB write.
 *   2. createClient live — creates a "HQ Smoke Test …" tenant (left in place,
 *      clearly named) with contacts + checklist.
 *   3. Email service with no RESEND_API_KEY — send attempt logs status
 *      'pending' with 'RESEND_API_KEY not configured' and never throws.
 *   4. triggerReport live — report row completes and notifyReports contacts
 *      get logged email attempts.
 *   5. Invite token lookup — unknown token, valid token, and 7-day expiry.
 *
 * Non-destructive: only INSERTs (plus one checklist timestamp flip that is
 * restored). Exits non-zero on any failed expectation.
 */
import { eq } from "drizzle-orm";
import { emailLog, onboardingChecklists } from "@db/schema";
import { appRouter } from "../api/router";
import { createClientInputSchema } from "../api/hq-router";
import { lookupInvite, INVITE_TTL_MS } from "../api/connect-router";
import { isEmailConfigured } from "../api/services/email";
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
  name: "HQ Smoke Test",
  websiteUrl: "https://smoke.example.com",
  industry: "Testing",
  plan: "report" as const,
  primaryContact: { name: "Pat Primary", email: "pat@example.com" },
  backupContact: { name: "Bob Backup", email: "bob@example.com" },
};

function staffCaller() {
  const user = {
    id: 0,
    unionId: env.ownerUnionId || "smoke-owner",
    name: "HQ Smoke",
    role: "admin",
  } as User;
  // isStaff() compares against env.ownerUnionId; force-match when env is empty.
  if (!env.ownerUnionId) process.env.OWNER_UNION_ID = user.unionId;
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user,
  });
}

async function main() {
  console.log("== 1. createClient Zod validation ==");
  expect(
    "bad primary email rejected",
    !createClientInputSchema.safeParse({
      ...VALID,
      primaryContact: { name: "Pat", email: "not-an-email" },
    }).success,
  );
  expect(
    "bad backup email rejected",
    !createClientInputSchema.safeParse({
      ...VALID,
      backupContact: { name: "Bob", email: "bob@nope" },
    }).success,
  );
  const missingBackup: Record<string, unknown> = { ...VALID };
  delete missingBackup.backupContact;
  expect(
    "missing backup contact rejected",
    !createClientInputSchema.safeParse(missingBackup).success,
  );
  expect("valid payload accepted", createClientInputSchema.safeParse(VALID).success);

  console.log("== 2. createClient against live DB ==");
  const caller = staffCaller();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const created = await caller.hq.createClient({ ...VALID, name: `HQ Smoke Test ${stamp}` });
  expect("tenant created", created.tenantId > 0, JSON.stringify(created));
  expect("invite path returned", created.invitePath.startsWith("/connect/asiq_inv_"));
  const detail = await caller.hq.clientDetail({ tenantId: created.tenantId });
  expect("two contacts stored", detail.contacts.length === 2);
  expect(
    "exactly one primary",
    detail.contacts.filter((c) => c.role === "primary").length === 1,
  );
  expect("checklist status is new", detail.checklist?.status === "new");

  console.log("== 3. email service with no RESEND_API_KEY ==");
  expect("RESEND_API_KEY absent in env", !isEmailConfigured());
  const invite = await caller.hq.sendInvite({ tenantId: created.tenantId });
  expect("sendInvite did not throw and reported 0 sent", invite.ok === false && invite.sent === 0);
  const db = getDb();
  const logs = await db
    .select()
    .from(emailLog)
    .where(eq(emailLog.tenantId, created.tenantId));
  expect("both invite attempts logged", logs.length === 2, `got ${logs.length}`);
  expect(
    "logged as pending with not-configured error",
    logs.every(
      (l) => l.status === "pending" && l.error === "RESEND_API_KEY not configured",
    ),
  );
  const detailAfterInvite = await caller.hq.clientDetail({ tenantId: created.tenantId });
  expect(
    "checklist flipped to invited",
    detailAfterInvite.checklist?.status === "invited" &&
      detailAfterInvite.checklist.inviteSentAt !== null,
  );

  console.log("== 4. triggerReport live ==");
  const report = await caller.hq.triggerReport({
    tenantId: created.tenantId,
    type: "initial_audit",
  });
  expect("report completed", report.status === "complete");
  expect("two email attempts logged for the report", report.emailAttempts === 2);
  const detailAfterReport = await caller.hq.clientDetail({ tenantId: created.tenantId });
  expect(
    "checklist active + timestamps set",
    detailAfterReport.checklist?.status === "active" &&
      detailAfterReport.checklist.firstScanAt !== null &&
      detailAfterReport.checklist.reportSentAt !== null,
  );
  expect("tenant flipped to active", detailAfterReport.tenant.status === "active");

  console.log("== 5. invite token lookup / expiry ==");
  expect(
    "unknown token → unknown",
    (await lookupInvite("asiq_inv_0000000000000000000000000000dead")).state === "unknown",
  );
  expect("malformed token → unknown", (await lookupInvite("hello")).state === "unknown");
  const token = detailAfterReport.checklist!.inviteToken!;
  expect(
    "completed checklist → done",
    (await lookupInvite(token)).state === "done",
  );
  // Expiry: push inviteSentAt beyond the TTL, expect 'expired', then restore.
  const stale = new Date(Date.now() - INVITE_TTL_MS - 60_000);
  await db
    .update(onboardingChecklists)
    .set({ status: "invited", inviteSentAt: stale })
    .where(eq(onboardingChecklists.tenantId, created.tenantId));
  expect("token older than 7 days → expired", (await lookupInvite(token)).state === "expired");
  await db
    .update(onboardingChecklists)
    .set({ status: "active", inviteSentAt: detailAfterReport.checklist!.inviteSentAt })
    .where(eq(onboardingChecklists.tenantId, created.tenantId));

  console.log(
    failures === 0
      ? "\nALL SMOKE CHECKS PASSED"
      : `\n${failures} SMOKE CHECK(S) FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke-hq crashed:", err);
  process.exit(1);
});
