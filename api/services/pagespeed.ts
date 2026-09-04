import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { integrationCache, lighthouseAudits } from "@db/schema";
import type { LighthouseAuditSummary, LighthouseRating } from "@db/schema";
import { getDb } from "../queries/connection";
import { hashParams } from "./dataforseo";

/**
 * PageSpeed Insights (Lighthouse) client — v5 REST API, key auth from env.
 *
 * Storage: every audit run persists a tenant-scoped row in `lighthouse_audits`
 * (parsed summary in `scores`); the trimmed raw API response is also cached in
 * `integration_cache` (provider 'pagespeed', 24h TTL) so a repeat audit of the
 * same url+strategy within the TTL is served from the DB instead of burning
 * API quota. Cache/DB writes degrade gracefully: a cache failure never fails
 * the audit, and the audit row insert failure still returns the live result.
 */

const BASE_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PROVIDER = "pagespeed";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CATEGORIES = ["performance", "seo", "accessibility", "best-practices"] as const;

export class PageSpeedError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "PageSpeedError";
    this.statusCode = statusCode;
  }
}

// ─── API key (lazy singleton) ────────────────────────────────────────────────

let apiKey: string | null | undefined;

function getApiKey(): string | null {
  if (apiKey === undefined) {
    const key = process.env.PAGESPEED_API_KEY ?? "";
    apiKey = key || null;
  }
  return apiKey;
}

/** True when the PAGESPEED_API_KEY env var is present. */
export function isPageSpeedConfigured(): boolean {
  return getApiKey() !== null;
}

// ─── v5 response parsing (Zod — parse only what we use) ─────────────────────

const auditSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  score: z.number().nullable().optional(),
  displayValue: z.string().optional(),
  numericValue: z.number().optional(),
  details: z
    .object({
      type: z.string().optional(),
      overallSavingsMs: z.number().optional(),
      overallSavingsBytes: z.number().optional(),
    })
    .optional(),
});

const pageSpeedResponseSchema = z.object({
  lighthouseResult: z.object({
    requestedUrl: z.string().optional(),
    finalUrl: z.string().optional(),
    fetchTime: z.string().optional(),
    categories: z.record(
      z.string(),
      z.object({ score: z.number().nullable().optional() }),
    ),
    audits: z.record(z.string(), auditSchema),
  }),
});

export type PageSpeedApiResponse = z.infer<typeof pageSpeedResponseSchema>;

function ratingFromScore(score: number | null | undefined): LighthouseRating {
  if (score == null) return "average";
  if (score >= 0.9) return "good";
  if (score >= 0.5) return "average";
  return "poor";
}

function categoryScore(
  categories: Record<string, { score?: number | null | undefined }>,
  key: string,
): number {
  const s = categories[key]?.score;
  return s == null ? 0 : Math.round(s * 100);
}

function metric(
  audits: Record<string, z.infer<typeof auditSchema>>,
  id: string,
): { value: number; displayValue: string; rating: LighthouseRating } {
  const a = audits[id];
  return {
    value: a?.numericValue ?? 0,
    displayValue: a?.displayValue ?? "—",
    rating: ratingFromScore(a?.score),
  };
}

function formatSavings(ms?: number, bytes?: number): string {
  if (ms != null && ms > 0) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
  }
  if (bytes != null && bytes > 0) {
    return `${Math.round(bytes / 1024)} KiB`;
  }
  return "";
}

/**
 * Parse a raw v5 API response into the compact LighthouseAuditSummary shape:
 * 4 category scores (0–100), core web metrics with display values + ratings,
 * top 5 opportunities, fetchedAt.
 */
export function parseLighthouseResult(
  raw: unknown,
  url: string,
  strategy: "mobile" | "desktop",
): LighthouseAuditSummary {
  const { lighthouseResult: lhr } = pageSpeedResponseSchema.parse(raw);
  const audits = lhr.audits;

  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === "opportunity" && a.id && a.title)
    .sort(
      (x, y) =>
        (y.details?.overallSavingsMs ?? 0) - (x.details?.overallSavingsMs ?? 0) ||
        (y.details?.overallSavingsBytes ?? 0) - (x.details?.overallSavingsBytes ?? 0),
    )
    .slice(0, 5)
    .map((a) => ({
      id: a.id as string,
      title: a.title as string,
      savings: formatSavings(
        a.details?.overallSavingsMs,
        a.details?.overallSavingsBytes,
      ),
    }));

  const inp = audits["interaction-to-next-paint"];

  return {
    url: lhr.finalUrl ?? lhr.requestedUrl ?? url,
    strategy,
    scores: {
      performance: categoryScore(lhr.categories, "performance"),
      seo: categoryScore(lhr.categories, "seo"),
      accessibility: categoryScore(lhr.categories, "accessibility"),
      bestPractices: categoryScore(lhr.categories, "best-practices"),
    },
    metrics: {
      firstContentfulPaint: metric(audits, "first-contentful-paint"),
      largestContentfulPaint: metric(audits, "largest-contentful-paint"),
      totalBlockingTime: metric(audits, "total-blocking-time"),
      cumulativeLayoutShift: metric(audits, "cumulative-layout-shift"),
      speedIndex: metric(audits, "speed-index"),
      ...(inp?.numericValue != null
        ? { interactionToNextPaint: metric(audits, "interaction-to-next-paint") }
        : {}),
    },
    opportunities,
    fetchedAt: lhr.fetchTime ?? new Date().toISOString(),
  };
}

