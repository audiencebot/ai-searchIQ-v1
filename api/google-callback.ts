import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { onboardingChecklists } from "@db/schema";
import {
  fetchAccountLabel,
  gbpAutoResource,
  isGoogleService,
  exchangeCode,
  resolveRedirectUri,
  saveGoogleCredentials,
  verifyState,
} from "./services/google";
import { getDb } from "./queries/connection";
import { notifyStaffGoogleConnected } from "./services/email";

/**
 * GET /api/integrations/google/callback?code&state
 *
 * Per-tenant Google OAuth redirect target (Search Console / GA4 / Business
 * Profile). The state param is an HMAC-signed {tenantId, service, nonce}
 * minted by the settings.googleAuthUrl tRPC mutation; on success the browser
 * is redirected back to Settings → Integrations with a `?connected=` flash.
 */
export function createGoogleOAuthCallbackHandler() {
  return async (c: Context) => {
    const settingsUrl = (extra: Record<string, string>) => {
      const params = new URLSearchParams({ tab: "integrations", ...extra });
      return `/app/settings?${params.toString()}`;
    };

    const code = c.req.query("code");
    const state = c.req.query("state");
    const payload = state ? verifyState(state) : null;
    // Invite-carrying flows (public /connect/<token> page) redirect back to
    // the connect page instead of Settings → Integrations.
    const successUrl = payload?.inviteToken
      ? (extra: Record<string, string>) =>
          `/connect/${payload.inviteToken}?${new URLSearchParams(extra).toString()}`
      : settingsUrl;

    const oauthError = c.req.query("error");
    if (oauthError) {
      // User denied consent, or Google rejected the request.
      return c.redirect(successUrl({ googleError: oauthError }), 302);
    }

    if (!code || !state) {
      return c.json({ error: "code and state are required" }, 400);
    }

    if (!payload || !isGoogleService(payload.service)) {
      return c.json({ error: "Invalid or tampered OAuth state" }, 400);
    }
    const { tenantId, service } = payload;

    try {
      const origin = new URL(c.req.url).origin;
      const redirectUri = resolveRedirectUri(origin);
      const credentials = await exchangeCode(service, code, redirectUri);
      if (!credentials.refreshToken && !credentials.accessToken) {
        throw new Error("Google returned no tokens for the authorization code");
      }

      // Best-effort account label for the Connected card (never blocks).
      const label = await fetchAccountLabel({
        service,
        accessToken: credentials.accessToken ?? "",
        refreshToken: credentials.refreshToken,
        persistTokens: async (next) => {
          Object.assign(credentials, next);
        },
      });
      if (label) credentials.accountLabel = label;

      // GBP: auto-store the resource only when it is unambiguous (exactly one
      // account with exactly one location); otherwise the tenant picks later.
      let externalAccountId: string | null | undefined;
      if (service === "gbp") {
        externalAccountId = await gbpAutoResource({
          service,
          accessToken: credentials.accessToken ?? "",
          refreshToken: credentials.refreshToken,
        });
      }

      await saveGoogleCredentials(tenantId, service, credentials, externalAccountId);

      // First successful connect from the onboarding page flips the
      // checklist (plan §4 step 4): status → google_connected.
      if (payload.inviteToken) {
        const db = getDb();
        const checklist = await db.query.onboardingChecklists.findFirst({
          where: eq(onboardingChecklists.inviteToken, payload.inviteToken),
        });
        if (
          checklist &&
          (checklist.status === "new" || checklist.status === "invited")
        ) {
          // Phase 1.5 charge-before-report gate: after Google connect the
          // checklist moves straight to `awaiting_payment` — the initial
          // audit stays blocked until staff marks the $399 as received.
          // (google_connected remains a valid enum member for pre-1.5 rows.)
          await db
            .update(onboardingChecklists)
            .set({
              status: "awaiting_payment",
              googleConnectedAt: new Date(),
            })
            .where(eq(onboardingChecklists.id, checklist.id));
          // Best-effort staff ping; never blocks the redirect.
          await notifyStaffGoogleConnected(checklist.tenantId, { hqOrigin: origin });
        }
      }

      return c.redirect(successUrl({ connected: service }), 302);
    } catch (err) {
      console.error(
        `[google-oauth] callback failed for ${service} (tenant ${tenantId}):`,
        err,
      );
      return c.redirect(successUrl({ googleError: "token_exchange_failed" }), 302);
    }
  };
}
