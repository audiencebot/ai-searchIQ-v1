import { createHash } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { integrationCache } from "@db/schema";
import { getDb } from "../queries/connection";

/**
 * DataForSEO live client (https://api.dataforseo.com, Basic auth from env).
 *
 * Cost control: every paid endpoint call is cached per tenant in
 * `integration_cache` (sha256 of canonical params, 24h TTL) — a repeat call
 * within the TTL is served from the DB instead of being billed again. The
 * actual `cost` DataForSEO charged is stored in the cached payload meta.
 *
 * Cache reads/writes degrade gracefully: if the cache table is unavailable
 * the live call still goes through (and is simply not persisted).
 */

const BASE_URL = "https://api.dataforseo.com";
const PROVIDER = "dataforseo";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Task-level codes worth one retry (transient throttling / backend errors). */
const RETRYABLE_TASK_CODES = new Set([40201, 40202, 50000, 50001, 50002]);

export class DataForSeoError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "DataForSeoError";
    this.statusCode = statusCode;
  }
}

// ─── Credentials (lazy singleton) ────────────────────────────────────────────

let credentials: { login: string; authHeader: string } | null | undefined;

function getCredentials() {
  if (credentials === undefined) {
    const login = process.env.DATAFORSEO_LOGIN ?? "";
    const password = process.env.DATAFORSEO_PASSWORD ?? "";
    credentials =
      login && password
        ? {
            login,
            authHeader: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
          }
        : null;
  }
  return credentials;
}

/** True when DATAFORSEO_LOGIN/PASSWORD env credentials are present. */
export function isDataForSeoConfigured(): boolean {
  return getCredentials() !== null;
}

// ─── Response envelopes (Zod-parsed) ─────────────────────────────────────────

const envelopeSchema = z.object({
  status_code: z.number(),
  status_message: z.string().optional(),
  cost: z.number().default(0),
  tasks: z
    .array(
      z.object({
        status_code: z.number(),
        status_message: z.string().optional(),
        cost: z.number().default(0),
        result: z.unknown().nullable(),
      }),
    )
    .default([]),
});

const serpResultSchema = z
  .array(
    z.object({
      items: z
        .array(
          z.object({
            type: z.string(),
            rank_absolute: z.number().nullish(),
            domain: z.string().nullish(),
            title: z.string().nullish(),
            url: z.string().nullish(),
          }),
        )
        .default([]),
    }),
  )
  .nullable();

const searchVolumeResultSchema = z
  .array(
    z.object({
      keyword: z.string(),
      search_volume: z.number().nullish(),
      cpc: z.number().nullish(),
    }),
  )
  .nullable();

const backlinkSummaryResultSchema = z
  .array(
    z.object({
      target: z.string().nullish(),
      backlinks: z.number().nullish(),
      referring_domains: z.number().nullish(),
      rank: z.number().nullish(),
    }),
  )
  .nullable();

const competitorsDomainResultSchema = z
  .array(
    z.object({
      items: z
        .array(
          z.object({
            domain: z.string(),
            avg_position: z.number().nullish(),
            intersections: z.number().nullish(),
          }),
        )
        .default([]),
    }),
  )
  .nullable();

const accountInfoResultSchema = z
  .array(
    z.object({
      login: z.string(),
      money: z.object({
        total: z.number().default(0),
        balance: z.number().default(0),
      }),
    }),
  )
  .nullable();

// ─── Normalized domain shapes ────────────────────────────────────────────────

export interface SerpOrganicItem {
  rank: number;
  url: string;
  title: string;
  domain: string;
}

export interface KeywordVolume {
  keyword: string;
  volume: number;
  cpc: number;
}

export interface BacklinkSummary {
  target: string;
  backlinks: number;
  referringDomains: number;
  rank: number;
}

export interface CompetitorDomain {
  domain: string;
  avgPosition: number;
  intersections: number;
}

export interface AccountInfo {
  login: string;
  balance: number;
  total: number;
}

export type DataForSeoSource = "live" | "cache";

export interface CachedData<T> {
  data: T;
  dataSource: DataForSeoSource;
  fetchedAt: Date;
  /** USD charged by DataForSEO for this call (0 when served from cache). */
  cost: number;
}