/** Trim a raw v5 response to the parts we parse (cache payload, not full LHR). */
export function trimRawResult(raw: unknown): unknown {
  const parsed = pageSpeedResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const lhr = parsed.data.lighthouseResult;
  return {
    lighthouseResult: {
      requestedUrl: lhr.requestedUrl,
      finalUrl: lhr.finalUrl,
      fetchTime: lhr.fetchTime,
      categories: lhr.categories,
      audits: lhr.audits,
    },
  };
}

// ─── HTTP core ───────────────────────────────────────────────────────────────

async function callApi(url: string, strategy: "mobile" | "desktop"): Promise<unknown> {
  const key = getApiKey();
  if (!key) {
    throw new PageSpeedError("PAGESPEED_API_KEY is not configured");
  }
  const params = new URLSearchParams({ url, strategy, key });
  for (const c of CATEGORIES) params.append("category", c);
  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ? `: ${body.error.message}` : "";
    } catch {
      // non-JSON error body — keep the status only
    }
    throw new PageSpeedError(`PageSpeed HTTP ${res.status}${detail}`, res.status);
  }
  return res.json();
}

// ─── integration_cache (provider 'pagespeed', 24h TTL) ───────────────────────

async function readCache(
  tenantId: number,
  paramsHashValue: string,
): Promise<unknown | null> {
  try {
    const row = await getDb().query.integrationCache.findFirst({
      where: and(
        eq(integrationCache.tenantId, tenantId),
        eq(integrationCache.provider, PROVIDER),
        eq(integrationCache.endpoint, "runPagespeed"),
        eq(integrationCache.paramsHash, paramsHashValue),
        gt(integrationCache.expiresAt, new Date()),
      ),
    });
    if (!row) return null;
    return (row.payload as { data?: unknown }).data ?? null;
  } catch {
    return null; // cache unavailable — fall through to a live call
  }
}

async function writeCache(
  tenantId: number,
  paramsHashValue: string,
  trimmedRaw: unknown,
): Promise<void> {
  try {
    const now = new Date();
    const payload = { data: trimmedRaw, meta: { fetchedAt: now.toISOString() } };
    await getDb()
      .insert(integrationCache)
      .values({
        tenantId,
        provider: PROVIDER,
        endpoint: "runPagespeed",
        paramsHash: paramsHashValue,
        payload,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      })
      .onDuplicateKeyUpdate({
        set: { payload, fetchedAt: now, expiresAt: new Date(now.getTime() + CACHE_TTL_MS) },
      });
  } catch {
    // Non-fatal: the audit row + live result still stand.
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type AuditSource = "live" | "cache";

export interface AuditResult {
  summary: LighthouseAuditSummary;
  dataSource: AuditSource;
}

/**
 * Run a PageSpeed audit for `url` (or serve the cached run within 24h).
 * Live runs persist a tenant-scoped lighthouse_audits row + refresh the
 * integration_cache entry; cache hits return the parsed summary without
 * inserting a new audit row.
 */
export async function runAudit(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
  tenantId?: number,
): Promise<AuditResult> {
  const paramsHashValue = hashParams({ url, strategy });
  if (tenantId !== undefined) {
    const cachedRaw = await readCache(tenantId, paramsHashValue);
    if (cachedRaw) {
      try {
        return { summary: parseLighthouseResult(cachedRaw, url, strategy), dataSource: "cache" };
      } catch {
        // Malformed cache payload — fall through to a live call.
      }
    }
  }

  const raw = await callApi(url, strategy);
  const summary = parseLighthouseResult(raw, url, strategy);

  if (tenantId !== undefined) {
    const fetchedAt = new Date(summary.fetchedAt);
    try {
      await getDb().insert(lighthouseAudits).values({
        tenantId,
        url: summary.url,
        strategy,
        scores: summary,
        fetchedAt: Number.isNaN(fetchedAt.getTime()) ? new Date() : fetchedAt,
      });
    } catch {
      // Non-fatal: still return the live audit; try the cache write anyway.
    }
    await writeCache(tenantId, paramsHashValue, trimRawResult(raw));
  }

  return { summary, dataSource: "live" };
}

/** Most recent audit row for a tenant (null when never run / table missing). */
export async function getLatestAudit(
  tenantId: number,
): Promise<LighthouseAuditSummary | null> {
  try {
    const row = await getDb().query.lighthouseAudits.findFirst({
      where: eq(lighthouseAudits.tenantId, tenantId),
      orderBy: [desc(lighthouseAudits.fetchedAt), desc(lighthouseAudits.id)],
    });
    return row?.scores ?? null;
  } catch {
    return null; // table unavailable — integrations card still renders
  }
}
