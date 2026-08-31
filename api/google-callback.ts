import type { Context } from "hono";
import {
  fetchAccountLabel,
  gbpAutoResource,
  isGoogleService,
  exchangeCode,
  resolveRedirectUri,
  saveGoogleCredentials,
  verifyState,
} from "./services/google";

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

    const oauthError = c.req.query("error");
    if (oauthError) {
      // User denied consent, or Google rejected the request.
      return c.redirect(settingsUrl({ googleError: oauthError }), 302);
    }

    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) {
      return c.json({ error: "code and state are required" }, 400);
    }

    const payload = verifyState(state);
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
      return c.redirect(settingsUrl({ connected: service }), 302);
    } catch (err) {
      console.error(
        `[google-oauth] callback failed for ${service} (tenant ${tenantId}):`,
        err,
      );
      return c.redirect(settingsUrl({ googleError: "token_exchange_failed" }), 302);
    }
  };
}
