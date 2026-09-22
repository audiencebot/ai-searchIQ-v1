import { emailLog } from "@db/schema";
import type { EmailLogEntry } from "@db/schema";
import { getDb } from "../queries/connection";

/**
 * Transactional email via the Resend HTTP API (client-management-plan.md §5).
 *
 * Plain fetch, no SDK. Every send attempt is written to `email_log` —
 * including the not-configured case — so HQ always has delivery proof.
 * This service NEVER throws: callers get `{ ok, entry }` and HQ surfaces
 * failures with a Resend button.
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "AI Search IQ <reports@aisearchiq.net>";

// ─── API key (lazy singleton) ────────────────────────────────────────────────

let apiKey: string | null | undefined;

function getApiKey(): string | null {
  if (apiKey === undefined) {
    const key = process.env.RESEND_API_KEY ?? "";
    apiKey = key || null;
  }
  return apiKey;
}

/** True when the RESEND_API_KEY env var is present. */
export function isEmailConfigured(): boolean {
  return getApiKey() !== null;
}

/** Sender identity (env-overridable; never a secret). */
export function emailFrom(): string {
  return process.env.EMAIL_FROM || DEFAULT_FROM;
}

// ─── sendEmail ───────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  tenantId: number;
  reportId?: number | null;
}

export interface SendEmailResult {
  ok: boolean;
  entry: EmailLogEntry;
}

const resendResponseSchema = (raw: unknown): { id?: string } =>
  typeof raw === "object" && raw !== null ? (raw as { id?: string }) : {};

/**
 * Send one email and ALWAYS log the outcome in `email_log`:
 *  - success → status 'sent' + providerMessageId + sentAt
 *  - Resend error → status 'failed' + error
 *  - missing key → status 'pending' + error 'RESEND_API_KEY not configured'
 * Never throws.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const db = getDb();
  const logBase = {
    tenantId: input.tenantId,
    reportId: input.reportId ?? null,
    toEmail: input.to,
    subject: input.subject,
  };

  const key = getApiKey();
  if (!key) {
    const [entry] = await db
      .insert(emailLog)
      .values({ ...logBase, status: "pending", error: "RESEND_API_KEY not configured" })
      .$returningId();
    const row = await db.query.emailLog.findFirst({
      where: (t, { eq }) => eq(t.id, entry.id),
    });
    return { ok: false, entry: row as EmailLogEntry };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = resendResponseSchema(await res.json().catch(() => ({})));
    if (!res.ok) {
      const error = `Resend HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`;
      const [inserted] = await db
        .insert(emailLog)
        .values({ ...logBase, status: "failed", error })
        .$returningId();
      const row = await db.query.emailLog.findFirst({
        where: (t, { eq }) => eq(t.id, inserted.id),
      });
      return { ok: false, entry: row as EmailLogEntry };
    }
    const [inserted] = await db
      .insert(emailLog)
      .values({
        ...logBase,
        status: "sent",
        providerMessageId: body.id ?? null,
        sentAt: new Date(),
      })
      .$returningId();
    const row = await db.query.emailLog.findFirst({
      where: (t, { eq }) => eq(t.id, inserted.id),
    });
    return { ok: true, entry: row as EmailLogEntry };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const [inserted] = await db
      .insert(emailLog)
      .values({ ...logBase, status: "failed", error: error.slice(0, 2000) })
      .$returningId();
    const row = await db.query.emailLog.findFirst({
      where: (t, { eq }) => eq(t.id, inserted.id),
    });
    return { ok: false, entry: row as EmailLogEntry };
  }
}

// ─── Branded HTML templates (navy/icy palette, 2px radius feel) ─────────────

const NAVY = "#07161D";
const NAVY_2 = "#0B1A21";
const INK = "#10242D";
const ICY = "#BDEAFF";
const SIGNAL = "#83D6FA";
const EDITORIAL = "#3289AE";
const CLOUD = "#F8FBFC";

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${CLOUD};font-family:Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background-color:${NAVY};border-radius:2px;padding:20px 28px;">
      <span style="color:#FFFFFF;font-size:15px;letter-spacing:0.02em;">AI Search <span style="color:${SIGNAL};">IQ</span></span>
    </div>
    <div style="background-color:#FFFFFF;border:1px solid ${ICY};border-top:none;border-radius:2px;padding:32px 28px;">
      ${content}
    </div>
    <p style="color:${INK};opacity:0.55;font-size:11px;line-height:1.6;padding:16px 8px 0;margin:0;">
      AI Search IQ · AI search visibility, measured and improved.<br>
      You received this because you are a registered contact for an AI Search IQ client workspace.
    </p>
  </div>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:${EDITORIAL};color:#FFFFFF;text-decoration:none;font-size:13px;padding:11px 22px;border-radius:2px;margin-top:8px;">${label}</a>`;
}

/** Onboarding invite → public tokenized connect page (plan §4 step 4). */
export function inviteEmail(args: { clientName: string; inviteUrl: string }): {
  subject: string;
  html: string;
} {
  const html = shell(`
    <h1 style="color:${NAVY};font-size:20px;font-weight:600;margin:0 0 16px;">Welcome to AI Search IQ</h1>
    <p style="color:${INK};font-size:14px;line-height:1.7;margin:0 0 12px;">
      We're setting up <strong>${args.clientName}</strong> for AI search visibility reporting.
      To get started, we need read-only access to your Google services — granted by you through
      Google's official consent screen. We never ask for your password.
    </p>
    <p style="color:${INK};font-size:14px;line-height:1.7;margin:0 0 20px;">
      Click below to connect <strong>Search Console</strong>, <strong>Google Analytics 4</strong>,
      and <strong>Google Business Profile</strong>. It takes about two minutes.
    </p>
    ${button(args.inviteUrl, "Connect your Google services")}
    <p style="color:${NAVY_2};opacity:0.6;font-size:12px;line-height:1.6;margin:24px 0 0;">
      This link is unique to ${args.clientName} and expires in 7 days.<br>
      Or paste it into your browser: <span style="color:${EDITORIAL};word-break:break-all;">${args.inviteUrl}</span>
    </p>
  `);
  return {
    subject: `Connect ${args.clientName} to AI Search IQ (2 minutes, no password needed)`,
    html,
  };
}

/** Report-completed notification → portal link (plan §5). */
export function reportReadyEmail(args: {
  clientName: string;
  reportType: string;
  periodLabel: string;
  portalUrl: string;
  headlineScore?: number;
}): { subject: string; html: string } {
  const scoreBlock =
    args.headlineScore !== undefined
      ? `<div style="background-color:${CLOUD};border:1px solid ${ICY};border-radius:2px;padding:16px 20px;margin:0 0 20px;">
          <span style="color:${INK};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">Headline AI visibility score</span><br>
          <span style="color:${EDITORIAL};font-size:28px;font-weight:600;">${args.headlineScore}</span>
          <span style="color:${INK};font-size:13px;">/100</span>
        </div>`
      : "";
  const html = shell(`
    <h1 style="color:${NAVY};font-size:20px;font-weight:600;margin:0 0 16px;">Your ${args.reportType} is ready</h1>
    <p style="color:${INK};font-size:14px;line-height:1.7;margin:0 0 20px;">
      The <strong>${args.reportType}</strong> for <strong>${args.clientName}</strong>
      (${args.periodLabel}) has been completed and is available in your portal.
    </p>
    ${scoreBlock}
    ${button(args.portalUrl, "View your report")}
  `);
  return {
    subject: `${args.clientName} — your ${args.reportType} (${args.periodLabel}) is ready`,
    html,
  };
}
