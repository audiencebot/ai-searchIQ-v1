import { createHmac, randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { integrations } from "@db/schema";
import { getDb } from "../queries/connection";
import { env } from "../lib/env";

/**
 * Per-tenant Google OAuth client (Search Console / GA4 / Business Profile).
 *
 * App login is Kimi OAuth; these connections are per-tenant data sources.
 * OAuth client resolution order per service: service-specific env vars
 * (GOOGLE_<SVC>_CLIENT_ID/SECRET) → shared GOOGLE_CLIENT_ID/SECRET (future
 * single Google Cloud client). Tokens are stored per tenant on the
 * `integrations` row (credentials JSON) and refreshed lazily on expiry / 401.
 *
 * Every caller-facing failure mode that means "no usable connection" throws
 * GoogleNotConnectedError — routers convert that into `{ connected: false }`
 * payloads instead of crashing.
 */

export const GOOGLE_SERVICES = ["gsc", "ga4", "gbp"] as const;
export type GoogleService = (typeof GOOGLE_SERVICES)[number];

export class GoogleNotConnectedError extends Error {
  readonly service: GoogleService;

  constructor(service: GoogleService, message: string) {
    super(message);
    this.name = "GoogleNotConnectedError";
    this.service = service;
  }
}

export class GoogleApiError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "GoogleApiError";
    this.statusCode = statusCode;
  }
}

// ─── Per-service OAuth configuration ─────────────────────────────────────────

const SERVICE_CONFIG: Record<
  GoogleService,
  { envPrefix: string; scopes: string[] }
> = {
  gsc: {
    envPrefix: "GOOGLE_GSC",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  },
  ga4: {
    envPrefix: "GOOGLE_GA4",
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  },
  gbp: {
    envPrefix: "GOOGLE_GBP",
    scopes: [
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/businessperformance.readonly",
    ],
  },
};

export function isGoogleService(value: string): value is GoogleService {
  return (GOOGLE_SERVICES as readonly string[]).includes(value);
}

interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

/** Lazy per-service resolution: service-specific vars → shared GOOGLE_ vars. */
const resolvedClients: Partial<Record<GoogleService, OAuthClient | null>> = {};

function getClient(service: GoogleService): OAuthClient | null {
  if (!(service in resolvedClients)) {
    const prefix = SERVICE_CONFIG[service].envPrefix;
    const clientId =
      process.env[`${prefix}_CLIENT_ID`] || process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret =
      process.env[`${prefix}_CLIENT_SECRET`] || process.env.GOOGLE_CLIENT_SECRET || "";
    resolvedClients[service] = clientId && clientSecret ? { clientId, clientSecret } : null;
  }
  return resolvedClients[service] ?? null;
}

/** True when OAuth client env credentials exist for the service. */
export function isGoogleConfigured(service: GoogleService): boolean {
  return getClient(service) !== null;
}

export const GOOGLE_CALLBACK_PATH = "/api/integrations/google/callback";

/**
 * Redirect URI registered in Google Cloud Console. Explicit env override wins;
 * otherwise derived from the incoming request origin.
 */
export function resolveRedirectUri(origin?: string): string {
  const fromEnv = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (fromEnv) return fromEnv;
  if (!origin) {
    throw new GoogleApiError(
      "GOOGLE_OAUTH_REDIRECT_URI is not set and no request origin is available",
    );
  }
  return `${origin}${GOOGLE_CALLBACK_PATH}`;
}

// ─── OAuth state (HMAC-signed, tamper-evident) ───────────────────────────────

const statePayloadSchema = z.object({
  tenantId: z.number().int().positive(),
  service: z.enum(GOOGLE_SERVICES),
  nonce: z.string().min(8),
  // Present when the flow was started from the public /connect/<token>
  // onboarding page — the callback returns the client there instead of
  // Settings → Integrations and flips the onboarding checklist.
  inviteToken: z.string().max(64).optional(),
});

export type GoogleOAuthState = z.infer<typeof statePayloadSchema>;

const base64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64url");

function stateSecret(): string {
  const secret = env.appSecret || process.env.APP_SECRET || "";
  if (!secret) throw new GoogleApiError("APP_SECRET is required to sign OAuth state");
  return secret;
}