// ─── HTTP core ───────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callApi(
  path: string,
  body: unknown[] | null,
): Promise<{ result: unknown; cost: number }> {
  const creds = getCredentials();
  if (!creds) {
    throw new DataForSeoError("DataForSEO credentials are not configured");
  }

  let lastError: DataForSeoError | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: creds.authHeader,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      lastError = new DataForSeoError(`DataForSEO HTTP ${res.status} for ${path}`, res.status);
      continue;
    }
    const envelope = envelopeSchema.parse(await res.json());
    if (envelope.status_code !== 20000) {
      lastError = new DataForSeoError(
        `DataForSEO ${envelope.status_code}: ${envelope.status_message ?? "error"}`,
        envelope.status_code,
      );
      continue;
    }
    const task = envelope.tasks[0];
    if (!task) {
      throw new DataForSeoError(`DataForSEO returned no task for ${path}`);
    }
    if (task.status_code !== 20000) {
      lastError = new DataForSeoError(
        `DataForSEO task ${task.status_code}: ${task.status_message ?? "error"}`,
        task.status_code,
      );
      if (!RETRYABLE_TASK_CODES.has(task.status_code)) break;
      continue;
    }
    return { result: task.result, cost: task.cost || envelope.cost };
  }
  throw lastError ?? new DataForSeoError(`DataForSEO request failed for ${path}`);
}

// ─── Cache ───────────────────────────────────────────────────────────────────

/** sha256 over canonical JSON (object keys sorted recursively). */
export function hashParams(params: unknown): string {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return createHash("sha256").update(JSON.stringify(canonical(params))).digest("hex");
}

async function readCache<T>(
  tenantId: number,
  endpoint: string,
  paramsHashValue: string,
): Promise<CachedData<T> | null> {
  try {
    const row = await getDb().query.integrationCache.findFirst({
      where: and(
        eq(integrationCache.tenantId, tenantId),
        eq(integrationCache.provider, PROVIDER),
        eq(integrationCache.endpoint, endpoint),
        eq(integrationCache.paramsHash, paramsHashValue),
        gt(integrationCache.expiresAt, new Date()),
      ),
    });
    if (!row) return null;
    const payload = row.payload as { data: T; meta?: { cost?: number } };
    return {
      data: payload.data,
      dataSource: "cache",
      fetchedAt: row.fetchedAt,
      cost: 0,
    };
  } catch {
    return null; // cache unavailable — fall through to a live call
  }
}

async function writeCache<T>(
  tenantId: number,
  endpoint: string,
  paramsHashValue: string,
  data: T,
  cost: number,
): Promise<void> {
  try {
    const now = new Date();
    const payload = { data, meta: { cost, fetchedAt: now.toISOString() } };
    await getDb()
      .insert(integrationCache)
      .values({
        tenantId,
        provider: PROVIDER,
        endpoint,
        paramsHash: paramsHashValue,
        payload,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      })
      .onDuplicateKeyUpdate({
        set: { payload, fetchedAt: now, expiresAt: new Date(now.getTime() + CACHE_TTL_MS) },
      });
  } catch {
    // Non-fatal: the live result is still returned, just not cached.
  }
}

async function cached<T>(
  tenantId: number | undefined,
  endpoint: string,
  params: unknown,
  fetcher: () => Promise<{ data: T; cost: number }>,
): Promise<CachedData<T>> {
  const paramsHashValue = hashParams(params);
  if (tenantId !== undefined) {
    const hit = await readCache<T>(tenantId, endpoint, paramsHashValue);
    if (hit) return hit;
  }
  const { data, cost } = await fetcher();
  if (tenantId !== undefined) {
    await writeCache(tenantId, endpoint, paramsHashValue, data, cost);
  }
  return { data, dataSource: "live", fetchedAt: new Date(), cost };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** GET /v3/appendix/user_data — account balance and price limits (free). */
export async function getAccountInfo(): Promise<AccountInfo> {
  const { result } = await callApi("/v3/appendix/user_data", null);
  const parsed = accountInfoResultSchema.parse(result);
  const account = parsed?.[0];
  if (!account) throw new DataForSeoError("DataForSEO returned empty user_data");
  return {
    login: account.login,
    balance: account.money.balance,
    total: account.money.total,
  };
}

/** POST /v3/serp/google/organic/live/advanced — organic items, normalized. */
export async function getSerpOrganic(
  keyword: string,
  locationCode = 2840,
  languageCode = "en",
  depth = 30,
  tenantId?: number,
): Promise<CachedData<SerpOrganicItem[]>> {
  const params = { keyword, locationCode, languageCode, depth };
  return cached(tenantId, "serp/google/organic/live/advanced", params, async () => {
    const { result, cost } = await callApi("/v3/serp/google/organic/live/advanced", [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        depth,
      },
    ]);
    const parsed = serpResultSchema.parse(result);
    const items = (parsed?.[0]?.items ?? [])
      .filter((i) => i.type === "organic" && i.url && i.domain)
      .map((i) => ({
        rank: i.rank_absolute ?? 0,
        url: i.url as string,
        title: i.title ?? "",
        domain: (i.domain as string).replace(/^www\./, ""),
      }));
    return { data: items, cost };
  });
}

