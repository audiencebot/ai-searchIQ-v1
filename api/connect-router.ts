import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { integrations, onboardingChecklists, tenants } from "@db/schema";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  GOOGLE_SERVICES,
  buildAuthUrl,
  isGoogleConfigured,
  newStateNonce,
  resolveRedirectUri,
  signState,
} from "./services/google";

/**
 * Public client-connect API backing /connect/<inviteToken> (plan §4 step 4).
 * No login: the HMAC-signed invite token in the URL is the credential.
 * Tokens expire 7 days after the invite was sent and are done once the
 * checklist reaches 'active'.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const tokenSchema = z
  .string()
  .regex(/^asiq_inv_[0-9a-f]{32}$/, "Malformed invite token");

type InviteState = "ok" | "unknown" | "expired" | "done";

interface InviteLookup {
  state: InviteState;
  checklist?: typeof onboardingChecklists.$inferSelect;
  tenantName?: string;
}

/** Shared token lookup + validity rules (also exercised by the smoke script). */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!tokenSchema.safeParse(token).success) return { state: "unknown" };
  const db = getDb();
  const checklist = await db.query.onboardingChecklists.findFirst({
    where: eq(onboardingChecklists.inviteToken, token),
  });
  if (!checklist) return { state: "unknown" };
  if (checklist.status === "active") return { state: "done", checklist };
  if (
    checklist.inviteSentAt &&
    Date.now() - checklist.inviteSentAt.getTime() > INVITE_TTL_MS
  ) {
    return { state: "expired", checklist };
  }
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, checklist.tenantId),
  });
  return { state: "ok", checklist, tenantName: tenant?.name };
}

function assertUsable(lookup: InviteLookup) {
  if (lookup.state === "unknown") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Unknown invite link." });
  }
  if (lookup.state === "expired") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This invite link has expired — ask AI Search IQ for a fresh one.",
    });
  }
  if (lookup.state === "done") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Onboarding for this client is already complete.",
    });
  }
  return lookup.checklist!;
}

export const connectRouter = createRouter({
  /** Connect page payload: client name + per-service connection status. */
  session: publicQuery
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const lookup = await lookupInvite(input.token);
      if (lookup.state !== "ok" || !lookup.checklist) {
        return { state: lookup.state } as const;
      }
      const rows = await getDb()
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.tenantId, lookup.checklist.tenantId),
            eq(integrations.status, "connected"),
          ),
        );
      const connected = new Set(rows.map((r) => r.provider));
      return {
        state: "ok" as const,
        clientName: lookup.tenantName ?? "your company",
        services: GOOGLE_SERVICES.map((service) => ({
          service,
          connected: connected.has(service),
        })),
      };
    }),

  /**
   * Start the existing Google OAuth flow for this tenant. The invite token
   * rides along in the signed state so the callback can return the client to
   * the connect page instead of Settings → Integrations.
   */
  googleAuthUrl: publicQuery
    .input(z.object({ token: z.string(), service: z.enum(GOOGLE_SERVICES) }))
    .mutation(async ({ ctx, input }) => {
      const checklist = assertUsable(await lookupInvite(input.token));
      if (!isGoogleConfigured(input.service)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Google OAuth client for ${input.service} is not configured.`,
        });
      }
      const origin = new URL(ctx.req.url).origin;
      const url = buildAuthUrl(
        input.service,
        signState({
          tenantId: checklist.tenantId,
          service: input.service,
          nonce: newStateNonce(),
          inviteToken: input.token,
        }),
        resolveRedirectUri(origin),
      );
      return { url };
    }),
});