export function signState(payload: GoogleOAuthState): string {
  const body = base64url(JSON.stringify(statePayloadSchema.parse(payload)));
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Returns the decoded state payload, or null when the signature is invalid. */
export function verifyState(state: string): GoogleOAuthState | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  // Constant-time comparison on equal-length buffers.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !a.equals(b)) return null;
  try {
    return statePayloadSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString()));
  } catch {
    return null;
  }
}

export function newStateNonce(): string {
  return randomBytes(16).toString("base64url");
}

// ─── Auth URL + token exchange ────────────────────────────────────────────────

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function buildAuthUrl(
  service: GoogleService,
  state: string,
  redirectUri?: string,
): string {
  const client = getClient(service);
  if (!client) {
    throw new GoogleNotConnectedError(
      service,
      `Google OAuth client for ${service} is not configured`,
    );
  }
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri ?? resolveRedirectUri(),
    response_type: "code",
    scope: SERVICE_CONFIG[service].scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// ─── Stored credentials ──────────────────────────────────────────────────────

export const googleCredentialsSchema = z.object({
  refreshToken: z.string().optional(),
  accessToken: z.string().optional(),
  /** Epoch ms when the access token expires. */
  expiryDate: z.number().optional(),
  scopes: z.array(z.string()).optional(),
  /** Best-effort account label (email / property / site) captured at connect. */
  accountLabel: z.string().optional(),
});

export type GoogleCredentials = z.infer<typeof googleCredentialsSchema>;

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().default(3600),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

async function postToken(
  service: GoogleService,
  params: Record<string, string>,
): Promise<z.infer<typeof tokenResponseSchema>> {
  const client = getClient(service);
  if (!client) {
    throw new GoogleNotConnectedError(
      service,
      `Google OAuth client for ${service} is not configured`,
    );
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      ...params,
    }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GoogleApiError(
      `Google token request failed (${res.status}): ${text.slice(0, 300)}`,
      res.status,
    );
  }
  return tokenResponseSchema.parse(await res.json());
}

/** Exchange an authorization code for tokens (authorization_code grant). */
export async function exchangeCode(
  service: GoogleService,
  code: string,
  redirectUri: string,
): Promise<GoogleCredentials> {
  const token = await postToken(service, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  return {
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expiryDate: Date.now() + token.expires_in * 1000,
    scopes: token.scope?.split(" ").filter(Boolean),
  };
}

/** Refresh an access token (refresh_token grant). */
export async function refreshAccessToken(
  service: GoogleService,
  refreshToken: string,
): Promise<GoogleCredentials> {
  const token = await postToken(service, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return {
    refreshToken, // Google keeps the same refresh token unless revoked
    accessToken: token.access_token,
    expiryDate: Date.now() + token.expires_in * 1000,
    scopes: token.scope?.split(" ").filter(Boolean),
  };
}

// ─── Per-tenant credential persistence ───────────────────────────────────────

export async function loadGoogleCredentials(
  tenantId: number,
  service: GoogleService,
): Promise<GoogleCredentials | null> {
  const row = await getDb().query.integrations.findFirst({
    where: and(eq(integrations.tenantId, tenantId), eq(integrations.provider, service)),
  });
  if (!row?.credentials) return null;
  const parsed = googleCredentialsSchema.safeParse(row.credentials);
  return parsed.success ? parsed.data : null;
}

export async function saveGoogleCredentials(
  tenantId: number,
  service: GoogleService,
  credentials: GoogleCredentials,
  externalAccountId?: string | null,
): Promise<void> {
  const db = getDb();
  const existing = await db.query.integrations.findFirst({
    where: and(eq(integrations.tenantId, tenantId), eq(integrations.provider, service)),
  });
  const set: Record<string, unknown> = {
    status: "connected" as const,
    credentials,
    connectedAt: new Date(),
  };
  if (externalAccountId !== undefined) set.externalAccountId = externalAccountId;
  if (existing) {
    await db
      .update(integrations)
      .set(set)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, service)));
  } else {
    await db.insert(integrations).values({
      tenantId,
      provider: service,
      status: "connected",
      credentials,
      connectedAt: new Date(),
      ...(externalAccountId !== undefined ? { externalAccountId } : {}),
    });
  }
}