/** POST /v3/keywords_data/google_ads/search_volume/live — volume + CPC. */
export async function getSearchVolume(
  keywords: string[],
  tenantId?: number,
  locationCode = 2840,
  languageCode = "en",
): Promise<CachedData<KeywordVolume[]>> {
  const normalized = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const params = { keywords: [...normalized].sort(), locationCode, languageCode };
  return cached(tenantId, "keywords_data/google_ads/search_volume/live", params, async () => {
    const { result, cost } = await callApi(
      "/v3/keywords_data/google_ads/search_volume/live",
      [{ keywords: normalized, location_code: locationCode, language_code: languageCode }],
    );
    const parsed = searchVolumeResultSchema.parse(result);
    const data = (parsed ?? []).map((r) => ({
      keyword: r.keyword,
      volume: r.search_volume ?? 0,
      cpc: r.cpc ?? 0,
    }));
    return { data, cost };
  });
}

/** POST /v3/backlinks/summary/live — backlinks / referring domains / rank. */
export async function getBacklinkSummary(
  target: string,
  tenantId?: number,
): Promise<CachedData<BacklinkSummary>> {
  const domain = target.replace(/^www\./, "");
  return cached(tenantId, "backlinks/summary/live", { target: domain }, async () => {
    const { result, cost } = await callApi("/v3/backlinks/summary/live", [
      { target: domain },
    ]);
    const parsed = backlinkSummaryResultSchema.parse(result);
    const row = parsed?.[0];
    return {
      data: {
        target: row?.target ?? domain,
        backlinks: row?.backlinks ?? 0,
        referringDomains: row?.referring_domains ?? 0,
        rank: row?.rank ?? 0,
      },
      cost,
    };
  });
}

/** POST /v3/dataforseo_labs/google/competitors_domain/live — SERP competitors. */
export async function getCompetitorsDomain(
  target: string,
  limit = 10,
  tenantId?: number,
  locationCode = 2840,
  languageCode = "en",
): Promise<CachedData<CompetitorDomain[]>> {
  const domain = target.replace(/^www\./, "");
  const params = { target: domain, limit, locationCode, languageCode };
  return cached(
    tenantId,
    "dataforseo_labs/google/competitors_domain/live",
    params,
    async () => {
      const { result, cost } = await callApi(
        "/v3/dataforseo_labs/google/competitors_domain/live",
        [
          {
            target: domain,
            location_code: locationCode,
            language_code: languageCode,
            limit,
          },
        ],
      );
      const parsed = competitorsDomainResultSchema.parse(result);
      const data = (parsed?.[0]?.items ?? []).map((i) => ({
        domain: i.domain,
        avgPosition: i.avg_position ?? 0,
        intersections: i.intersections ?? 0,
      }));
      return { data, cost };
    },
  );
}

/** Rank of a target domain within normalized SERP items (0 = not present). */
export function findDomainRank(items: SerpOrganicItem[], targetDomain: string): number {
  const target = targetDomain.replace(/^www\./, "");
  const hit = items.find(
    (i) => i.domain === target || i.domain.endsWith(`.${target}`) || target.endsWith(`.${i.domain}`),
  );
  return hit?.rank ?? 0;
}
