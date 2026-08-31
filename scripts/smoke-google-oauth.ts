/**
 * Smoke test for the Google OAuth connect flow (no real OAuth round-trip).
 * Run: npx tsx scripts/smoke-google-oauth.ts
 */
import {
  GOOGLE_SERVICES,
  GoogleNotConnectedError,
  buildAuthUrl,
  isGoogleConfigured,
  newStateNonce,
  parseGbpResource,
  resolveRedirectUri,
  signState,
  verifyState,
} from "../api/services/google";

let failures = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};

// 1. buildAuthUrl — well-formed URL per service (client_id redacted).
for (const service of GOOGLE_SERVICES) {
  const configured = isGoogleConfigured(service);
  ok(configured, `${service}: env client configured`);
  const state = signState({ tenantId: 1, service, nonce: newStateNonce() });
  const url = new URL(
    buildAuthUrl(service, state, "https://app.example.com/api/integrations/google/callback"),
  );
  const p = url.searchParams;
  ok(url.origin + url.pathname === "https://accounts.google.com/o/oauth2/v2/auth", `${service}: auth endpoint`);
  ok(p.get("response_type") === "code", `${service}: response_type=code`);
  ok(p.get("access_type") === "offline", `${service}: access_type=offline`);
  ok(p.get("prompt") === "consent", `${service}: prompt=consent`);
  ok(p.get("include_granted_scopes") === "true", `${service}: include_granted_scopes`);
  ok(p.get("redirect_uri") === "https://app.example.com/api/integrations/google/callback", `${service}: redirect_uri`);
  ok((p.get("client_id") ?? "").length > 10, `${service}: client_id present (${(p.get("client_id") ?? "").slice(0, 8)}…)`);
  const scopes = (p.get("scope") ?? "").split(" ");
  const expected: Record<string, string[]> = {
    gsc: ["https://www.googleapis.com/auth/webmasters.readonly"],
    ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
    gbp: [
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/businessperformance.readonly",
    ],
  };
  ok(
    expected[service].every((s) => scopes.includes(s)),
    `${service}: scopes = ${scopes.map((s) => s.split("/auth/")[1]).join(", ")}`,
  );
}

// 2. State HMAC round-trip.
const state = signState({ tenantId: 42, service: "ga4", nonce: newStateNonce() });
const decoded = verifyState(state);
ok(decoded?.tenantId === 42 && decoded.service === "ga4", "state HMAC round-trip verifies");
ok(verifyState(`${state.slice(0, -2)}xx`) === null, "tampered state rejected");
ok(verifyState("garbage") === null, "malformed state rejected");

// 3. Redirect URI resolution.
process.env.GOOGLE_OAUTH_REDIRECT_URI = "";
delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
ok(
  resolveRedirectUri("https://tenant.example.com") ===
    "https://tenant.example.com/api/integrations/google/callback",
  "redirect URI derived from request origin",
);
process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://fixed.example.com/cb";
ok(resolveRedirectUri("https://other.example.com") === "https://fixed.example.com/cb", "env redirect URI wins");
delete process.env.GOOGLE_OAUTH_REDIRECT_URI;

// 4. GBP resource JSON round-trip.
const gbp = parseGbpResource(JSON.stringify({ account: "accounts/1", location: "accounts/1/locations/2" }));
ok(gbp?.location === "accounts/1/locations/2", "GBP resource parses");
ok(parseGbpResource("not-json") === null, "GBP resource rejects garbage");

// 5. NotConnected paths throw typed errors (routers convert to {connected:false}).
// DB-backed loader with a tenant that has no Google rows: typed error, no crash.
try {
  const { getGoogleTokenContext } = await import("../api/services/google");
  await getGoogleTokenContext(999_999_999, "gsc");
  ok(false, "getGoogleTokenContext should have thrown");
} catch (err) {
  ok(
    err instanceof GoogleNotConnectedError,
    `NotConnected typed error for tenant without credentials (${err instanceof Error ? err.name : String(err)})`,
  );
}

// Router conversion: NotConnected → { connected: false } payload shape.
try {
  const { getGoogleTokenContext } = await import("../api/services/google");
  const ctx = await getGoogleTokenContext(999_999_999, "ga4").catch((err) => {
    if (err instanceof GoogleNotConnectedError) return null;
    throw err;
  });
  const payload = ctx ? { connected: true as const } : { connected: false as const };
  ok(payload.connected === false, "router payload {connected:false} without throwing");
} catch (err) {
  ok(false, `NotConnected conversion threw: ${String(err)}`);
}

console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