export async function clearGoogleCredentials(
  tenantId: number,
  service: GoogleService,
): Promise<void> {
  await getDb()
    .update(integrations)
    .set({
      status: "not_connected",
      credentials: null,
      externalAccountId: null,
      connectedAt: null,
    })
    .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, service)));
}

// ─── Authenticated fetch with one auto-refresh on 401 ────────────────────────

export interface GoogleTokenContext {
  service: GoogleService;
  accessToken: string;
  refreshToken?: string;
  /** Persist rotated tokens after a 401-triggered refresh (called at most once). */
  persistTokens?: (credentials: GoogleCredentials) => Promise<void> | void;
}

async function googleApiFetch(
  token: GoogleTokenContext,
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  const authed = (accessToken: string) =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(30_000),
    });

  let res = await authed(token.accessToken);
  if (res.status === 401 && token.refreshToken) {
    const refreshed = await refreshAccessToken(token.service, token.refreshToken);
    await token.persistTokens?.(refreshed);
    res = await authed(refreshed.accessToken as string);
  }
  if (res.status === 401 || res.status === 403) {
    throw new GoogleNotConnectedError(
      token.service,
      `Google rejected the stored credentials for ${token.service} (HTTP ${res.status})`,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new GoogleApiError(
      `Google API HTTP ${res.status} for ${url}: ${text.slice(0, 300)}`,
      res.status,
    );
  }
  return res.json();
}

/**
 * Load a tenant's credentials into a token context, proactively refreshing
 * when expired. Throws GoogleNotConnectedError when nothing usable is stored.
 */
export async function getGoogleTokenContext(
  tenantId: number,
  service: GoogleService,
): Promise<GoogleTokenContext> {
  const creds = await loadGoogleCredentials(tenantId, service);
  if (!creds || (!creds.accessToken && !creds.refreshToken)) {
    throw new GoogleNotConnectedError(service, `Google ${service} is not connected`);
  }
  const persistTokens = async (next: GoogleCredentials) => {
    await saveGoogleCredentials(tenantId, service, { ...creds, ...next });
  };
  const expired =
    !creds.accessToken ||
    (creds.expiryDate !== undefined && creds.expiryDate < Date.now() + 60_000);
  if (expired) {
    if (!creds.refreshToken) {
      throw new GoogleNotConnectedError(
        service,
        `Google ${service} access token expired and no refresh token is stored`,
      );
    }
    const refreshed = await refreshAccessToken(service, creds.refreshToken);
    const merged = { ...creds, ...refreshed };
    await persistTokens(merged);
    return {
      service,
      accessToken: merged.accessToken as string,
      refreshToken: merged.refreshToken,
      persistTokens,
    };
  }
  return {
    service,
    accessToken: creds.accessToken as string,
    refreshToken: creds.refreshToken,
    persistTokens,
  };
}

// ─── Response schemas + compact shapes ───────────────────────────────────────

const gscQueryResponseSchema = z.object({
  rows: z
    .array(
      z.object({
        keys: z.array(z.string()).default([]),
        clicks: z.number().default(0),
        impressions: z.number().default(0),
        ctr: z.number().default(0),
        position: z.number().default(0),
      }),
    )
    .default([]),
});

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const ga4ReportSchema = z.object({
  dimensionHeaders: z.array(z.object({ name: z.string() })).default([]),
  metricHeaders: z.array(z.object({ name: z.string() })).default([]),
  rows: z
    .array(
      z.object({
        dimensionValues: z.array(z.object({ value: z.string() })).default([]),
        metricValues: z.array(z.object({ value: z.string() })).default([]),
      }),
    )
    .default([]),
});

export interface Ga4Report {
  dimensions: string[];
  metrics: string[];
  rows: { dimensions: string[]; metrics: number[] }[];
}

const gbpAccountsSchema = z.object({
  accounts: z
    .array(
      z.object({
        name: z.string(),
        accountName: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .default([]),
});

export interface GbpAccount {
  name: string;
  accountName: string;
  type: string;
}

const gbpLocationsSchema = z.object({
  locations: z
    .array(
      z.object({
        name: z.string(),
        title: z.string().optional(),
      }),
    )
    .default([]),
});

export interface GbpLocation {
  name: string;
  title: string;
}

const gbpPerformanceSchema = z.object({
  multiDailyMetricTimeSeries: z
    .array(
      z.object({
        dailyMetricTimeSeries: z.object({
          dailyMetric: z.string(),
          timeSeries: z
            .object({
              datedValues: z
                .array(
                  z.object({
                    date: z.object({
                      year: z.number(),
                      month: z.number(),
                      day: z.number(),
                    }),
                    values: z.array(z.object({ value: z.string() })).default([]),
                  }),
                )
                .default([]),
            })
            .optional(),
        }),
      }),
    )
    .default([]),
});

export interface GbpMetricSeries {
  metric: string;
  points: { date: string; value: number }[];
}

/** GBP performance metrics pulled for the daily time series. */
export const GBP_PERFORMANCE_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_DIRECTION_REQUESTS",
  "BUSINESS_URL_CLICKS",
  "BUSINESS_CALL_CLICKS",
] as const;

// ─── Data fetchers ────────────────────────────────────────────────────────────

/** POST searchconsole v1 searchanalytics.query — clicks/impressions/CTR/position. */
export async function gscQuery(
  token: GoogleTokenContext,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
): Promise<GscRow[]> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchanalytics/query`;
  const raw = await googleApiFetch(token, url, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, dimensions }),
  });
  return gscQueryResponseSchema.parse(raw).rows.map((r) => ({
    keys: r.keys,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/** POST analyticsdata v1beta runReport — dimension/metric matrix. */
export async function ga4RunReport(
  token: GoogleTokenContext,
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  metrics: string[],
): Promise<Ga4Report> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const raw = await googleApiFetch(token, url, {
    method: "POST",
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
    }),
  });
  const parsed = ga4ReportSchema.parse(raw);
  return {
    dimensions: parsed.dimensionHeaders.map((h) => h.name),
    metrics: parsed.metricHeaders.map((h) => h.name),
    rows: parsed.rows.map((r) => ({
      dimensions: r.dimensionValues.map((v) => v.value),
      metrics: r.metricValues.map((v) => Number(v.value) || 0),
    })),
  };
}

/** GET mybusinessbusinessinformation v1 accounts — GBP accounts the user manages. */
export async function gbpListAccounts(token: GoogleTokenContext): Promise<GbpAccount[]> {
  const raw = await googleApiFetch(
    token,
    "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
  );
  return gbpAccountsSchema.parse(raw).accounts.map((a) => ({
    name: a.name,
    accountName: a.accountName ?? "",
    type: a.type ?? "",
  }));
}

/** GET mybusinessbusinessinformation v1 locations for an account. */
export async function gbpLocations(
  token: GoogleTokenContext,
  account: string,
): Promise<GbpLocation[]> {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations?readMask=name,title&pageSize=100`;
  const raw = await googleApiFetch(token, url);
  return gbpLocationsSchema.parse(raw).locations.map((l) => ({
    name: l.name,
    title: l.title ?? "",
  }));
}

/** GET businessperformance v1 fetchMultiDailyMetricsTimeSeries. */
export async function gbpPerformance(
  token: GoogleTokenContext,
  locationName: string,
  startDate: string,
  endDate: string,
): Promise<GbpMetricSeries[]> {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const params = new URLSearchParams();
  for (const metric of GBP_PERFORMANCE_METRICS) params.append("dailyMetrics", metric);
  params.set("dailyRange.start_date.year", String(sy));
  params.set("dailyRange.start_date.month", String(sm));
  params.set("dailyRange.start_date.day", String(sd));
  params.set("dailyRange.end_date.year", String(ey));
  params.set("dailyRange.end_date.month", String(em));
  params.set("dailyRange.end_date.day", String(ed));
  const url = `https://businessperformance.googleapis.com/v1/${locationName}/fetchMultiDailyMetricsTimeSeries?${params.toString()}`;
  const raw = await googleApiFetch(token, url);
  return gbpPerformanceSchema.parse(raw).multiDailyMetricTimeSeries.map((s) => {
    const dts = s.dailyMetricTimeSeries;
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      metric: dts.dailyMetric,
      points: (dts.timeSeries?.datedValues ?? []).map((dv) => ({
        date: `${dv.date.year}-${pad(dv.date.month)}-${pad(dv.date.day)}`,
        value: Number(dv.values[0]?.value ?? 0) || 0,
      })),
    };
  });
}

// ─── Connect-time helpers (account labels + resource discovery) ──────────────

const gscSitesSchema = z.object({
  siteEntry: z
    .array(z.object({ siteUrl: z.string(), permissionLevel: z.string().optional() }))
    .default([]),
});

const ga4AccountSummariesSchema = z.object({
  accountSummaries: z
    .array(
      z.object({
        name: z.string(),
        displayName: z.string().optional(),
        propertySummaries: z
          .array(
            z.object({
              property: z.string(),
              displayName: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export interface Ga4Property {
  propertyId: string;
  displayName: string;
}

/** Best-effort account label used on the Connected card. Never throws. */
export async function fetchAccountLabel(
  token: GoogleTokenContext,
): Promise<string | undefined> {
  try {
    switch (token.service) {
      case "gsc": {
        const raw = await googleApiFetch(
          token,
          "https://www.googleapis.com/webmasters/v3/sites",
        );
        const sites = gscSitesSchema.parse(raw).siteEntry;
        return sites.length === 1
          ? sites[0]?.siteUrl
          : `${sites.length} Search Console sites`;
      }
      case "ga4": {
        const raw = await googleApiFetch(
          token,
          "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=50",
        );
        const accounts = ga4AccountSummariesSchema.parse(raw).accountSummaries;
        const first = accounts[0];
        return accounts.length === 1 && first?.displayName
          ? first.displayName
          : `${accounts.length} GA4 accounts`;
      }
      case "gbp": {
        const accounts = await gbpListAccounts(token);
        const first = accounts[0];
        return accounts.length === 1 && first
          ? first.accountName || first.name
          : `${accounts.length} Business Profile accounts`;
      }
    }
  } catch {
    return undefined;
  }
}

/** List verified GSC sites (used by the resource picker). */
export async function gscListSites(token: GoogleTokenContext): Promise<string[]> {
  const raw = await googleApiFetch(token, "https://www.googleapis.com/webmasters/v3/sites");
  return gscSitesSchema.parse(raw).siteEntry.map((s) => s.siteUrl);
}

/** List GA4 properties across all account summaries (resource picker). */
export async function ga4ListProperties(token: GoogleTokenContext): Promise<Ga4Property[]> {
  const raw = await googleApiFetch(
    token,
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
  );
  const accounts = ga4AccountSummariesSchema.parse(raw).accountSummaries;
  return accounts.flatMap((a) =>
    a.propertySummaries.map((p) => ({
      // property is "properties/123456" — the data API wants the bare id.
      propertyId: p.property.replace(/^properties\//, ""),
      displayName: p.displayName ?? p.property,
    })),
  );
}

/**
 * GBP auto-pick on connect: when the user manages exactly one account with
 * exactly one location, return the resource value to store. Otherwise null —
 * the tenant must pick via setGoogleResource.
 */
export async function gbpAutoResource(token: GoogleTokenContext): Promise<string | null> {
  try {
    const accounts = await gbpListAccounts(token);
    if (accounts.length !== 1) return null;
    const account = accounts[0];
    if (!account) return null;
    const locations = await gbpLocations(token, account.name);
    if (locations.length !== 1) return null;
    const location = locations[0];
    if (!location) return null;
    return JSON.stringify({ account: account.name, location: location.name });
  } catch {
    return null;
  }
}

export interface GbpResourceValue {
  account: string;
  location: string;
}

/** Parse the stored GBP externalAccountId ("{account, location}" JSON). */
export function parseGbpResource(value: string): GbpResourceValue | null {
  try {
    const parsed = z
      .object({ account: z.string(), location: z.string() })
      .parse(JSON.parse(value));
    return parsed;
  } catch {
    return null;
  }
}
